-- ==========================================
-- 부탁해 v3 마이그레이션 - 지원자 시스템 + 즉시 수락
-- Supabase SQL Editor에서 실행하세요
-- (v2 마이그레이션을 먼저 실행해야 합니다)
-- ==========================================

-- ============================================
-- 1. tasks: final_price 컬럼 추가
-- ============================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS final_price integer;

-- ============================================
-- 2. task_applications 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS task_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  offer_price integer NOT NULL,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id)  -- 한 task에 유저 1번만 지원
);

ALTER TABLE task_applications ENABLE ROW LEVEL SECURITY;

-- 누구나 지원 목록 볼 수 있음 (요청자가 봐야 하므로)
CREATE POLICY "applications_select" ON task_applications
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks WHERE tasks.id = task_applications.task_id AND tasks.requester_id = auth.uid()
    )
  );

-- 본인만 지원 가능
CREATE POLICY "applications_insert" ON task_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 요청자 또는 지원자가 업데이트 가능
CREATE POLICY "applications_update" ON task_applications
  FOR UPDATE USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks WHERE tasks.id = task_applications.task_id AND tasks.requester_id = auth.uid()
    )
  );

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_applications_task ON task_applications(task_id, status);
CREATE INDEX IF NOT EXISTS idx_applications_user ON task_applications(user_id);

-- ============================================
-- 3. accept_task RPC 업데이트 (즉시 수락 = final_price = price)
-- ============================================
CREATE OR REPLACE FUNCTION accept_task(p_task_id uuid, p_helper_id uuid)
RETURNS json AS $$
DECLARE
  v_task tasks%ROWTYPE;
BEGIN
  UPDATE tasks
  SET status = 'in_progress',
      helper_id = p_helper_id,
      final_price = price,  -- 즉시 수락 시 원래 가격
      updated_at = now()
  WHERE id = p_task_id
    AND status = 'open'
    AND requester_id != p_helper_id
  RETURNING * INTO v_task;

  IF v_task.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_taken');
  END IF;

  -- 채팅방 생성
  INSERT INTO chat_rooms (task_id, requester_id, helper_id)
  VALUES (p_task_id, v_task.requester_id, p_helper_id);

  -- 다른 지원자들 rejected 처리
  UPDATE task_applications SET status = 'rejected'
  WHERE task_id = p_task_id AND user_id != p_helper_id AND status = 'pending';

  -- 이 helper가 지원했었다면 accepted 처리
  UPDATE task_applications SET status = 'accepted'
  WHERE task_id = p_task_id AND user_id = p_helper_id;

  -- 알림
  INSERT INTO notifications (user_id, type, title, body, task_id, related_user_id)
  VALUES (
    v_task.requester_id, 'task_accepted', '부탁이 수락되었어요!',
    '누군가 당신의 부탁을 바로 수락했습니다', p_task_id, p_helper_id
  );

  RETURN json_build_object(
    'success', true,
    'task_id', v_task.id,
    'chat_room_id', (SELECT id FROM chat_rooms WHERE task_id = p_task_id AND helper_id = p_helper_id LIMIT 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. 요청자가 지원자 선택하는 RPC
-- ============================================
CREATE OR REPLACE FUNCTION accept_application(p_application_id uuid, p_requester_id uuid)
RETURNS json AS $$
DECLARE
  v_app task_applications%ROWTYPE;
  v_task tasks%ROWTYPE;
BEGIN
  -- 지원 정보 가져오기
  SELECT * INTO v_app FROM task_applications WHERE id = p_application_id AND status = 'pending';
  IF v_app.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'application_not_found');
  END IF;

  -- task 업데이트 (open일 때만)
  UPDATE tasks
  SET status = 'in_progress',
      helper_id = v_app.user_id,
      final_price = v_app.offer_price,
      updated_at = now()
  WHERE id = v_app.task_id
    AND status = 'open'
    AND requester_id = p_requester_id
  RETURNING * INTO v_task;

  IF v_task.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'cannot_accept');
  END IF;

  -- 선택된 지원자 accepted
  UPDATE task_applications SET status = 'accepted' WHERE id = p_application_id;

  -- 나머지 지원자 rejected
  UPDATE task_applications SET status = 'rejected'
  WHERE task_id = v_app.task_id AND id != p_application_id AND status = 'pending';

  -- 채팅방 생성
  INSERT INTO chat_rooms (task_id, requester_id, helper_id)
  VALUES (v_app.task_id, p_requester_id, v_app.user_id);

  -- 선택된 도우미에게 알림
  INSERT INTO notifications (user_id, type, title, body, task_id, related_user_id)
  VALUES (
    v_app.user_id, 'task_accepted', '지원이 수락되었어요! 🎉',
    '요청자가 당신을 선택했습니다. 채팅을 시작하세요!',
    v_app.task_id, p_requester_id
  );

  -- 거절된 지원자들에게 알림
  INSERT INTO notifications (user_id, type, title, body, task_id)
  SELECT user_id, 'task_cancelled', '다른 분이 선택되었어요',
         '아쉽지만 다른 지원자가 선택되었습니다', task_id
  FROM task_applications
  WHERE task_id = v_app.task_id AND status = 'rejected' AND user_id != v_app.user_id;

  RETURN json_build_object(
    'success', true,
    'chat_room_id', (SELECT id FROM chat_rooms WHERE task_id = v_app.task_id AND helper_id = v_app.user_id LIMIT 1)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 지원하기 RPC (알림 포함)
-- ============================================
CREATE OR REPLACE FUNCTION apply_to_task(p_task_id uuid, p_user_id uuid, p_offer_price integer, p_message text DEFAULT NULL)
RETURNS json AS $$
DECLARE
  v_task tasks%ROWTYPE;
  v_app task_applications%ROWTYPE;
BEGIN
  -- task 확인
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id AND status = 'open';
  IF v_task.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'task_not_available');
  END IF;

  -- 본인 부탁에 지원 방지
  IF v_task.requester_id = p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'cannot_apply_own');
  END IF;

  -- 지원 삽입 (중복 방지는 UNIQUE 제약)
  INSERT INTO task_applications (task_id, user_id, offer_price, message)
  VALUES (p_task_id, p_user_id, p_offer_price, p_message)
  ON CONFLICT (task_id, user_id) DO NOTHING
  RETURNING * INTO v_app;

  IF v_app.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'already_applied');
  END IF;

  -- 요청자에게 알림
  INSERT INTO notifications (user_id, type, title, body, task_id, related_user_id)
  VALUES (
    v_task.requester_id, 'task_accepted',
    '새로운 지원자가 있어요!',
    p_offer_price || '원에 지원했습니다',
    p_task_id, p_user_id
  );

  RETURN json_build_object('success', true, 'application_id', v_app.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
