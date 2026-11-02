import { db } from "hatchable";
import { buildForecast } from "lib/sky.js";

export const access = "public";
export const methods = ["GET"];

const TTL_SECONDS = 900;
const STALE_SECONDS = 21600;

function cacheKey(loc) {
  return [loc.lat, loc.lon, loc.elevation, loc.timezone, "hourly-v1", "5days"].join("|");
}

export default async function (req, res) {
  const locationId = String(req.query.location || "minalur").toLowerCase();
  const result = await db.query(
    "SELECT id,name,subtitle,latitude,longitude,elevation_m,timezone,is_primary,is_favourite,is_archived,observation_notes,coordinates_verified FROM sky_locations WHERE id = $1 AND is_archived = false",
    [locationId]
  );
  if (!result.rows.length) return res.status(404).json({ error: "Saved location not found or archived." });
  const row = result.rows[0];
  const loc = { id:row.id, name:row.name, subtitle:row.subtitle, lat:Number(row.latitude), lon:Number(row.longitude), elevation:Number(row.elevation_m), timezone:row.timezone };
  const key = cacheKey(loc);

  try {
    const cached = await db.query(
      "SELECT payload, fetched_at, expires_at FROM sky_forecast_cache WHERE cache_key = $1 LIMIT 1",
      [key]
    );
    const hit = cached.rows[0];
    const now = Date.now();
    if (hit && new Date(hit.expires_at).getTime() > now) {
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      res.setHeader("X-Skywatch-Cache", "HIT");
      return res.json(hit.payload);
    }

    const params = new URLSearchParams({
      latitude: String(loc.lat),
      longitude: String(loc.lon),
      elevation: String(loc.elevation),
      hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m",
      daily: "sunrise,sunset",
      forecast_days: "5",
      timezone: loc.timezone,
      timeformat: "iso8601"
    });

    try {
      const upstream = await fetch("https://api.open-meteo.com/v1/forecast?" + params.toString(), { timeout_ms: 18000 });
      if (!upstream.ok) throw new Error("Open-Meteo returned " + upstream.status);
      const weather = await upstream.json();
      if (!weather.hourly || !weather.hourly.time || !weather.hourly.time.length) throw new Error("Incomplete weather response");
      const forecast = buildForecast(loc, weather);
      forecast.provenance = {
        requested: { latitude: loc.lat, longitude: loc.lon, elevation_m: loc.elevation },
        providerGrid: { latitude: weather.latitude ?? null, longitude: weather.longitude ?? null, elevation_m: weather.elevation ?? null },
        generationTimeMs: weather.generationtime_ms ?? null,
        utcOffsetSeconds: weather.utc_offset_seconds ?? null,
        model: weather.model ?? null,
        provider: "Open-Meteo"
      };
      forecast.scoring = {
        version: "sunset-colour-v2",
        weights: { highCloud: 34, midCloud: 8, lowCloud: 28, visibility: 8, precipitationProbability: 12 },
        note: "Weights are normalized over available inputs. This remains a heuristic: cloud optical thickness, gaps, western-horizon position and aerosol optical depth are not measured."
      };
      const fetchedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
      await db.query(
        "INSERT INTO sky_forecast_cache (cache_key,location_id,payload,fetched_at,expires_at) VALUES ($1,$2,$3::jsonb,$4::timestamptz,$5::timestamptz) ON CONFLICT (cache_key) DO UPDATE SET location_id=EXCLUDED.location_id,payload=EXCLUDED.payload,fetched_at=EXCLUDED.fetched_at,expires_at=EXCLUDED.expires_at",
        [key, loc.id, JSON.stringify(forecast), fetchedAt, expiresAt]
      );
      res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
      res.setHeader("X-Skywatch-Cache", "MISS");
      return res.json(forecast);
    } catch (providerError) {
      console.error("Open-Meteo request failed", providerError?.message || String(providerError), locationId);
      if (hit && now - new Date(hit.fetched_at).getTime() <= STALE_SECONDS * 1000) {
        res.setHeader("Cache-Control", "public, max-age=60");
        res.setHeader("X-Skywatch-Cache", "STALE");
        return res.json({ ...hit.payload, cache: { status:"stale", fetchedAt:hit.fetched_at, warning:"Showing the last successful forecast because the weather provider is temporarily unavailable." } });
      }
      return res.status(502).json({ error: "Weather provider is temporarily unavailable and no recent cached forecast exists." });
    }
  } catch (error) {
    console.error("Forecast cache error", error?.message || String(error), locationId);
    return res.status(502).json({ error: "Could not retrieve the weather forecast. Please retry." });
  }
}