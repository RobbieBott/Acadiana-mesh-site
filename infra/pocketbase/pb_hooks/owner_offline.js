const mail = require(__hooks + "/owner_mail.js");
const STATE = "owner_offline_state";
const HOUR = 60 * 60 * 1000;

function timestamp(value, now) {
  const time = Date.parse(value);
  return Number.isFinite(time) && time <= now + 5 * 60 * 1000 ? time : 0;
}

function readFeed(base, path, key) {
  const response = $http.send({ url: base + path, method: "GET", timeout: 15 });
  const data = response.json && response.json[key];
  if (response.statusCode !== 200 || !Array.isArray(data) || !data.length) throw new Error(key + " feed unavailable");
  return data;
}

function snapshot(base, now) {
  const observers = readFeed(base, "/api/observers", "observers");
  const repeaters = readFeed(base, "/api/nodes?limit=5000", "nodes");
  const observerTimes = new Map();
  const repeaterTimes = new Map();
  let regionalObserverTime = 0;
  let latestRepeaterTime = 0;
  for (const row of observers) {
    if (!row || !row.id) continue;
    const time = timestamp(row.last_seen, now);
    observerTimes.set(String(row.id), Math.max(time, (observerTimes.get(String(row.id)) || 0) || 0));
    if (String(row.iata || "").trim().toUpperCase() === "LFT") regionalObserverTime = Math.max(regionalObserverTime, time);
  }
  for (const row of repeaters) {
    if (!row || row.role !== "repeater" || !row.public_key) continue;
    const time = Math.max(timestamp(row.last_heard, now), timestamp(row.last_seen, now));
    const id = String(row.public_key).toLowerCase();
    repeaterTimes.set(id, Math.max(time, repeaterTimes.get(id) || 0));
    latestRepeaterTime = Math.max(latestRepeaterTime, time);
  }
  if (now - regionalObserverTime >= 2 * HOUR || now - latestRepeaterTime >= 2 * HOUR) {
    throw new Error("recent Lafayette observer status and repeater activity are required");
  }
  return { observer: observerTimes, repeater: repeaterTimes };
}

function check(app) {
  const now = Date.now();
  const sending = $os.getenv("OWNER_OFFLINE_ALERTS") === "send";
  const base = ($os.getenv("ANALYZER_URL") || "https://analyzer.acadianamesh.com").replace(/\/$/, "");
  const times = snapshot(base, now);
  const collection = app.findCollectionByNameOrId(STATE);
  const list = mail.devices(app);
  const owners = mail.verifiedOwners(app, list);
  const events = [];
  app.runInTransaction((tx) => {
    for (const device of list) {
      const record = device.record;
      const identity = device.type === "repeater" ? record.getString("public_key").toLowerCase() : record.getString("observer_id");
      if (!identity) continue;
      const observed = times[device.type].get(identity) || 0;
      const current = mail.one(tx, STATE, "device = {:device}", { device: device.id });
      const same = current && current.getString("identity") === identity;
      const previous = same ? timestamp(current.getString("last_seen"), now) : 0;
      const last = Math.max(observed, previous);
      if (!last) continue;
      const row = current || new Record(collection);
      let notified = !!(same && current.getBool("notified"));
      if (observed > previous && now - observed < 24 * HOUR) notified = false;
      const paused = Date.parse(record.getString("offline_pause_until")) > now;
      const inactive = device.type === "repeater" &&
        ["Maintenance", "Retired", "Built Waiting For Install"].includes(record.getString("status"));
      const emails = Array.from(new Set(device.managers.map((id) => owners.get(id)?.email).filter(Boolean)));
      const alert = !notified && now - last >= 24 * HOUR && !paused && !inactive && emails.length;
      if (alert) {
        const label = device.type === "repeater" ? "Repeater" : "Observer";
        if (sending) {
          const notice = {
            subject: label + " not heard for 24 hours: " + device.name.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 108),
            message: device.name + " has not reported " + (device.type === "observer" ? "its status" : "activity") +
              " to the Acadiana Mesh analyzer for at least 24 hours.\n\nLast report: " +
              new Date(last).toISOString().replace("T", " ").slice(0, 16) + " UTC.\n\nPlease check the device when you can.",
            template: "offline"
          };
          mail.addBatch(tx, device.id + ":" + last, "offline", notice, {
            scope: device.type, emails, targets: [{ id: device.id, name: device.name }]
          });
        }
        events.push(device.id);
        notified = true;
      }
      if (!same || last !== previous || notified !== current.getBool("notified")) {
        row.set("device", device.id);
        row.set("identity", identity);
        row.set("last_seen", new Date(last).toISOString());
        row.set("notified", notified);
        tx.save(row);
      }
    }
  });
  events.forEach((id) => console.log("[owner alerts] " + (sending ? "queued " : "dry run: would alert for ") + id));
}

module.exports = { check };
