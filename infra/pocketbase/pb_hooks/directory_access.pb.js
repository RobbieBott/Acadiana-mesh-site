/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => {
  if (e.auth && e.auth.collection().name !== "_superusers") {
    if (e.record.getString("role") && e.record.getString("role") !== "user") {
      throw new ForbiddenError("Create a User first. Only the Site Owner can change roles in Permissions.");
    }
    e.record.set("role", "user");
    e.record.setVerified(false);
  }
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  if (e.auth && e.auth.collection().name === "_superusers") return e.next();
  const mail = require(__hooks + "/owner_mail.js");
  if (!e.auth) throw new ForbiddenError("Sign in to manage a directory account.");
  const record = e.record;
  if (record.getString("role") !== record.original().getString("role")) {
    throw new ForbiddenError("Only the Site Owner can change roles in Permissions.");
  }
  if (e.auth.id !== record.id) {
    if (record.id === $os.getenv("DIRECTORY_SITE_OWNER_ID")) {
      throw new ForbiddenError("Only the Site Owner can edit their account.");
    }
    const changes = e.requestInfo().body;
    const profileFields = ["name", "callsign", "phone", "discord"];
    if (Object.keys(changes).some((field) => !profileFields.includes(field))) {
      throw new ForbiddenError("Only directory profile fields can be edited here.");
    }
    if (!mail.isOwner(e.auth) && mail.one(e.app, "owner_mail_permissions", "user = {:id}", { id: record.id })) {
      throw new ForbiddenError("Only the Site Owner can edit this account.");
    }
  }
  e.next();
}, "users");

onRecordDeleteRequest((e) => {
  if (e.auth && e.auth.collection().name === "_superusers") return e.next();
  if (!require(__hooks + "/owner_mail.js").isOwner(e.auth)) {
    throw new ForbiddenError("Only the Site Owner can permanently delete directory accounts or listings.");
  }
  e.next();
}, "users", "repeaters", "managed_observers");

routerAdd("GET", "/api/directory/permissions", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can view permissions.");
  return e.json(200, { accounts: mail.permissionList(e.app) });
}, $apis.requireAuth("users"));

routerAdd("PATCH", "/api/directory/permissions", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can change permissions.");
  const body = e.requestInfo().body;
  mail.changeAccess(e.app, body.id, body);
  return e.json(200, { accounts: mail.permissionList(e.app) });
}, $apis.requireAuth("users"));

routerAdd("PATCH", "/api/directory/permissions/{id}/email", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can change sign-in emails.");
  const id = e.request.pathValue("id");
  const body = e.requestInfo().body;
  if (id === e.auth.id) throw new BadRequestError("Use the account email verification flow for your own account.");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 200) throw new BadRequestError("Enter a valid email.");
  e.app.runInTransaction((tx) => {
    const record = tx.findRecordById("users", id);
    if (record.email() !== body.previousEmail) throw new BadRequestError("The email changed. Reopen the account and try again.");
    if (record.email().toLowerCase() === email) return;
    // Do not carry an old credential or verified status to the new mailbox.
    record.setEmail(email);
    record.setVerified(false);
    record.setPassword($security.randomString(48));
    record.set("tokenKey", $security.randomString(50));
    tx.save(record);
  });
  return e.json(200, { changed: true });
}, $apis.requireAuth("users"));

onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  if (auth && auth.collection().name === "users" && auth.getString("role") === "admin") {
    // People can still display contact addresses without the auth-record manage grant.
    e.record.ignoreEmailVisibility(true);
  }
  e.next();
}, "users");
