const COLLECTION = "directory_activity";
const SETTINGS = "directory_settings";
const STATUS_KEY = "offline_alerts";
const TYPES = ["changes", "email", "status"];

function text(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

function write(app, item) {
  const record = new Record(app.findCollectionByNameOrId(COLLECTION));
  record.set("category", item.category);
  record.set("action", text(item.action, 100));
  record.set("actor", text(item.actor, 160) || "System");
  record.set("actor_id", text(item.actorId, 40));
  record.set("target", text(item.target, 180));
  record.set("target_id", text(item.targetId, 250));
  record.set("detail", text(item.detail, 3000));
  app.save(record);
}

function log(app, item) {
  // The underlying action may already have committed or gone out over SMTP.
  try { write(app, item); }
  catch (_) { console.log("[directory activity] could not record " + text(item.action, 100)); }
}

function who(record) {
  if (!record) return { actor: "Public visitor" };
  return {
    actor: record.collection().name === "_superusers" ? "PocketBase administrator" : record.getString("name") || "Directory user",
    actorId: record.id
  };
}

function accountActor(app, id, fallback) {
  if (!id) return { actor: fallback || "System" };
  let user;
  try { user = app.findRecordById("users", id); } catch (_) {}
  return user ? who(user) : { actor: fallback || "Directory user", actorId: id };
}

const names = {
  users: "account", repeaters: "repeater", managed_observers: "observer",
  claims: "repeater claim", observer_claims: "observer claim", prefixes: "prefix reservation",
  maintenance: "maintenance entry", sync_ignore: "sync exclusion"
};

function target(record) {
  const type = record.collection().name;
  const name = record.getString("display_name") || record.getString("observer_name") ||
    record.getString("name") || record.getString("code");
  return { target: name || names[type] || type, targetId: record.id };
}

const visibleValues = ["name", "display_name", "role", "status", "firmware", "code", "verified",
  "show_phone", "show_email", "show_discord", "offline_pause_until"];
const ignored = ["id", "created", "updated", "staff_permissions", "tokenKey", "password"];

function changes(app, old, record, fields) {
  return fields.filter((field) => !ignored.includes(field)).map((field) => {
    const before = old.getString(field), after = record.getString(field);
    if (before === after) return "";
    if (field === "managers") {
      const a = old.getStringSlice(field), b = record.getStringSlice(field);
      const added = b.filter((id) => !a.includes(id)).map((id) => accountActor(app, id).actor);
      const removed = a.filter((id) => !b.includes(id)).map((id) => accountActor(app, id).actor);
      return [added.length ? "Managers added: " + added.join(", ") : "", removed.length ? "Managers removed: " + removed.join(", ") : ""].filter(Boolean).join(". ");
    }
    const label = field.replace(/_/g, " ");
    return visibleValues.includes(field) ? label + ": " + (text(before, 100) || "empty") + " → " + (text(after, 100) || "empty") : label;
  }).filter(Boolean).join(" · ");
}

function recordRequest(e, action) {
  const record = e.record, kind = names[record.collection().name];
  const before = action === "Updated" ? record.original() : null;
  const fields = before ? record.collection().fields.fieldNames() : [];
  e.next();
  try {
    const detail = before ? changes(e.app, before, record, fields) : "";
    if (before && !detail) return;
    const actionLabel = before && ["claims", "observer_claims"].includes(record.collection().name) &&
      record.getString("status") === "declined" ? "Declined" : action;
    log(e.app, { category: "changes", action: actionLabel + " " + kind, ...who(e.auth), ...target(record), detail });
  } catch (_) { console.log("[directory activity] record changes unavailable"); }
}

function setting(app) {
  return app.findRecordsByFilter(SETTINGS, "key = {:key}", "", 1, 0, { key: STATUS_KEY })[0];
}

function sending(app) {
  const row = setting(app);
  return row ? row.getBool("enabled") : $os.getenv("OWNER_OFFLINE_ALERTS") === "send";
}

function setSending(app, auth, enabled, previous) {
  if (typeof enabled !== "boolean" || typeof previous !== "boolean") throw new BadRequestError("Select a status email mode.");
  app.runInTransaction((tx) => {
    const row = setting(tx);
    const before = row ? row.getBool("enabled") : $os.getenv("OWNER_OFFLINE_ALERTS") === "send";
    if (before !== previous) throw new BadRequestError("The status email mode changed. Refresh and try again.");
    if (before === enabled) return;
    const next = row || new Record(tx.findCollectionByNameOrId(SETTINGS));
    next.set("key", STATUS_KEY);
    next.set("enabled", enabled);
    tx.save(next);
    let cancelled = 0;
    if (!enabled) {
      cancelled = tx.db().newQuery("UPDATE owner_mail_deliveries SET status = 'cancelled' WHERE status = 'pending' AND batch IN (SELECT id FROM owner_mail_batches WHERE kind = 'offline')").execute().rowsAffected();
    }
    write(tx, { category: "status", action: enabled ? "Enabled status emails" : "Switched status emails to log only",
      ...who(auth), detail: cancelled ? cancelled + " queued messages cancelled." : "" });
  });
}

function list(app, category, page, query) {
  const params = {};
  const filters = [];
  if (TYPES.includes(category)) { filters.push("category = {:category}"); params.category = category; }
  if (query) {
    filters.push("(actor ~ {:search} || action ~ {:search} || target ~ {:search} || target_id ~ {:search} || actor_id ~ {:search} || detail ~ {:search})");
    params.search = text(query, 100);
  }
  const size = 40;
  const rows = app.findRecordsByFilter(COLLECTION, filters.join(" && "), "-created,-id", size + 1, (page - 1) * size, params);
  return {
    enabled: sending(app), more: rows.length > size,
    events: rows.slice(0, size).map((r) => ({
      created: r.getString("created"), category: r.getString("category"), action: r.getString("action"),
      actor: r.getString("actor"), actorId: r.getString("actor_id"), target: r.getString("target"),
      targetId: r.getString("target_id"), detail: r.getString("detail")
    }))
  };
}

module.exports = { log, who, accountActor, target, recordRequest, sending, setSending, list };
