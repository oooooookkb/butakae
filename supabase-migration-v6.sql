-- ==========================================
-- 부탁해 v6 마이그레이션 - 프로필 강화 + 뱃지 시스템
-- Supabase SQL Editor에서 실행하세요
-- (v5 마이그레이션을 먼저 실행해야 합니다)
-- ==========================================

-- ============================================
-- 1. profiles 테이블에 응답률/소개 컬럼 추가
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS response_rate float DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_requests integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_helped integer DEFAULT 0;

-- ============================================
-- 2. badges 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS badges (
  id text PRIMARY KEY,             -- 'fast_responder', 'top_50', 'rating_49' 등
  name text NOT NULL,
  emoji text NOT NULL,
  description text NOT NULL,
  condition_type text NOT NULL,    -- 'completed_count', 'rating', 'response_rate'
  condition_value float NOT NULL   -- 달성 기준값
);

-- 유저별 뱃지 연결 테이블
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  badge_id text REFERENCES badges NOT NULL,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_badges_select" ON user_badges
  FOR SELECT USING (true);  -- 누구나 뱃지 조회 가능

CREATE POLICY "user_badges_insert" ON user_badges
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- ============================================
-- 3. 기본 뱃지 데이터 삽입
-- ============================================
INSERT INTO badges (id, name, emoji, description, condition_type, condition_value) VALUES
  ('fast_responder', '빠른 응답', '⚡', '응답률 90% 이상', 'response_rate', 90),
  ('completed_10', '10건 완료', '🎯', '부탁 10건 완료', 'completed_count', 10),
  ('completed_50', '50건 달성', '🏆', '부탁 50건 완료', 'completed_count', 50),
  ('completed_100', '백전백승', '👑', '부탁 100건 완료', 'completed_count', 100),
  ('rating_48', '높은 평점', '⭐', '평점 4.8 이상', 'rating', 4.8),
  ('rating_49', '최고 평점', '🌟', '평점 4.9 이상', 'rating', 4.9),
  ('helper_10', '도우미 10건', '🤝', '도움 10건 완료', 'helped_count', 10),
  ('helper_50', '슈퍼 도우미', '💪', '도움 50건 완료', 'helped_count', 50),
  ('first_task', '첫 부탁', '🎉', '첫 번째 부탁 완료', 'completed_count', 1),
  ('trusted', '신뢰왕', '🛡️', '평점 4.5+ & 완료 20건+', 'trust_score', 1)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. 프로필 통계 + 뱃지 자동 갱신 RPC
-- ============================================
CREATE OR REPLACE FUNCTION refresh_profile_stats(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_completed integer;
  v_helped integer;
  v_total_requests integer;
  v_rating float;
  v_response_rate float;
  v_new_badges text[] := '{}';
  v_badge RECORD;
BEGIN
  -- 통계 계산
  SELECT COUNT(*) INTO v_completed
  FROM tasks WHERE requester_id = p_user_id AND status = 'done';

  SELECT COUNT(*) INTO v_helped
  FROM tasks WHERE helper_id = p_user_id AND status = 'done';

  SELECT COUNT(*) INTO v_total_requests
  FROM tasks WHERE requester_id = p_user_id;

  SELECT COALESCE(AVG(rating), 5.0) INTO v_rating
  FROM reviews WHERE reviewee_id = p_user_id;

  -- 응답률 계산 (지원받은 부탁 중 24시간 내 반응한 비율)
  -- 간단 버전: 완료+진행 / 전체 오픈 부탁
  IF v_total_requests > 0 THEN
    v_response_rate := LEAST(100, (v_completed + v_helped)::float / GREATEST(1, v_total_requests) * 100);
  ELSE
    v_response_rate := 0;
  END IF;

  -- 프로필 업데이트
  UPDATE profiles SET
    rating = v_rating,
    completed_count = v_completed + v_helped,
    response_rate = v_response_rate,
    total_requests = v_total_requests,
    total_helped = v_helped
  WHERE id = p_user_id;

  -- 뱃지 자동 부여 체크
  FOR v_badge IN SELECT * FROM badges LOOP
    -- 이미 보유 중이면 스킵
    IF EXISTS(SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = v_badge.id) THEN
      CONTINUE;
    END IF;

    -- 조건 체크
    IF (v_badge.condition_type = 'completed_count' AND (v_completed + v_helped) >= v_badge.condition_value)
       OR (v_badge.condition_type = 'rating' AND v_rating >= v_badge.condition_value AND (v_completed + v_helped) >= 5)
       OR (v_badge.condition_type = 'response_rate' AND v_response_rate >= v_badge.condition_value)
       OR (v_badge.condition_type = 'helped_count' AND v_helped >= v_badge.condition_value)
       OR (v_badge.condition_type = 'trust_score' AND v_rating >= 4.5 AND (v_completed + v_helped) >= 20)
    THEN
      INSERT INTO user_badges (user_id, badge_id) VALUES (p_user_id, v_badge.id)
        ON CONFLICT DO NOTHING;
      v_new_badges := array_append(v_new_badges, v_badge.id);
    END IF;
  END LOOP;

  RETURN json_build_object(
    'completed', v_completed,
    'helped', v_helped,
    'rating', v_rating,
    'response_rate', v_response_rate,
    'new_badges', v_new_badges
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 프로필 상세 조회 RPC (타인 프로필도 조회 가능)
-- ============================================
CREATE OR REPLACE FUNCTION get_profile_detail(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_profile json;
  v_badges json;
  v_reviews json;
  v_recent_tasks json;
  v_stats json;
BEGIN
  -- 프로필 기본 정보
  SELECT json_build_object(
    'id', id,
    'name', name,
    'avatar_url', avatar_url,
    'location', location,
    'bio', COALESCE(bio, ''),
    'rating', rating,
    'completed_count', completed_count,
    'response_rate', COALESCE(response_rate, 0),
    'total_requests', COALESCE(total_requests, 0),
    'total_helped', COALESCE(total_helped, 0),
    'created_at', created_at
  ) INTO v_profile
  FROM profiles WHERE id = p_user_id;

  -- 뱃지 목록
  SELECT COALESCE(json_agg(json_build_object(
    'id', b.id,
    'name', b.name,
    'emoji', b.emoji,
    'description', b.description,
    'earned_at', ub.earned_at
  ) ORDER BY ub.earned_at), '[]'::json) INTO v_badges
  FROM user_badges ub
  JOIN badges b ON b.id = ub.badge_id
  WHERE ub.user_id = p_user_id;

  -- 최근 리뷰 (최대 10개)
  SELECT COALESCE(json_agg(json_build_object(
    'id', r.id,
    'rating', r.rating,
    'content', r.content,
    'created_at', r.created_at,
    'reviewer_name', p.name,
    'reviewer_avatar', p.avatar_url
  ) ORDER BY r.created_at DESC), '[]'::json) INTO v_reviews
  FROM (SELECT * FROM reviews WHERE reviewee_id = p_user_id ORDER BY created_at DESC LIMIT 10) r
  LEFT JOIN profiles p ON p.id = r.reviewer_id;

  -- 최근 완료 부탁 (최대 5개)
  SELECT COALESCE(json_agg(json_build_object(
    'id', t.id,
    'title', t.title,
    'category', t.category,
    'price', t.price,
    'status', t.status,
    'created_at', t.created_at
  ) ORDER BY t.created_at DESC), '[]'::json) INTO v_recent_tasks
  FROM (
    SELECT * FROM tasks
    WHERE (requester_id = p_user_id OR helper_id = p_user_id) AND status = 'done'
    ORDER BY created_at DESC LIMIT 5
  ) t;

  RETURN json_build_object(
    'profile', v_profile,
    'badges', v_badges,
    'reviews', v_reviews,
    'recent_tasks', v_recent_tasks
  );
END;
$$ LANGUAGE plpgsql STABLE;
