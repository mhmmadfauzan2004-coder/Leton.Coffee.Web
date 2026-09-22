-- Migration to create the admin_push_tokens table for Firebase Cloud Messaging (FCM)
-- Run this in your Supabase SQL Editor to use a structured table for FCM.
-- The backend has dual-layer support: if this table is created, it will be used.
-- Otherwise, it falls back seamlessly to the 'leton_content' table.

CREATE TABLE IF NOT EXISTS admin_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    outlet_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'outlet_admin',
    device_info TEXT DEFAULT 'unknown',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_outlet ON admin_push_tokens(outlet_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_username ON admin_push_tokens(username);
