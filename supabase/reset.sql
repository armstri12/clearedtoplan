-- Reset Script - Run this FIRST to clean up any partial migrations
-- ⚠️ WARNING: This will delete ALL data in the tables!
-- Only run this if you're starting fresh or resetting

-- Drop tables in reverse order (to handle foreign keys)
DROP TABLE IF EXISTS weather_cache CASCADE;
DROP TABLE IF EXISTS flight_sessions CASCADE;
DROP TABLE IF EXISTS aircraft_profiles CASCADE;

-- Note: This does NOT delete users from auth.users
-- Users created via Supabase Auth will remain
