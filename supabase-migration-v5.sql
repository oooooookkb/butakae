-- ==========================================
-- 부탁해 v5 마이그레이션 - 즐겨찾기 + 도우미 선호 설정
-- Supabase SQL Editor에서 실행하세요
-- (v4 마이그레이션을 먼저 실행해야 합니다)
-- ==========================================

-- ============================================
-- 1. favorites 테이블 (즐겨찾기)
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  task_id uuid REFERENCES tasks ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, task_id)  -- 한 유저가 같은 task를 중복 즐겨찾기 방지
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- 본인 즐겨찾기만 조회
CREATE POLICY "favorites_select" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

-- 본인만 즐겨찾기 추가
CREATE POLICY "favorites_insert" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인만 즐겨찾기 삭제
CREATE POLICY "favorites_delete" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_task ON favorites(task_id);

-- ============================================
-- 2. user_preferences 테이블 (도우미 선호 설정)
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users,
  preferred_categories text[] DEFAULT '{}',  -- 선호 카테고리 배열
  max_distance_km float DEFAULT 5.0,         -- 최대 거리 (km)
  min_price integer DEFAULT 0,               -- 최소 금액
  notifications_enabled boolean DEFAULT true, -- 알림 활성화
  helper_mode boolean DEFAULT false,          -- 돈벌기 모드 활성화
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- 본인 설정만 조회/수정
CREATE POLICY "preferences_select" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "preferences_insert" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "preferences_update" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 3. 즐겨찾기 토글 RPC (추가/제거)
-- ============================================
CREATE OR REPLACE FUNCTION toggle_favorite(p_user_id uuid, p_task_id uuid)
RETURNS json AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM favorites WHERE user_id = p_user_id AND task_id = p_task_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM favorites WHERE user_id = p_user_id AND task_id = p_task_id;
    RETURN json_build_object('action', 'removed', 'task_id', p_task_id);
  ELSE
    INSERT INTO favorites (user_id, task_id) VALUES (p_user_id, p_task_id);
    RETURN json_build_object('action', 'added', 'task_id', p_task_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. 도우미 맞춤 피드 RPC (선호 카테고리 + 거리 필터)
-- ============================================
CREATE OR REPLACE FUNCTION get_helper_feed(
  p_user_id uuid,
  p_user_lat float DEFAULT NULL,
  p_user_lng float DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  price integer,
  final_price integer,
  category text,
  location text,
  lat float,
  lng float,
  is_urgent boolean,
  status text,
  requester_id uuid,
  helper_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  requester_name text,
  requester_rating float,
  requester_avatar text,
  application_count bigint,
  distance_km float,
  score float,
  is_favorited boolean
) AS $$
DECLARE
  v_prefs user_preferences%ROWTYPE;
BEGIN
  -- 유저 선호 설정 가져오기
  SELECT * INTO v_prefs FROM user_preferences WHERE user_preferences.user_id = p_user_id;

  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.price,
    t.final_price,
    t.category,
    t.location,
    t.lat,
    t.lng,
    t.is_urgent,
    t.status,
    t.requester_id,
    t.helper_id,
    t.created_at,
    t.updated_at,
    p.name AS requester_name,
    p.rating AS requester_rating,
    p.avatar_url AS requester_avatar,
    COALESCE(ac.cnt, 0) AS application_count,
    haversine_km(p_user_lat, p_user_lng, t.lat, t.lng) AS distance_km,
    -- 도우미 최적화 스코어
    (
      -- 거리 점수 (가까울수록 높음, 최대 400)
      CASE
        WHEN p_user_lat IS NOT NULL AND t.lat IS NOT NULL
        THEN GREATEST(0, 400 - haversine_km(p_user_lat, p_user_lng, t.lat, t.lng) * 100)
        ELSE 100
      END
      +
      -- 급함 점수 (300 - 도우미는 급한 건에 더 높은 가중치)
      CASE WHEN t.is_urgent THEN 300 ELSE 0 END
      +
      -- 가격 점수 (가격이 높을수록 보상 좋음, 최대 200)
      LEAST(200, t.price / 100)
      +
      -- 경쟁률 낮은 것 우선 (최대 150)
      GREATEST(0, 150 - COALESCE(ac.cnt, 0) * 50)
      +
      -- 선호 카테고리 보너스 (200)
      CASE
        WHEN v_prefs.preferred_categories IS NOT NULL
          AND t.category = ANY(v_prefs.preferred_categories)
        THEN 200
        ELSE 0
      END
    ) AS score,
    EXISTS(SELECT 1 FROM favorites f WHERE f.user_id = p_user_id AND f.task_id = t.id) AS is_favorited
  FROM tasks t
  LEFT JOIN profiles p ON p.id = t.requester_id
  LEFT JOIN (
    SELECT task_id, COUNT(*) AS cnt
    FROM task_applications WHERE status = 'pending'
    GROUP BY task_id
  ) ac ON ac.task_id = t.id
  WHERE t.status = 'open'
    AND t.requester_id != p_user_id  -- 본인 부탁 제외
    -- 거리 필터 (설정된 경우만)
    AND (
      p_user_lat IS NULL
      OR t.lat IS NULL
      OR v_prefs.max_distance_km IS NULL
      OR haversine_km(p_user_lat, p_user_lng, t.lat, t.lng) <= v_prefs.max_distance_km
    )
    -- 최소 금액 필터
    AND (
      v_prefs.min_price IS NULL
      OR v_prefs.min_price = 0
      OR t.price >= v_prefs.min_price
    )
  ORDER BY score DESC, t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 5. 즐겨찾기 목록 조회 RPC
-- ============================================
CREATE OR REPLACE FUNCTION get_my_favorites(
  p_user_id uuid,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  price integer,
  category text,
  location text,
  distance_km float,
  is_urgent boolean,
  status text,
  requester_id uuid,
  created_at timestamptz,
  requester_name text,
  requester_rating float,
  favorited_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.title,
    t.description,
    t.price,
    t.category,
    t.location,
    0::float AS distance_km,
    t.is_urgent,
    t.status,
    t.requester_id,
    t.created_at,
    p.name AS requester_name,
    p.rating AS requester_rating,
    f.created_at AS favorited_at
  FROM favorites f
  JOIN tasks t ON t.id = f.task_id
  LEFT JOIN profiles p ON p.id = t.requester_id
  WHERE f.user_id = p_user_id
  ORDER BY f.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;
