import { db } from "hatchable";
import { LOCATIONS } from "lib/sky.js";

export const access = "public";
export const methods = ["GET", "POST"];

export default async function (req, res) {
  if (req.method === "GET") {
    const location = req.query.location ? String(req.query.location).toLowerCase() : null;
    if (location && !LOCATIONS[location]) return res.status(400).json({ error: "Unknown location." });
    const query = location
      ? await db.query("SELECT id, location, phenomenon, rating, notes, observed_at FROM sky_observations WHERE location = $1 ORDER BY observed_at DESC LIMIT 30", [location])
      : await db.query("SELECT id, location, phenomenon, rating, notes, observed_at FROM sky_observations ORDER BY observed_at DESC LIMIT 30");
    return res.json({ observations: query.rows });
  }

  const body = req.body || {};
  const location = String(body.location || "").toLowerCase();
  const phenomenon = String(body.phenomenon || "");
  const rating = Number(body.rating);
  const notes = String(body.notes || "").trim().slice(0,1200);
  if (!LOCATIONS[location]) return res.status(400).json({ error: "Choose Minalur or Peruvanmala." });
  if (!["sunrise_sunset","twilight","lunar_halo"].includes(phenomenon)) return res.status(400).json({ error: "Choose one of the three Skywatch phenomena." });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be from 1 to 5." });
  const inserted = await db.query(
    "INSERT INTO sky_observations (location, phenomenon, rating, notes) VALUES ($1,$2,$3,$4) RETURNING id, location, phenomenon, rating, notes, observed_at",
    [location, phenomenon, rating, notes]
  );
  return res.status(201).json({ observation: inserted.rows[0] });
}