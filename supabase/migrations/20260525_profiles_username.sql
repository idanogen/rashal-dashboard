-- Add username column to profiles for human-friendly login (admin-managed, no email needed).
-- Existing auth.users still keep their real email; new users get a synthetic email like `{username}@rashal.internal`.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_ci
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
    CHECK (username IS NULL OR username ~ '^[a-zA-Z0-9._-]{3,30}$');

-- Backfill: derive username from email prefix for any existing user that doesn't have one.
UPDATE public.profiles
  SET username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
  WHERE username IS NULL
    AND split_part(email, '@', 1) ~ '^[a-zA-Z0-9._-]{3,30}$';

-- Auto-profile trigger now also persists username from auth user_metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    NULLIF(NEW.raw_user_meta_data->>'username', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
