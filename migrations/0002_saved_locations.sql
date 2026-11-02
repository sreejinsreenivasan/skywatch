CREATE TABLE sky_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  elevation_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_favourite BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  observation_notes TEXT NOT NULL DEFAULT '',
  coordinates_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX sky_locations_one_primary ON sky_locations (is_primary) WHERE is_primary = true;
INSERT INTO sky_locations (id,name,subtitle,latitude,longitude,elevation_m,timezone,is_primary,is_favourite,observation_notes,coordinates_verified) VALUES ('minalur','Minalur','Thrissur, Kerala',10.6250,76.2167,25,'Asia/Kolkata',true,true,'Existing Skywatch station. Coordinates and elevation are approximate; verify against the exact observation point.',false);
INSERT INTO sky_locations (id,name,subtitle,latitude,longitude,elevation_m,timezone,is_primary,is_favourite,observation_notes,coordinates_verified) VALUES ('peruvanmala','Peruvanmala','Thrissur, Kerala',10.6219,76.1352,100,'Asia/Kolkata',false,true,'Existing Skywatch observation location. Coordinates and elevation are approximate; verify against the exact observation point.',false);
INSERT INTO sky_locations (id,name,subtitle,latitude,longitude,elevation_m,timezone,is_primary,is_favourite,observation_notes,coordinates_verified) VALUES ('kochi','Kochi','Kerala, India',9.9312,76.2673,0,'Asia/Kolkata',false,false,'Illustrative city-centre coordinates and elevation; replace with the preferred observation point.',false);
ALTER TABLE sky_observations DROP CONSTRAINT IF EXISTS sky_observations_location_check;
CREATE INDEX sky_locations_active_idx ON sky_locations (is_archived, is_primary DESC, name);