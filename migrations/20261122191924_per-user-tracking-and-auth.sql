-- Per-user task tracking tables, login logs, Auth linkage, rich PKT details, and missed-slot sync

-- 1. Enhance team_members with email, InsForge auth user link, and login metadata
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_pkt TEXT,
  ADD COLUMN IF NOT EXISTS login_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.team_members AS tm
SET
  email = CASE tm.id
    WHEN 'zohaib' THEN 'zohaib@reeltracker.app'
    WHEN 'member-2' THEN 'huzaifa@reeltracker.app'
    WHEN 'member-3' THEN 'hashir@reeltracker.app'
    ELSE tm.email
  END,
  auth_user_id = au.id
FROM auth.users AS au
WHERE au.email = CASE tm.id
  WHEN 'zohaib' THEN 'zohaib@reeltracker.app'
  WHEN 'member-2' THEN 'huzaifa@reeltracker.app'
  WHEN 'member-3' THEN 'hashir@reeltracker.app'
  ELSE tm.email
END;

-- 2. User login audit log table
CREATE TABLE IF NOT EXISTS public.user_login_logs (
  id BIGSERIAL PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  logged_in_pkt TEXT NOT NULL,
  auth_method TEXT NOT NULL DEFAULT 'pin'
);

CREATE INDEX IF NOT EXISTS idx_user_login_logs_member_time
  ON public.user_login_logs (member_id, logged_in_at DESC);

ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.user_login_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_login_logs TO anon, authenticated;

DROP POLICY IF EXISTS "user_login_logs_select_all" ON public.user_login_logs;
CREATE POLICY "user_login_logs_select_all" ON public.user_login_logs
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. Enhance daily_posts with human-readable PKT details
ALTER TABLE public.daily_posts
  ADD COLUMN IF NOT EXISTS member_name TEXT,
  ADD COLUMN IF NOT EXISTS slot_label TEXT,
  ADD COLUMN IF NOT EXISTS slot_window_pkt TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'posted',
  ADD COLUMN IF NOT EXISTS posted_time_pkt TEXT,
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.daily_posts
  DROP CONSTRAINT IF EXISTS daily_posts_status_check;

ALTER TABLE public.daily_posts
  ADD CONSTRAINT daily_posts_status_check CHECK (status IN ('posted', 'late'));

-- 4. Pure PKT helper functions (fixed search_path)
CREATE OR REPLACE FUNCTION public.pkt_slot_label(p_slot INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE p_slot
    WHEN 1 THEN 'Afternoon Student Break'
    WHEN 2 THEN 'Prime Evening (Local + UK)'
    WHEN 3 THEN 'Late Night Viral Slot (US Tier-1)'
    ELSE 'Unknown Slot'
  END;
$$;

CREATE OR REPLACE FUNCTION public.pkt_slot_window_text(p_slot INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE p_slot
    WHEN 1 THEN '2:30 PM – 3:30 PM PKT'
    WHEN 2 THEN '7:30 PM – 8:00 PM PKT'
    WHEN 3 THEN '11:00 PM – 11:59 PM PKT'
    ELSE ''
  END;
$$;

CREATE OR REPLACE FUNCTION public.pkt_slot_end_at(p_post_date DATE, p_slot INTEGER)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE p_slot
    WHEN 1 THEN (p_post_date::timestamp + time '15:30:00') AT TIME ZONE 'Asia/Karachi'
    WHEN 2 THEN (p_post_date::timestamp + time '20:00:00') AT TIME ZONE 'Asia/Karachi'
    WHEN 3 THEN (p_post_date::timestamp + time '23:59:59') AT TIME ZONE 'Asia/Karachi'
    ELSE (p_post_date::timestamp + time '23:59:59') AT TIME ZONE 'Asia/Karachi'
  END;
$$;

CREATE OR REPLACE FUNCTION public.format_pkt_timestamp(p_ts TIMESTAMPTZ)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE
    WHEN p_ts IS NULL THEN NULL
    ELSE to_char(p_ts AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD FMHH12:MI AM') || ' PKT'
  END;
$$;

-- Backfill existing daily_posts rows if any exist
UPDATE public.daily_posts AS dp
SET
  member_name = COALESCE(dp.member_name, tm.name),
  slot_label = COALESCE(dp.slot_label, public.pkt_slot_label(dp.slot)),
  slot_window_pkt = COALESCE(dp.slot_window_pkt, public.pkt_slot_window_text(dp.slot)),
  is_late = (dp.posted_at > public.pkt_slot_end_at(dp.post_date, dp.slot)),
  status = CASE
    WHEN dp.posted_at > public.pkt_slot_end_at(dp.post_date, dp.slot) THEN 'late'
    ELSE 'posted'
  END,
  posted_time_pkt = COALESCE(dp.posted_time_pkt, public.format_pkt_timestamp(dp.posted_at))
FROM public.team_members AS tm
WHERE tm.id = dp.member_id;

-- 5. Separate per-user task tables (Zohaib, Huzaifa, Hashir)
CREATE TABLE IF NOT EXISTS public.zohaib_tasks (
  id TEXT PRIMARY KEY,
  post_date DATE NOT NULL,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
  slot_label TEXT NOT NULL,
  slot_window_pkt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('posted', 'late', 'missed', 'upcoming')),
  posted BOOLEAN NOT NULL DEFAULT false,
  is_late BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ NULL,
  posted_time_pkt TEXT NULL,
  reel_url TEXT NULL,
  caption_ref TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT zohaib_tasks_date_slot_unique UNIQUE (post_date, slot)
);

CREATE TABLE IF NOT EXISTS public.huzaifa_tasks (
  id TEXT PRIMARY KEY,
  post_date DATE NOT NULL,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
  slot_label TEXT NOT NULL,
  slot_window_pkt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('posted', 'late', 'missed', 'upcoming')),
  posted BOOLEAN NOT NULL DEFAULT false,
  is_late BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ NULL,
  posted_time_pkt TEXT NULL,
  reel_url TEXT NULL,
  caption_ref TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT huzaifa_tasks_date_slot_unique UNIQUE (post_date, slot)
);

CREATE TABLE IF NOT EXISTS public.hashir_tasks (
  id TEXT PRIMARY KEY,
  post_date DATE NOT NULL,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
  slot_label TEXT NOT NULL,
  slot_window_pkt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('posted', 'late', 'missed', 'upcoming')),
  posted BOOLEAN NOT NULL DEFAULT false,
  is_late BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ NULL,
  posted_time_pkt TEXT NULL,
  reel_url TEXT NULL,
  caption_ref TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT hashir_tasks_date_slot_unique UNIQUE (post_date, slot)
);

CREATE INDEX IF NOT EXISTS idx_zohaib_tasks_date_slot ON public.zohaib_tasks (post_date DESC, slot ASC);
CREATE INDEX IF NOT EXISTS idx_zohaib_tasks_status ON public.zohaib_tasks (status);

CREATE INDEX IF NOT EXISTS idx_huzaifa_tasks_date_slot ON public.huzaifa_tasks (post_date DESC, slot ASC);
CREATE INDEX IF NOT EXISTS idx_huzaifa_tasks_status ON public.huzaifa_tasks (status);

CREATE INDEX IF NOT EXISTS idx_hashir_tasks_date_slot ON public.hashir_tasks (post_date DESC, slot ASC);
CREATE INDEX IF NOT EXISTS idx_hashir_tasks_status ON public.hashir_tasks (status);

DROP TRIGGER IF EXISTS zohaib_tasks_updated_at ON public.zohaib_tasks;
CREATE TRIGGER zohaib_tasks_updated_at
  BEFORE UPDATE ON public.zohaib_tasks
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

DROP TRIGGER IF EXISTS huzaifa_tasks_updated_at ON public.huzaifa_tasks;
CREATE TRIGGER huzaifa_tasks_updated_at
  BEFORE UPDATE ON public.huzaifa_tasks
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

DROP TRIGGER IF EXISTS hashir_tasks_updated_at ON public.hashir_tasks;
CREATE TRIGGER hashir_tasks_updated_at
  BEFORE UPDATE ON public.hashir_tasks
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.zohaib_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.huzaifa_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashir_tasks ENABLE ROW LEVEL SECURITY;

REVOKE INSERT, UPDATE, DELETE ON public.zohaib_tasks FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.huzaifa_tasks FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.hashir_tasks FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.zohaib_tasks TO anon, authenticated;
GRANT SELECT ON public.huzaifa_tasks TO anon, authenticated;
GRANT SELECT ON public.hashir_tasks TO anon, authenticated;

DROP POLICY IF EXISTS "zohaib_tasks_select_all" ON public.zohaib_tasks;
CREATE POLICY "zohaib_tasks_select_all" ON public.zohaib_tasks
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "huzaifa_tasks_select_all" ON public.huzaifa_tasks;
CREATE POLICY "huzaifa_tasks_select_all" ON public.huzaifa_tasks
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "hashir_tasks_select_all" ON public.hashir_tasks;
CREATE POLICY "hashir_tasks_select_all" ON public.hashir_tasks
  FOR SELECT TO anon, authenticated
  USING (true);

-- 6. Helper to upsert into a specific member's task table
CREATE OR REPLACE FUNCTION public.sync_member_task_row(
  p_member_id TEXT,
  p_post_date DATE,
  p_slot SMALLINT,
  p_status TEXT,
  p_posted BOOLEAN,
  p_is_late BOOLEAN,
  p_posted_at TIMESTAMPTZ,
  p_posted_time_pkt TEXT,
  p_reel_url TEXT,
  p_caption_ref TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_id TEXT := p_post_date::text || '-' || p_slot::text;
  v_label TEXT := public.pkt_slot_label(p_slot);
  v_window TEXT := public.pkt_slot_window_text(p_slot);
BEGIN
  IF p_member_id = 'zohaib' THEN
    INSERT INTO public.zohaib_tasks (
      id, post_date, slot, slot_label, slot_window_pkt,
      status, posted, is_late, posted_at, posted_time_pkt, reel_url, caption_ref
    )
    VALUES (
      v_id, p_post_date, p_slot, v_label, v_window,
      p_status, p_posted, p_is_late, p_posted_at, p_posted_time_pkt, p_reel_url, p_caption_ref
    )
    ON CONFLICT (post_date, slot) DO UPDATE SET
      slot_label = EXCLUDED.slot_label,
      slot_window_pkt = EXCLUDED.slot_window_pkt,
      status = EXCLUDED.status,
      posted = EXCLUDED.posted,
      is_late = EXCLUDED.is_late,
      posted_at = EXCLUDED.posted_at,
      posted_time_pkt = EXCLUDED.posted_time_pkt,
      reel_url = EXCLUDED.reel_url,
      caption_ref = EXCLUDED.caption_ref;
  ELSIF p_member_id = 'member-2' THEN
    INSERT INTO public.huzaifa_tasks (
      id, post_date, slot, slot_label, slot_window_pkt,
      status, posted, is_late, posted_at, posted_time_pkt, reel_url, caption_ref
    )
    VALUES (
      v_id, p_post_date, p_slot, v_label, v_window,
      p_status, p_posted, p_is_late, p_posted_at, p_posted_time_pkt, p_reel_url, p_caption_ref
    )
    ON CONFLICT (post_date, slot) DO UPDATE SET
      slot_label = EXCLUDED.slot_label,
      slot_window_pkt = EXCLUDED.slot_window_pkt,
      status = EXCLUDED.status,
      posted = EXCLUDED.posted,
      is_late = EXCLUDED.is_late,
      posted_at = EXCLUDED.posted_at,
      posted_time_pkt = EXCLUDED.posted_time_pkt,
      reel_url = EXCLUDED.reel_url,
      caption_ref = EXCLUDED.caption_ref;
  ELSIF p_member_id = 'member-3' THEN
    INSERT INTO public.hashir_tasks (
      id, post_date, slot, slot_label, slot_window_pkt,
      status, posted, is_late, posted_at, posted_time_pkt, reel_url, caption_ref
    )
    VALUES (
      v_id, p_post_date, p_slot, v_label, v_window,
      p_status, p_posted, p_is_late, p_posted_at, p_posted_time_pkt, p_reel_url, p_caption_ref
    )
    ON CONFLICT (post_date, slot) DO UPDATE SET
      slot_label = EXCLUDED.slot_label,
      slot_window_pkt = EXCLUDED.slot_window_pkt,
      status = EXCLUDED.status,
      posted = EXCLUDED.posted,
      is_late = EXCLUDED.is_late,
      posted_at = EXCLUDED.posted_at,
      posted_time_pkt = EXCLUDED.posted_time_pkt,
      reel_url = EXCLUDED.reel_url,
      caption_ref = EXCLUDED.caption_ref;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_member_task_row(TEXT, DATE, SMALLINT, TEXT, BOOLEAN, BOOLEAN, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- 7. Update verify_member_pin to record login activity in team_members and user_login_logs
CREATE OR REPLACE FUNCTION public.verify_member_pin(
  p_member_id TEXT,
  p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_hash TEXT;
  v_matched BOOLEAN := FALSE;
  v_member_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_now_pkt TEXT;
BEGIN
  IF p_member_id IS NULL OR p_pin IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT pin_hash
  INTO v_hash
  FROM public.team_member_pins
  WHERE member_id = p_member_id;

  IF v_hash IS NULL THEN
    RETURN FALSE;
  END IF;

  v_matched := (v_hash = public.crypt(btrim(p_pin), v_hash));

  IF v_matched THEN
    v_now_pkt := public.format_pkt_timestamp(v_now);

    UPDATE public.team_members
    SET
      last_login_at = v_now,
      last_login_pkt = v_now_pkt,
      login_count = login_count + 1
    WHERE id = p_member_id
    RETURNING name INTO v_member_name;

    IF v_member_name IS NOT NULL THEN
      INSERT INTO public.user_login_logs (
        member_id,
        member_name,
        logged_in_at,
        logged_in_pkt,
        auth_method
      )
      VALUES (
        p_member_id,
        v_member_name,
        v_now,
        v_now_pkt,
        'pin'
      );
    END IF;
  END IF;

  RETURN v_matched;
END;
$$;

-- 8. Update mark_reel_posted to write rich PKT fields + sync per-user task table
CREATE OR REPLACE FUNCTION public.mark_reel_posted(
  p_post_date DATE,
  p_slot SMALLINT,
  p_member_id TEXT,
  p_reel_url TEXT DEFAULT NULL,
  p_caption_ref TEXT DEFAULT NULL
)
RETURNS public.daily_posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_clean_url TEXT;
  v_clean_caption TEXT;
  v_member_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_slot_label TEXT;
  v_slot_window TEXT;
  v_slot_end TIMESTAMPTZ;
  v_is_late BOOLEAN;
  v_status TEXT;
  v_posted_time_pkt TEXT;
  v_row public.daily_posts;
BEGIN
  IF p_post_date IS NULL THEN
    RAISE EXCEPTION 'Post date is required.';
  END IF;

  IF p_slot IS NULL OR p_slot NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Slot must be 1, 2, or 3.';
  END IF;

  SELECT name INTO v_member_name
  FROM public.team_members
  WHERE id = p_member_id;

  IF v_member_name IS NULL THEN
    RAISE EXCEPTION 'Unknown team member.';
  END IF;

  v_clean_url := NULLIF(btrim(COALESCE(p_reel_url, '')), '');
  IF v_clean_url IS NOT NULL AND v_clean_url !~ '^https?://' THEN
    RAISE EXCEPTION 'Reel URL must start with http:// or https://';
  END IF;

  v_clean_caption := NULLIF(btrim(COALESCE(p_caption_ref, '')), '');

  IF EXISTS (
    SELECT 1
    FROM public.daily_posts
    WHERE post_date = p_post_date
      AND slot = p_slot
      AND member_id = p_member_id
      AND posted = true
  ) THEN
    RAISE EXCEPTION 'You have already marked this slot as posted.';
  END IF;

  v_slot_label := public.pkt_slot_label(p_slot);
  v_slot_window := public.pkt_slot_window_text(p_slot);
  v_slot_end := public.pkt_slot_end_at(p_post_date, p_slot);
  v_is_late := (v_now > v_slot_end);
  v_status := CASE WHEN v_is_late THEN 'late' ELSE 'posted' END;
  v_posted_time_pkt := public.format_pkt_timestamp(v_now);

  INSERT INTO public.daily_posts (
    id,
    post_date,
    slot,
    member_id,
    member_name,
    slot_label,
    slot_window_pkt,
    status,
    posted,
    is_late,
    posted_at,
    posted_time_pkt,
    reel_url,
    caption_ref
  )
  VALUES (
    p_post_date::text || '-' || p_slot::text || '-' || p_member_id,
    p_post_date,
    p_slot,
    p_member_id,
    v_member_name,
    v_slot_label,
    v_slot_window,
    v_status,
    true,
    v_is_late,
    v_now,
    v_posted_time_pkt,
    v_clean_url,
    v_clean_caption
  )
  RETURNING * INTO v_row;

  PERFORM public.sync_member_task_row(
    p_member_id,
    p_post_date,
    p_slot,
    v_status,
    true,
    v_is_late,
    v_now,
    v_posted_time_pkt,
    v_clean_url,
    v_clean_caption
  );

  RETURN v_row;
END;
$$;

-- 9. Update undo_reel_post to remove from daily_posts and revert per-user table row to missed/upcoming
CREATE OR REPLACE FUNCTION public.undo_reel_post(
  p_post_date DATE,
  p_slot SMALLINT,
  p_member_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_deleted_id TEXT;
  v_revert_status TEXT;
BEGIN
  DELETE FROM public.daily_posts
  WHERE post_date = p_post_date
    AND slot = p_slot
    AND member_id = p_member_id
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RAISE EXCEPTION 'Slot is not currently posted by you.';
  END IF;

  v_revert_status := CASE
    WHEN NOW() > public.pkt_slot_end_at(p_post_date, p_slot) THEN 'missed'
    ELSE 'upcoming'
  END;

  PERFORM public.sync_member_task_row(
    p_member_id,
    p_post_date,
    p_slot,
    v_revert_status,
    false,
    false,
    NULL,
    NULL,
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'id', v_deleted_id,
    'postDate', p_post_date::text,
    'slot', p_slot,
    'posted', false,
    'postedBy', NULL,
    'postedAt', NULL,
    'reelUrl', NULL,
    'captionRef', NULL
  );
END;
$$;

-- 10. Sync missed and upcoming slots across all 3 separate per-user tables
CREATE OR REPLACE FUNCTION public.sync_missed_tasks(p_days_back INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_days INTEGER := LEAST(GREATEST(COALESCE(p_days_back, 7), 0), 30);
  v_today_pkt DATE := (NOW() AT TIME ZONE 'Asia/Karachi')::date;
  v_start_date DATE := v_today_pkt - v_days;
  v_day DATE;
  v_slot SMALLINT;
  v_status TEXT;
  v_label TEXT;
  v_window TEXT;
  v_id TEXT;
  v_changed INTEGER := 0;
  v_row_count INTEGER := 0;
  v_dp RECORD;
BEGIN
  -- Ensure any already-posted daily_posts rows are mirrored into per-user tables
  FOR v_dp IN
    SELECT post_date, slot, member_id, status, is_late, posted_at, posted_time_pkt, reel_url, caption_ref
    FROM public.daily_posts
    WHERE posted = true
      AND post_date >= v_start_date
  LOOP
    PERFORM public.sync_member_task_row(
      v_dp.member_id,
      v_dp.post_date,
      v_dp.slot,
      COALESCE(v_dp.status, 'posted'),
      true,
      COALESCE(v_dp.is_late, false),
      v_dp.posted_at,
      v_dp.posted_time_pkt,
      v_dp.reel_url,
      v_dp.caption_ref
    );
  END LOOP;

  -- Populate/update unposted slots as 'missed' or 'upcoming'
  v_day := v_start_date;
  WHILE v_day <= v_today_pkt LOOP
    FOR v_slot IN 1..3 LOOP
      v_id := v_day::text || '-' || v_slot::text;
      v_label := public.pkt_slot_label(v_slot);
      v_window := public.pkt_slot_window_text(v_slot);
      v_status := CASE
        WHEN NOW() > public.pkt_slot_end_at(v_day, v_slot) THEN 'missed'
        ELSE 'upcoming'
      END;

      INSERT INTO public.zohaib_tasks (
        id, post_date, slot, slot_label, slot_window_pkt, status, posted, is_late
      )
      VALUES (v_id, v_day, v_slot, v_label, v_window, v_status, false, false)
      ON CONFLICT (post_date, slot) DO UPDATE
      SET status = EXCLUDED.status,
          slot_label = EXCLUDED.slot_label,
          slot_window_pkt = EXCLUDED.slot_window_pkt
      WHERE public.zohaib_tasks.posted = false
        AND public.zohaib_tasks.status IS DISTINCT FROM EXCLUDED.status;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_changed := v_changed + v_row_count;

      INSERT INTO public.huzaifa_tasks (
        id, post_date, slot, slot_label, slot_window_pkt, status, posted, is_late
      )
      VALUES (v_id, v_day, v_slot, v_label, v_window, v_status, false, false)
      ON CONFLICT (post_date, slot) DO UPDATE
      SET status = EXCLUDED.status,
          slot_label = EXCLUDED.slot_label,
          slot_window_pkt = EXCLUDED.slot_window_pkt
      WHERE public.huzaifa_tasks.posted = false
        AND public.huzaifa_tasks.status IS DISTINCT FROM EXCLUDED.status;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_changed := v_changed + v_row_count;

      INSERT INTO public.hashir_tasks (
        id, post_date, slot, slot_label, slot_window_pkt, status, posted, is_late
      )
      VALUES (v_id, v_day, v_slot, v_label, v_window, v_status, false, false)
      ON CONFLICT (post_date, slot) DO UPDATE
      SET status = EXCLUDED.status,
          slot_label = EXCLUDED.slot_label,
          slot_window_pkt = EXCLUDED.slot_window_pkt
      WHERE public.hashir_tasks.posted = false
        AND public.hashir_tasks.status IS DISTINCT FROM EXCLUDED.status;
      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_changed := v_changed + v_row_count;
    END LOOP;

    v_day := v_day + 1;
  END LOOP;

  RETURN v_changed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_missed_tasks(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_missed_tasks(INTEGER) TO anon, authenticated;

-- Initial sync for the last 7 days + today
SELECT public.sync_missed_tasks(7);
