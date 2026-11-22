/// <reference path="../pb_data/types.d.ts" />
routerAdd("GET", "/api/directory/owner-mail/access", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  return e.json(200, { owner: mail.isOwner(e.auth), sender: mail.canSend(e.app, e.auth) });
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/directory/owner-mail", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.canSend(e.app, e.auth)) throw new ForbiddenError("Owner email permission is required.");
  return e.json(200, {
    ...mail.catalog(e.app), history: mail.history(e.app),
    mode: $os.getenv("OWNER_OFFLINE_ALERTS") === "send" ? "send" : "log"
  });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/directory/owner-mail/preview", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.canSend(e.app, e.auth)) throw new ForbiddenError("Owner email permission is required.");
  return e.json(200, mail.preview(e.app, e.auth, e.requestInfo().body));
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/directory/owner-mail/send", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.canSend(e.app, e.auth)) throw new ForbiddenError("Owner email permission is required.");
  return e.json(202, mail.queue(e.app, e.auth, e.requestInfo().body));
}, $apis.requireAuth("users"));

routerAdd("GET", "/api/directory/owner-mail/permissions", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can grant email access.");
  return e.json(200, { admins: mail.permissionList(e.app) });
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/directory/owner-mail/permissions", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can grant email access.");
  const body = e.requestInfo().body;
  mail.setPermission(e.app, body.id, body.enabled);
  return e.json(200, { admins: mail.permissionList(e.app) });
}, $apis.requireAuth("users"));

onRecordUpdateRequest((e) => require(__hooks + "/owner_mail.js").protectAccount(e), "users");
onRecordDeleteRequest((e) => require(__hooks + "/owner_mail.js").protectAccount(e), "users");

cronAdd("owner-mail-queue", "* * * * *", () => {
  try { require(__hooks + "/owner_mail.js").processQueue($app); }
  catch (error) { console.log("[owner mail] queue processing failed: " + error); }
});

cronAdd("owner-offline-monitor", "37 * * * *", () => {
  try { require(__hooks + "/owner_offline.js").check($app); }
  catch (error) { console.log("[owner alerts] check skipped: " + error); }
});
