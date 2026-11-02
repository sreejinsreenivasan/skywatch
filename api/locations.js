import { db } from "hatchable";

export const access = "public";
export const methods = ["GET", "POST", "PUT"];

function validTimezone(value) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date()); return true; }
  catch { return false; }
}
function slug(value) {
  return String(value || "").normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 32) || "location";
}
function validCoordinates(lat, lon) {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

export default async function (req, res) {
  if (req.method === "GET") {
    const includeArchived = String(req.query.archived || "") === "true";
    const result = await db.query(
      "SELECT id,name,subtitle,latitude,longitude,elevation_m,timezone,is_primary,is_favourite,is_archived,observation_notes,coordinates_verified,created_at,updated_at FROM sky_locations " + (includeArchived ? "" : "WHERE is_archived = false ") + "ORDER BY is_primary DESC,is_favourite DESC,name ASC"
    );
    return res.json({ locations: result.rows });
  }

  const body = req.body || {};
  if (req.method === "POST") {
    const name = String(body.name || "").trim().slice(0, 80);
    const subtitle = String(body.subtitle || "").trim().slice(0, 120);
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const elevation = Number(body.elevation_m ?? 0);
    const timezone = String(body.timezone || "Asia/Kolkata").trim();
    if (!name) return res.status(400).json({ error: "Enter a name for this location." });
    if (!validCoordinates(latitude, longitude)) return res.status(400).json({ error: "Latitude must be between −90 and 90 and longitude between −180 and 180." });
    if (!Number.isFinite(elevation) || elevation < -500 || elevation > 9000) return res.status(400).json({ error: "Elevation must be between −500 m and 9,000 m." });
    if (!validTimezone(timezone)) return res.status(400).json({ error: "Enter a valid IANA time zone, for example Asia/Kolkata." });
    const base = slug(body.id || name);
    const id = base + "-" + Date.now().toString(36).slice(-5);
    const favourite = Boolean(body.is_favourite);
    const primary = Boolean(body.is_primary);
    const params = [id,name,subtitle,latitude,longitude,elevation,timezone,primary,favourite,String(body.observation_notes || "").trim().slice(0,1200),Boolean(body.coordinates_verified)];
    if (primary) {
      await db.transaction([
        { sql: "UPDATE sky_locations SET is_primary = false, updated_at = now() WHERE is_primary = true", params: [] },
        { sql: "INSERT INTO sky_locations (id,name,subtitle,latitude,longitude,elevation_m,timezone,is_primary,is_favourite,observation_notes,coordinates_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", params }
      ]);
    } else {
      await db.query("INSERT INTO sky_locations (id,name,subtitle,latitude,longitude,elevation_m,timezone,is_primary,is_favourite,observation_notes,coordinates_verified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", params);
    }
    return res.status(201).json({ location: (await db.query("SELECT * FROM sky_locations WHERE id = $1", [id])).rows[0] });
  }

  const id = String(body.id || "").trim();
  if (!id) return res.status(400).json({ error: "Location id is required." });
  const found = await db.query("SELECT * FROM sky_locations WHERE id = $1", [id]);
  if (!found.rows.length) return res.status(404).json({ error: "Location not found." });
  const current = found.rows[0];
  const action = String(body.action || "update");
  if (action === "primary") {
    await db.transaction([
      { sql: "UPDATE sky_locations SET is_primary = false, updated_at = now() WHERE is_primary = true", params: [] },
      { sql: "UPDATE sky_locations SET is_primary = true, is_archived = false, updated_at = now() WHERE id = $1", params: [id] }
    ]);
  } else if (action === "favourite") {
    await db.query("UPDATE sky_locations SET is_favourite = $2, updated_at = now() WHERE id = $1", [id, body.value === undefined ? !current.is_favourite : Boolean(body.value)]);
  } else if (action === "archive") {
    if (current.is_primary) return res.status(400).json({ error: "Choose another primary location before archiving this one." });
    await db.query("UPDATE sky_locations SET is_archived = true, updated_at = now() WHERE id = $1", [id]);
  } else if (action === "restore") {
    await db.query("UPDATE sky_locations SET is_archived = false, updated_at = now() WHERE id = $1", [id]);
  } else if (action === "update") {
    const name = String(body.name ?? current.name).trim().slice(0,80);
    const subtitle = String(body.subtitle ?? current.subtitle).trim().slice(0,120);
    const latitude = Number(body.latitude ?? current.latitude);
    const longitude = Number(body.longitude ?? current.longitude);
    const elevation = Number(body.elevation_m ?? current.elevation_m);
    const timezone = String(body.timezone ?? current.timezone).trim();
    const notes = String(body.observation_notes ?? current.observation_notes).trim().slice(0,1200);
    if (!name) return res.status(400).json({ error: "Location name cannot be empty." });
    if (!validCoordinates(latitude, longitude)) return res.status(400).json({ error: "Latitude or longitude is outside the valid range." });
    if (!Number.isFinite(elevation) || elevation < -500 || elevation > 9000) return res.status(400).json({ error: "Elevation must be between −500 m and 9,000 m." });
    if (!validTimezone(timezone)) return res.status(400).json({ error: "Enter a valid IANA time zone." });
    await db.query("UPDATE sky_locations SET name=$2,subtitle=$3,latitude=$4,longitude=$5,elevation_m=$6,timezone=$7,observation_notes=$8,coordinates_verified=$9,is_favourite=$10,updated_at=now() WHERE id=$1", [id,name,subtitle,latitude,longitude,elevation,timezone,notes,body.coordinates_verified === undefined ? current.coordinates_verified : Boolean(body.coordinates_verified),body.is_favourite === undefined ? current.is_favourite : Boolean(body.is_favourite)]);
    if (body.is_primary === true) await db.transaction([
      { sql: "UPDATE sky_locations SET is_primary = false, updated_at = now() WHERE is_primary = true", params: [] },
      { sql: "UPDATE sky_locations SET is_primary = true, is_archived = false, updated_at = now() WHERE id = $1", params: [id] }
    ]);
  } else {
    return res.status(400).json({ error: "Unknown location action." });
  }
  return res.json({ location: (await db.query("SELECT * FROM sky_locations WHERE id = $1", [id])).rows[0] });
}