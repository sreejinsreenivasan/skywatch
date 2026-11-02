CREATE TABLE sky_observations (
  id BIGSERIAL PRIMARY KEY,
  location TEXT NOT NULL CHECK (location IN ('minalur', 'peruvanmala')),
  phenomenon TEXT NOT NULL CHECK (phenomenon IN ('sunrise_sunset', 'twilight', 'lunar_halo')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  notes TEXT NOT NULL DEFAULT '',
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sky_observations_recent ON sky_observations (observed_at DESC);