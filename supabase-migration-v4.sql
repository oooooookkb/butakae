-- ==========================================
-- 부탁해 v4 마이그레이션 - 스마트 피드 + 거리 계산
-- Supabase SQL Editor에서 실행하세요
-- ==========================================

-- ============================================
-- 1. 복합 인덱스: 홈 피드 최적화
-- ============================================
DROP INDEX IF EXISTS idx_tasks_location_status;
CREATE INDEX IF NOT EXISTS idx_tasks_feed ON tasks(status, location, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_feed_urgent ON tasks(status, is_urgent, created_at DESC);

-- ============================================
-- 2. Haversine 거리 계산 함수 (km)
-- ============================================
CREATE OR REPLACE FUNCTION haversine_km(lat1 float, lng1 float, lat2 float, lng2 float)
RETURNS float AS $$
DECLARE
  r float := 6371;  -- 지구 반지름 (km)
  dlat float;
  dlng float;
  a float;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN 9999;  -- 좌표 없으면 먼 거리 반환
  END IF;
  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  RETURN r * 2 * asin(sqrt(a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 3. 스마트 피드 RPC (거리 + 급함 + 최신 점수)
-- ============================================
CREATE OR REPLACE FUNCTION get_smart_feed(
  p_user_lat float DEFAULT NULL,
  p_user_lng float DEFAULT NULL,
  p_user_location text DEFAULT NULL,
  p_category text DEFAULT NULL,
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
  score float
) AS $$
BEGIN
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
    -- 스코어 계산
    (
      -- 거리 점수 (가까울수록 높음, 최대 400)
      CASE
        WHEN p_user_lat IS NOT NULL AND t.lat IS NOT NULL
        THEN GREATEST(0, 400 - haversine_km(p_user_lat, p_user_lng, t.lat, t.lng) * 100)
        -- 좌표 없으면 동네 이름 매칭
        WHEN p_user_location IS NOT NULL AND t.location = p_user_location
        THEN 300
        ELSE 100
      END
      +
      -- 급함 점수 (200)
      CASE WHEN t.is_urgent THEN 200 ELSE 0 END
      +
      -- 최신 점수 (최대 300, 1시간마다 -10)
      GREATEST(0, 300 - EXTRACT(EPOCH FROM (now() - t.created_at)) / 360)
      +
      -- 지원자 적은 게 매칭 확률 높음 (최대 100)
      GREATEST(0, 100 - COALESCE(ac.cnt, 0) * 25)
    ) AS score
  FROM tasks t
  LEFT JOIN profiles p ON p.id = t.requester_id
  LEFT JOIN (
    SELECT task_id, COUNT(*) AS cnt
    FROM task_applications WHERE status = 'pending'
    GROUP BY task_id
  ) ac ON ac.task_id = t.id
  WHERE t.status = 'open'
    AND (p_category IS NULL OR t.category = p_category)
  ORDER BY score DESC, t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 4. tasks에 expires_at 추가 (자동 만료용)
-- ============================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expires_at timestamptz;
