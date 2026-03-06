-- ==========================================
-- 부탁해 v2 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ==========================================

-- ============================================
-- 1. tasks 테이블: completed_at, cancelled_at 추가
-- ============================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- ============================================
-- 2. Race condition 방지: 원자적 매칭 RPC 함수
--    status='open'인 경우에만 helper 배정
-- ============================================
CREATE OR REPLACE FUNCTION accept_task(p_task_id uuid, p_helper_id uuid)
RETURNS json AS $$
DECLARE
  v_task tasks%ROWTYPE;
BEGIN
  -- 조건부 UPDATE (open일 때만)
  UPDATE tasks
  SET status = 'in_progress',
      helper_id = p_helper_id,
      updated_at = now()
  WHERE id = p_task_id
    AND status = 'open'
    AND requester_id != p_helper_id  -- 본인 부탁 수락 방지
  RETURNING * INTO v_task;

  -- 매칭 실패 (이미 다른 사람이 수락)
  IF v_task.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_taken');
  END IF;

  -- 채팅방 자동 생성
  INSERT INTO chat_rooms (task_id, requester_id, helper_id)
  VALUES (p_task_id, v_task.requester_id, p_helper_id);

  -- 알림 생성 (요청자에게)
  INSERT INTO notifications (user_id, type, title, body, task_id, related_user_id)
  VALUES (
    v_task.requester_id,
    'task_accepted',
    '부탁이 수락되었어요!',
    '누군가 당신의 부탁을 수락했습니다',
    p_task_id,
    p_helper_id
  );

  RETURN json_build_object(
    'success', true,
    'task_id', v_task.id,
    'chat_room_id', (SELECT id FROM chat_rooms WHERE task_id = p_task_id AND helper_id = p_helper_id LIMIT 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. reviews: 양방향 리뷰 지원
--    UNIQUE(task_id) → UNIQUE(task_id, reviewer_id)
-- ============================================
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_task_id_key;
ALTER TABLE reviews ADD CONSTRAINT reviews_task_reviewer_unique UNIQUE (task_id, reviewer_id);

-- ============================================
-- 4. payments: method 컬럼 추가
-- ============================================
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method text DEFAULT 'toss';

-- ============================================
-- 5. location 복합 인덱스 (동네 + 상태 필터링)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tasks_location_status ON tasks(location, status);

-- ============================================
-- 6. notifications 테이블 (알림 시스템)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN (
    'task_accepted',    -- 내 부탁을 누가 수락
    'task_completed',   -- 부탁 완료됨
    'task_cancelled',   -- 부탁 취소됨
    'new_message',      -- 새 채팅 메시지
    'new_review',       -- 새 리뷰 도착
    'payment_confirmed' -- 결제 확인됨
  )),
  title text NOT NULL,
  body text,
  task_id uuid REFERENCES tasks ON DELETE CASCADE,
  related_user_id uuid REFERENCES auth.users,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림만 볼 수 있음
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- 시스템(RPC)에서만 insert하므로 SECURITY DEFINER 함수에서 처리
-- 클라이언트에서 읽음 처리만 허용
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- insert는 RPC 함수(SECURITY DEFINER)에서만 하지만,
-- 클라이언트 직접 insert도 허용 (새 메시지 알림 등)
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- 7. 완료/취소 시 타임스탬프 자동 기록 함수
-- ============================================
CREATE OR REPLACE FUNCTION complete_task(p_task_id uuid, p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_task tasks%ROWTYPE;
BEGIN
  UPDATE tasks
  SET status = 'done',
      completed_at = now(),
      updated_at = now()
  WHERE id = p_task_id
    AND status = 'in_progress'
    AND requester_id = p_user_id  -- 요청자만 완료 가능
  RETURNING * INTO v_task;

  IF v_task.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'cannot_complete');
  END IF;

  -- 도우미에게 알림
  INSERT INTO notifications (user_id, type, title, body, task_id, related_user_id)
  VALUES (
    v_task.helper_id,
    'task_completed',
    '부탁이 완료되었어요!',
    '리뷰를 확인해보세요',
    p_task_id,
    p_user_id
  );

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cancel_task(p_task_id uuid, p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_task tasks%ROWTYPE;
BEGIN
  UPDATE tasks
  SET status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  WHERE id = p_task_id
    AND status IN ('open', 'in_progress')
    AND requester_id = p_user_id  -- 요청자만 취소 가능
  RETURNING * INTO v_task;

  IF v_task.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'cannot_cancel');
  END IF;

  -- 도우미가 있으면 알림
  IF v_task.helper_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, task_id, related_user_id)
    VALUES (
      v_task.helper_id,
      'task_cancelled',
      '부탁이 취소되었어요',
      '요청자가 부탁을 취소했습니다',
      p_task_id,
      p_user_id
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
