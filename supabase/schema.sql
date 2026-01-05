-- Cleared to Plan Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- AIRCRAFT PROFILES TABLE
-- =====================================================
CREATE TABLE aircraft_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Basic info
  name TEXT NOT NULL,
  tail_number TEXT,
  aircraft_type TEXT,

  -- Empty weight & CG
  empty_weight_lb NUMERIC,
  empty_cg_in NUMERIC,

  -- Weight limits
  max_gross_weight_lb NUMERIC,
  max_ramp_weight_lb NUMERIC,

  -- Stations (array of station objects)
  stations JSONB DEFAULT '[]'::jsonb,

  -- CG Envelope (array of {weight, cgMin, cgMax} points)
  cg_envelope JSONB DEFAULT '[]'::jsonb,

  -- Performance data
  performance_data JSONB DEFAULT '{}'::jsonb,

  -- Fuel data
  fuel_capacity_gal NUMERIC,
  usable_fuel_gal NUMERIC,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT aircraft_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX idx_aircraft_profiles_user_id ON aircraft_profiles(user_id);

-- Row Level Security (RLS)
ALTER TABLE aircraft_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own aircraft profiles
CREATE POLICY "Users can view own aircraft profiles"
  ON aircraft_profiles FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own aircraft profiles
CREATE POLICY "Users can insert own aircraft profiles"
  ON aircraft_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own aircraft profiles
CREATE POLICY "Users can update own aircraft profiles"
  ON aircraft_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own aircraft profiles
CREATE POLICY "Users can delete own aircraft profiles"
  ON aircraft_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- FLIGHT SESSIONS TABLE
-- =====================================================
CREATE TABLE flight_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Session info
  name TEXT NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,

  -- Associated aircraft
  aircraft_profile_id UUID REFERENCES aircraft_profiles(id) ON DELETE SET NULL,

  -- Workflow completion tracking
  completed_steps JSONB DEFAULT '{
    "aircraft": false,
    "weightBalance": false,
    "performance": false,
    "weather": false,
    "navlog": false
  }'::jsonb,

  -- Session data (stores all the flight planning data)
  session_data JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  route TEXT,
  departure_icao TEXT,
  destination_icao TEXT,
  departure_time TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT flight_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_flight_sessions_user_id ON flight_sessions(user_id);
CREATE INDEX idx_flight_sessions_is_current ON flight_sessions(user_id, is_current);
CREATE INDEX idx_flight_sessions_departure ON flight_sessions(departure_icao);
CREATE INDEX idx_flight_sessions_destination ON flight_sessions(destination_icao);

-- Row Level Security
ALTER TABLE flight_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view own sessions"
  ON flight_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON flight_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own sessions"
  ON flight_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions"
  ON flight_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- WEATHER CACHE TABLE (Optional - for caching)
-- =====================================================
CREATE TABLE weather_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  icao TEXT NOT NULL,
  metar_data JSONB,
  taf_data JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  CONSTRAINT unique_icao UNIQUE (icao)
);

-- Index for ICAO lookups
CREATE INDEX idx_weather_cache_icao ON weather_cache(icao);
CREATE INDEX idx_weather_cache_expires ON weather_cache(expires_at);

-- No RLS needed - weather is public data
-- Auto-cleanup old cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_weather()
RETURNS void AS $$
BEGIN
  DELETE FROM weather_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for aircraft_profiles
CREATE TRIGGER update_aircraft_profiles_updated_at
  BEFORE UPDATE ON aircraft_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for flight_sessions
CREATE TRIGGER update_flight_sessions_updated_at
  BEFORE UPDATE ON flight_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one current session per user
CREATE OR REPLACE FUNCTION ensure_single_current_session()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a session as current, unset all others for this user
  IF NEW.is_current = TRUE THEN
    UPDATE flight_sessions
    SET is_current = FALSE
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for single current session
CREATE TRIGGER ensure_single_current_session_trigger
  BEFORE INSERT OR UPDATE ON flight_sessions
  FOR EACH ROW
  WHEN (NEW.is_current = TRUE)
  EXECUTE FUNCTION ensure_single_current_session();

-- =====================================================
-- SAMPLE QUERIES (for reference)
-- =====================================================

-- Get user's current session
-- SELECT * FROM flight_sessions
-- WHERE user_id = auth.uid() AND is_current = TRUE;

-- Get all sessions for a user
-- SELECT * FROM flight_sessions
-- WHERE user_id = auth.uid()
-- ORDER BY updated_at DESC;

-- Get all aircraft profiles for a user
-- SELECT * FROM aircraft_profiles
-- WHERE user_id = auth.uid()
-- ORDER BY name;

-- Get cached weather for an airport
-- SELECT * FROM weather_cache
-- WHERE icao = 'KJFK' AND expires_at > NOW();
