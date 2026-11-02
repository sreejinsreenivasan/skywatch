-- Forecast cache shared by dashboard and regional discovery.
CREATE TABLE IF NOT EXISTS sky_forecast_cache (
  cache_key text PRIMARY KEY,
  location_id text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sky_forecast_cache_expiry_idx
  ON sky_forecast_cache (expires_at);