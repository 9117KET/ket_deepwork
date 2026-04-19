-- Add identity_statement column to user_settings for Atomic Habits integration.
-- Stores the user's "I am X" identity declaration (James Clear's identity-based habits).
alter table user_settings add column if not exists identity_statement text;
