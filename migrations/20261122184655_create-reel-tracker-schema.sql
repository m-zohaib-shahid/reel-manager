-- Reel Tracker schema, security policies, RPCs, seed members, and realtime triggers

CREATE TABLE IF NOT EXISTS public.team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_member_pins (
  member_id TEXT PRIMARY KEY REFERENCES public.team_members(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_posts (
  id TEXT PRIMARY KEY,
  post_date DATE NOT NULL,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2, 3)),
  member_id TEXT NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  posted BOOLEAN NOT NULL DEFAULT true,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reel_url TEXT NULL CHECK (reel_url IS NULL OR reel_url ~ '^https?://'),
  caption_ref TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_posts_date_slot_member_unique UNIQUE (post_date, slot, member_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_posts_date_member
  ON public.daily_posts (post_date, member_id);

CREATE INDEX IF NOT EXISTS idx_daily_posts_member
  ON public.daily_posts (member_id);

DROP TRIGGER IF EXISTS daily_posts_updated_at ON public.daily_posts;
CREATE TRIGGER daily_posts_updated_at
  BEFORE UPDATE ON public.daily_posts
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

DROP TRIGGER IF EXISTS team_member_pins_updated_at ON public.team_member_pins;
CREATE TRIGGER team_member_pins_updated_at
  BEFORE UPDATE ON public.team_member_pins
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_member_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_posts ENABLE ROW LEVEL SECURITY;

-- Grants & policies: team_members (public read only)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.team_members FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.team_members TO anon, authenticated;

DROP POLICY IF EXISTS "team_members_select_all" ON public.team_members;
CREATE POLICY "team_members_select_all" ON public.team_members
  FOR SELECT TO anon, authenticated
  USING (true);

-- Grants: team_member_pins (completely hidden from client roles)
REVOKE ALL ON public.team_member_pins FROM PUBLIC, anon, authenticated;

-- Grants & policies: daily_posts (public read; all writes go through validated RPCs)
REVOKE INSERT, UPDATE, DELETE ON public.daily_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.daily_posts TO anon, authenticated;

DROP POLICY IF EXISTS "daily_posts_select_all" ON public.daily_posts;
CREATE POLICY "daily_posts_select_all" ON public.daily_posts
  FOR SELECT TO anon, authenticated
  USING (true);

-- Seed 3 team members and hashed PINs
INSERT INTO public.team_members (id, name, avatar_color, sort_order)
VALUES
  ('zohaib', 'Zohaib', '#0071e3', 1),
  ('member-2', 'Huzaifa', '#30d158', 2),
  ('member-3', 'Hashir', '#ff9f0a', 3)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    avatar_color = EXCLUDED.avatar_color,
    sort_order = EXCLUDED.sort_order;

INSERT INTO public.team_member_pins (member_id, pin_hash)
VALUES
  ('zohaib', public.crypt('1111', public.gen_salt('bf'))),
  ('member-2', public.crypt('2222', public.gen_salt('bf'))),
  ('member-3', public.crypt('3333', public.gen_salt('bf')))
ON CONFLICT (member_id) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash;

-- RPC: verify 4-digit PIN
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

  RETURN v_hash = public.crypt(btrim(p_pin), v_hash);
END;
$$;

-- RPC: mark slot as posted for a member
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
  v_row public.daily_posts;
BEGIN
  IF p_post_date IS NULL THEN
    RAISE EXCEPTION 'Post date is required.';
  END IF;

  IF p_slot IS NULL OR p_slot NOT IN (1, 2, 3) THEN
    RAISE EXCEPTION 'Slot must be 1, 2, or 3.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.team_members WHERE id = p_member_id) THEN
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

  INSERT INTO public.daily_posts (
    id,
    post_date,
    slot,
    member_id,
    posted,
    posted_at,
    reel_url,
    caption_ref
  )
  VALUES (
    p_post_date::text || '-' || p_slot::text || '-' || p_member_id,
    p_post_date,
    p_slot,
    p_member_id,
    true,
    NOW(),
    v_clean_url,
    v_clean_caption
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- RPC: undo own posted slot
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
BEGIN
  DELETE FROM public.daily_posts
  WHERE post_date = p_post_date
    AND slot = p_slot
    AND member_id = p_member_id
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RAISE EXCEPTION 'Slot is not currently posted by you.';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.verify_member_pin(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_reel_posted(DATE, SMALLINT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.undo_reel_post(DATE, SMALLINT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verify_member_pin(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_reel_posted(DATE, SMALLINT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_reel_post(DATE, SMALLINT, TEXT) TO anon, authenticated;

-- Realtime channel + trigger for live multi-device sync
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('reel-tracker:%', 'Reel Tracker schedule updates', true)
ON CONFLICT (pattern) DO UPDATE
SET description = EXCLUDED.description,
    enabled = EXCLUDED.enabled;

CREATE OR REPLACE FUNCTION public.notify_daily_posts_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM realtime.publish(
    'reel-tracker:posts',
    'posts_changed',
    jsonb_build_object(
      'op', TG_OP,
      'postDate', COALESCE(NEW.post_date, OLD.post_date)::text,
      'slot', COALESCE(NEW.slot, OLD.slot),
      'memberId', COALESCE(NEW.member_id, OLD.member_id)
    )
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS daily_posts_realtime_trigger ON public.daily_posts;
CREATE TRIGGER daily_posts_realtime_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.daily_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_daily_posts_change();
