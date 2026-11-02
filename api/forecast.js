import { db } from "hatchable";
import { buildForecast } from "lib/sky.js";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  const locationId = String(req.query.location || "minalur").toLowerCase();
  const result = await db.query("SELECT id,name,subtitle,latitude,longitude,elevation_m,timezone,is_primary,is_favourite,is_archived,observation_notes,coordinates_verified FROM sky_locations WHERE id = $1 AND is_archived = false", [locationId]);
  if (!result.rows.length) return res.status(404).json({ error: "Saved location not found or archived." });
  const row = result.rows[0];
  const loc = { id:row.id, name:row.name, subtitle:row.subtitle, lat:Number(row.latitude), lon:Number(row.longitude), elevation:Number(row.elevation_m), timezone:row.timezone };
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m",
    daily: "sunrise,sunset",
    forecast_days: "5",
    timezone: loc.timezone,
    timeformat: "iso8601"
  });
  try {
    const upstream = await fetch("https://api.open-meteo.com/v1/forecast?" + params.toString(), { timeout_ms: 18000 });
    if (!upstream.ok) {
      console.error("Open-Meteo forecast request failed", { status: upstream.status, locationId });
      return res.status(502).json({ error: "Weather provider is temporarily unavailable." });
    }
    const weather = await upstream.json();
    if (!weather.hourly || !weather.hourly.time || !weather.hourly.time.length) return res.status(502).json({ error: "Weather provider returned an incomplete forecast." });
    const forecast = buildForecast(loc, weather);
    res.setHeader("Cache-Control", "public, max-age=900, stale-while-revalidate=900");
    return res.json(forecast);
  } catch (error) {
    console.error("Forecast error", error?.message || JSON.stringify(error), error?.stack || "", locationId);
    return res.status(502).json({ error: "Could not retrieve the weather forecast. Please retry." });
  }
}