-- Migration to create the push_subscriptions table for Leton Coffee CMS Web Push notifications
-- Run this in your Supabase SQL Editor if you wish to use a structured table.
-- The backend has dual-layer support: if this table is created, it will be used. 
-- Otherwise, it falls back seamlessly to the existing 'leton_content' table.

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    username TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'outlet_admin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup by outlet_id and username
CREATE INDEX IF NOT EXISTS idx_push_subs_outlet ON push_subscriptions(outlet_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_username ON push_subscriptions(username);
