// Adds repeaters whose advertised location is inside the us-la-lft (Lafayette
// area) boundary — the same boundary the Scope Finder uses — to the directory.
// Repeaters that don't advertise a location are skipped. (CoreScope's own
// "LFT" region placement isn't used: it means "heard by our observers", which
// includes repeaters far outside Lafayette.)
// Entries the sync added earlier that are now outside the boundary are removed,
// but only while nobody has touched them (no owner, managers, claims or
// maintenance entries). Runs hourly (corescope_sync.pb.js) and from the admin "Sync now"
// button. It never changes anything an owner or admin entered, except that a
// directory entry whose public key the mesh no longer hears takes the mesh
// key of the one repeater that matches it by reserved 2-byte prefix or name.

const REGION = "us-la-lft";
const BOUNDARY = require(`${__hooks}/lft_boundary.js`);

function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function hasLocation(n) { return typeof n.lat === "number" && typeof n.lon === "number" && !(n.lat === 0 && n.lon === 0); }

function inRegion(n) {
  if (!hasLocation(n)) return false;
  return BOUNDARY.some((poly) => inRing(n.lon, n.lat, poly[0]) && !poly.slice(1).some((hole) => inRing(n.lon, n.lat, hole)));
}

module.exports = function sync(app) {
  const base = ($os.getenv("ANALYZER_URL") || "https://analyzer.acadianamesh.com").replace(/\/$/, "");
  const res = $http.send({ url: base + "/api/nodes?limit=5000", method: "GET", timeout: 60 });
  if (res.statusCode !== 200) throw new Error("analyzer returned HTTP " + res.statusCode);

  const all = ((res.json && res.json.nodes) || [])
    .filter((n) => n.role === "repeater" && /^[0-9a-fA-F]{64}$/.test(n.public_key || ""))
    .map((n) => Object.assign({}, n, { public_key: n.public_key.toLowerCase() }));
  const heard = {};
  all.forEach((n) => { heard[n.public_key] = true; });
  const wanted = all.filter(inRegion);

  const col = app.findCollectionByNameOrId("repeaters");
  const records = app.findAllRecords("repeaters");
  const byKey = {};
  records.forEach((r) => { const k = r.getString("public_key").toLowerCase(); if (k) byKey[k] = r; });
  const ignored = {};
  app.findAllRecords("sync_ignore").forEach((r) => { ignored[r.getString("public_key")] = true; });

  // entries whose key isn't heard on the mesh (or that have no key) can be re-keyed
  const stale = records.filter((r) => !heard[r.getString("public_key").toLowerCase()]);
  const claimed = {};
  const out = { region: REGION, heard_in_region: wanted.length, added: [], rekeyed: [], removed: [], skipped_ignored: 0 };

  // remove untouched auto-added entries that aren't (or are no longer) inside the area
  const wantedKey = {};
  wanted.forEach((n) => { wantedKey[n.public_key] = true; });
  records.forEach((r) => {
    if (r.getString("source") !== "corescope") return;
    const key = r.getString("public_key").toLowerCase();
    if (wantedKey[key]) return;
    if (r.getString("owner_name") || r.getStringSlice("managers").length) return;
    const refs = app.countRecords("claims", $dbx.exp("repeater = {:id}", { id: r.id })) +
      app.countRecords("maintenance", $dbx.exp("repeater = {:id}", { id: r.id }));
    if (refs) return;
    // direct delete so the delete hook doesn't put it on the ignore list
    app.db().newQuery("DELETE FROM repeaters WHERE id = {:id}").bind({ id: r.id }).execute();
    delete byKey[key];
    out.removed.push(r.getString("name"));
  });


  wanted.forEach((n) => {
    const key = n.public_key;
    if (byKey[key]) return;
    if (ignored[key]) { out.skipped_ignored++; return; }

    const matches = stale.filter((r) => {
      if (claimed[r.id]) return false;
      const p2 = r.getString("prefix_2byte").toLowerCase();
      return (/^[0-9a-f]{4}$/.test(p2) && key.indexOf(p2) === 0) || (norm(r.getString("name")) && norm(r.getString("name")) === norm(n.name));
    });
    if (matches.length === 1) {
      const r = matches[0];
      claimed[r.id] = true;
      r.set("public_key", key);
      if (!r.getString("prefix_3byte") || r.getString("prefix_3byte").toLowerCase() !== key.slice(0, 6)) r.set("prefix_3byte", key.slice(0, 6).toUpperCase());
      app.save(r);
      byKey[key] = r;
      out.rekeyed.push(r.getString("name"));
      return;
    }

    const rec = new Record(col);
    const hs = n.hash_size >= 1 && n.hash_size <= 3 ? n.hash_size : 0;
    rec.set("name", String(n.name || ("Repeater " + key.slice(0, 6).toUpperCase())).slice(0, 100));
    rec.set("status", "Online");
    rec.set("public_key", key);
    rec.set("prefix", key.slice(0, 2).toUpperCase());
    rec.set("prefix_2byte", key.slice(0, 4).toUpperCase());
    rec.set("prefix_3byte", key.slice(0, 6).toUpperCase());
    if (hs) rec.set("path_hash_bytes", hs);
    rec.set("source", "corescope");
    app.save(rec);
    byKey[key] = rec;
    out.added.push(rec.getString("name"));
  });

  return out;
};
