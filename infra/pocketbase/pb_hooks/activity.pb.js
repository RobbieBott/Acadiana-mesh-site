/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => require(__hooks + "/activity.js").recordRequest(e, "Created"),
  "users", "repeaters", "managed_observers", "claims", "observer_claims", "prefixes", "maintenance", "sync_ignore");
onRecordUpdateRequest((e) => require(__hooks + "/activity.js").recordRequest(e, "Updated"),
  "users", "repeaters", "managed_observers", "claims", "observer_claims", "prefixes", "maintenance", "sync_ignore");
onRecordDeleteRequest((e) => require(__hooks + "/activity.js").recordRequest(e, "Deleted"),
  "users", "repeaters", "managed_observers", "claims", "observer_claims", "prefixes", "maintenance", "sync_ignore");

routerAdd("GET", "/api/directory/activity", (e) => {
  if (!require(__hooks + "/staff_access.js").isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can view activity.");
  const q = e.request.url.query();
  const page = Math.min(10000, Math.max(1, parseInt(q.get("page"), 10) || 1));
  return e.json(200, require(__hooks + "/activity.js").list(e.app, q.get("category"), page, q.get("q")));
}, $apis.requireAuth("users"));

routerAdd("PATCH", "/api/directory/activity/status-emails", (e) => {
  if (!require(__hooks + "/staff_access.js").isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can change status emails.");
  const body = e.requestInfo().body;
  require(__hooks + "/activity.js").setSending(e.app, e.auth, body.enabled, body.previous);
  return e.json(200, { enabled: body.enabled });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/directory/activity/preview-status", (e) => {
  if (!require(__hooks + "/staff_access.js").isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can preview status emails.");
  try {
    const count = require(__hooks + "/owner_offline.js").check(e.app, { preview: true, auth: e.auth });
    return e.json(200, { count });
  } catch (_) {
    throw new BadRequestError("Preview skipped. Recent Lafayette observer and repeater telemetry is required.");
  }
}, $apis.requireAuth("users"));

onRecordRequestPasswordResetRequest((e) => {
  e.next();
  if (!e.auth || !e.record) return;
  const activity = require(__hooks + "/activity.js");
  activity.log(e.app, { category: "changes", action: "Requested password setup or reset", ...activity.who(e.auth), ...activity.target(e.record) });
}, "users");

onRecordConfirmPasswordResetRequest((e) => {
  e.next();
  const activity = require(__hooks + "/activity.js");
  activity.log(e.app, { category: "changes", action: "Completed password setup or reset", ...activity.who(e.record) });
}, "users");

onRecordAuthRequest((e) => {
  e.next();
  if (!["password", "otp", "oauth2"].includes(e.authMethod)) return;
  const activity = require(__hooks + "/activity.js");
  activity.log(e.app, { category: "changes", action: "Signed in", ...activity.who(e.record) });
}, "users");
