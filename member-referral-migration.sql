-- ==============================================================================
-- LETON COFFEE DUMAI — MIGRATION: MEMBER GET MEMBER (REFERRAL SYSTEM)
-- Non-Destructive Migration: Adds referral columns and indexes to public.customers
-- ==============================================================================

-- 1. Add referral columns to public.customers table if they don't exist
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referred_by UUID DEFAULT NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN DEFAULT FALSE;

-- 2. Create index for fast referral code lookups and referrer tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_referral_code ON public.customers(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_referred_by ON public.customers(referred_by);

-- 3. Populate existing customers with unique referral codes if missing
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
BEGIN
  FOR r IN SELECT id FROM public.customers WHERE referral_code IS NULL OR referral_code = '' LOOP
    new_code := 'LET' || UPPER(SUBSTRING(MD5(r.id::text || RANDOM()::text) FROM 1 FOR 6));
    UPDATE public.customers SET referral_code = new_code WHERE id = r.id;
  END LOOP;
END $$;
