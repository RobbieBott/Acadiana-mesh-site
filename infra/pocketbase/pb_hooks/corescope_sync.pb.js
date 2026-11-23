/// <reference path="../pb_data/types.d.ts" />
// Hourly (and at startup) CoreScope → directory sync, an admin "Sync now" endpoint, and a
// delete hook so a deleted repeater isn't added back by the next sync.

cronAdd("corescope-sync", "17 * * * *", () => {
  try {
    const r = require(`${__hooks}/corescope_sync.js`)($app);
    if (r.added.length || r.rekeyed.length || r.removed.length) console.log("[corescope-sync] added " + r.added.length + ", re-keyed " + r.rekeyed.length + ", removed " + r.removed.length);
  } catch (err) {
    console.log("[corescope-sync] failed: " + err);
  }
});

// also run once when the server starts (so a deploy applies changes right away)
onBootstrap((e) => {
  e.next();
  try {
    const r = require(`${__hooks}/corescope_sync.js`)(e.app);
    console.log("[corescope-sync] startup: " + r.heard_in_region + " in " + r.region + "; added " + r.added.length + ", re-keyed " + r.rekeyed.length + ", removed " + r.removed.length);
  } catch (err) {
    console.log("[corescope-sync] startup sync failed: " + err);
  }
});

routerAdd("POST", "/api/directory/sync", (e) => {
  if (!require(__hooks + "/staff_access.js").has(e.auth, "sync_corescope")) {
    return e.json(403, { message: "CoreScope sync permission is required." });
  }
  try {
    return e.json(200, require(`${__hooks}/corescope_sync.js`)(e.app));
  } catch (err) {
    return e.json(502, { message: "Couldn't reach the analyzer: " + err });
  }
}, $apis.requireAuth("users"));

onRecordAfterDeleteSuccess((e) => {
  const key = e.record.getString("public_key").toLowerCase();
  if (key) {
    let listed = false;
    try { e.app.findFirstRecordByData("sync_ignore", "public_key", key); listed = true; } catch (_) {}
    if (!listed) {
      try {
        const rec = new Record(e.app.findCollectionByNameOrId("sync_ignore"));
        rec.set("public_key", key);
        rec.set("name", e.record.getString("name").slice(0, 100));
        e.app.save(rec);
      } catch (err) {
        console.log("[corescope-sync] ignore-list save failed: " + err);
      }
    }
  }
  e.next();
}, "repeaters");
