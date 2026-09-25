-- ==============================================================================
-- LETON COFFEE DUMAI — MIGRATION: AUTO MEMBER INACTIVITY & CLEANUP
-- Non-Destructive Migration: Adds status and inactive_at columns to customers table
-- ==============================================================================

-- 1. Add status and inactive_at columns to public.customers table if they don't exist
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS inactive_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Update default status for existing customers if NULL
UPDATE public.customers SET status = 'ACTIVE' WHERE status IS NULL;

-- 3. Create index for fast status and date filtering
CREATE INDEX IF NOT EXISTS idx_customers_status_inactive ON public.customers(status, inactive_at);

-- 4. Ensure leton_content record for member_inactivity_settings default configuration
INSERT INTO public.leton_content (id, content, updated_at)
VALUES (
  'member_inactivity_settings',
  '{"inactivityPeriodDays": 60, "gracePeriodDays": 7, "autoCleanupEnabled": true}'::jsonb,
  NOW()
)
ON CONFLICT (id) DO NOTHING;
