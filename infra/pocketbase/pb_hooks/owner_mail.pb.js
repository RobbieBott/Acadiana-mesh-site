/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/directory/owner-mail/access", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  return e.json(200, { owner: mail.isOwner(e.auth), sender: mail.canSend(e.app, e.auth), staff: require(__hooks + "/staff_access.js").effective(e.auth) });
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/directory/owner-mail", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.canSend(e.app, e.auth)) throw new ForbiddenError("Owner email permission is required.");
  return e.json(200, {
    ...mail.catalog(e.app), history: mail.history(e.app),
    mode: require(__hooks + "/activity.js").sending(e.app) ? "send" : "log"
  });
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/directory/owner-mail/templates", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.canSend(e.app, e.auth)) throw new ForbiddenError("Owner email permission is required.");
  return e.json(200, mail.templateSamples());
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/directory/owner-mail/preview", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.canSend(e.app, e.auth)) throw new ForbiddenError("Owner email permission is required.");
  return e.json(200, mail.preview(e.app, e.auth, e.requestInfo().body));
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/directory/owner-mail/send", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.canSend(e.app, e.auth)) throw new ForbiddenError("Owner email permission is required.");
  const result = mail.queue(e.app, e.auth, e.requestInfo().body);
  const activity = require(__hooks + "/activity.js");
  activity.log(e.app, { category: "changes", action: "Queued owner notice", ...activity.who(e.auth), targetId: result.id });
  return e.json(202, result);
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/directory/owner-mail/permissions", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can grant email access.");
  return e.json(200, { admins: mail.permissionList(e.app).filter((row) => row.role === "admin" && row.verified && !row.owner) });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/directory/owner-mail/permissions", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can grant email access.");
  const body = e.requestInfo().body;
  if (typeof body.enabled !== "boolean") throw new BadRequestError("Select an email permission.");
  mail.changeAccess(e.app, body.id, { enabled: body.enabled });
  const activity = require(__hooks + "/activity.js");
  activity.log(e.app, { category: "changes", action: "Changed Owner Emails permission", ...activity.who(e.auth),
    target: activity.accountActor(e.app, body.id).actor, targetId: body.id, detail: body.enabled ? "Allowed" : "Denied" });
  return e.json(200, { admins: mail.permissionList(e.app).filter((row) => row.role === "admin" && row.verified && !row.owner) });
}, $apis.requireAuth("users"));

cronAdd("owner-mail-queue", "* * * * *", () => {
  try { require(__hooks + "/owner_mail.js").processQueue($app); }
  catch (error) { console.log("[owner mail] queue processing failed: " + error); }
});

cronAdd("owner-offline-monitor", "37 * * * *", () => {
  try { require(__hooks + "/owner_offline.js").check($app); }
  catch (error) { console.log("[owner alerts] check skipped: " + error); }
});
