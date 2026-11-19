// Adds repeaters that CoreScope (the analyzer) places in the LFT region to the
// directory. Runs hourly (corescope_sync.pb.js) and from the admin "Sync now"
// button. It never changes anything an owner or admin entered, except that a
// directory entry whose public key the mesh no longer hears takes the mesh
// key of the one repeater that matches it by reserved 2-byte prefix or name.

const REGION = "LFT";

function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

function inRegion(n) {
  const p = n.region_placement || {};
  return (p.regions || []).indexOf(REGION) >= 0;
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
  const out = { region: REGION, heard_in_region: wanted.length, added: [], rekeyed: [], skipped_ignored: 0 };

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
