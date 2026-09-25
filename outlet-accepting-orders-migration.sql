-- ==============================================================================
-- LETON COFFEE DUMAI — MIGRATION: OUTLET ORDER AVAILABILITY
-- Source of Truth: public.leton_content (Row ID: 'default')
-- Non-Destructive Migration: Adds accepting_orders (default: true) to production
-- ==============================================================================

-- 1. Pastikan tabel leton_content ada dan terkonfigurasi dengan benar
CREATE TABLE IF NOT EXISTS public.leton_content (
  id TEXT PRIMARY KEY DEFAULT 'default',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Update status ketersediaan outlet di dalam public.leton_content (id: 'default')
--    Menambahkan mapping `outletAvailability` dan field `accepting_orders = true`
--    pada masing-masing branch (Chapter 5 Sudirman, Chapter 6 Ratu Sima / Kelakap 7, dan Let'GO MPP)
UPDATE public.leton_content
SET 
  content = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(content, '{}'::jsonb),
        '{outletAvailability}',
        COALESCE(
          content->'outletAvailability',
          '{"sudirman": true, "kelakap_7": true, "letgo-mpp": true}'::jsonb
        ),
        true
      ),
      '{branches,0,accepting_orders}',
      COALESCE(content->'branches'->0->'accepting_orders', 'true'::jsonb),
      true
    ),
    '{branches,1,accepting_orders}',
    COALESCE(content->'branches'->1->'accepting_orders', 'true'::jsonb),
    true
  ),
  updated_at = NOW()
WHERE id = 'default';

-- 3. Pastikan realtime enabled untuk tabel leton_content (jika belum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'leton_content'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leton_content;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if already added or restricted
    NULL;
END $$;
