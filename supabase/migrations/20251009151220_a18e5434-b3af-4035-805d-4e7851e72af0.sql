-- Create enum for connection status
CREATE TYPE connection_status AS ENUM ('online', 'offline', 'low_battery');

-- Create profiles table for caregiver users
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  blind_user_name TEXT NOT NULL,
  blind_user_device_id TEXT UNIQUE NOT NULL,
  relationship TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create safe zones table
CREATE TABLE public.safe_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius DOUBLE PRECISION NOT NULL DEFAULT 100,
  alert_on_entry BOOLEAN DEFAULT FALSE,
  alert_on_exit BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create location history table
CREATE TABLE public.location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blind_user_device_id TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_checkpoint BOOLEAN DEFAULT FALSE,
  battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
  connection_status connection_status DEFAULT 'online',
  speed DOUBLE PRECISION DEFAULT 0,
  distance_traveled DOUBLE PRECISION DEFAULT 0
);

-- Create index for faster queries
CREATE INDEX idx_location_history_caregiver ON public.location_history(caregiver_id, timestamp DESC);
CREATE INDEX idx_location_history_device ON public.location_history(blind_user_device_id, timestamp DESC);
CREATE INDEX idx_safe_zones_caregiver ON public.safe_zones(caregiver_id);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safe_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for safe_zones
CREATE POLICY "Users can view their own safe zones"
  ON public.safe_zones FOR SELECT
  USING (auth.uid() = caregiver_id);

CREATE POLICY "Users can create their own safe zones"
  ON public.safe_zones FOR INSERT
  WITH CHECK (auth.uid() = caregiver_id);

CREATE POLICY "Users can update their own safe zones"
  ON public.safe_zones FOR UPDATE
  USING (auth.uid() = caregiver_id);

CREATE POLICY "Users can delete their own safe zones"
  ON public.safe_zones FOR DELETE
  USING (auth.uid() = caregiver_id);

-- RLS Policies for location_history
CREATE POLICY "Users can view their own location history"
  ON public.location_history FOR SELECT
  USING (auth.uid() = caregiver_id);

CREATE POLICY "Users can insert location history"
  ON public.location_history FOR INSERT
  WITH CHECK (auth.uid() = caregiver_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for location tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_history;