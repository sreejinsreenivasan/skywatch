import { LOCATIONS, buildForecast } from "lib/sky.js";

export const access = "public";
export const methods = ["GET"];

export default async function (req, res) {
  const locationId = String(req.query.location || "minalur").toLowerCase();
  if (!LOCATIONS[locationId]) {
    return res.status(400).json({ error: "Unknown location. Use minalur or peruvanmala." });
  }
  const loc = LOCATIONS[locationId];
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    hourly: "temperature_2m,relative_humidity_2m,dew_point_2m,precipitation_probability,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,visibility,wind_speed_10m,wind_direction_10m",
    daily: "sunrise,sunset",
    forecast_days: "5",
    timezone: "Asia/Kolkata",
    timeformat: "iso8601"
  });
  try {
    const upstream = await fetch("https://api.open-meteo.com/v1/forecast?" + params.toString(), { timeout_ms: 18000 });
    if (!upstream.ok) {
      console.error("Open-Meteo forecast request failed", { status: upstream.status, locationId });
      return res.status(502).json({ error: "Weather provider is temporarily unavailable." });
    }
    const weather = await upstream.json();
    if (!weather.hourly || !weather.hourly.time || !weather.hourly.time.length) {
      return res.status(502).json({ error: "Weather provider returned an incomplete forecast." });
    }
    const forecast = buildForecast(locationId, weather);
    res.setHeader("Cache-Control", "public, max-age=900, stale-while-revalidate=900");
    return res.json(forecast);
  } catch (error) {
    console.error("Forecast error", error?.message || JSON.stringify(error), error?.stack || "", locationId);
    return res.status(502).json({ error: "Could not retrieve the weather forecast. Please retry." });
  }
}