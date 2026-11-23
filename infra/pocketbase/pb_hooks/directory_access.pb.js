onRecordValidate((e) => {
  const field = e.record.collection().fields.getByName("staff_permissions");
  if (field) {
    const staff = require(__hooks + "/staff_access.js");
    e.record.set("staff_permissions", staff.encode(staff.effective(e.record)));
  }
  e.next();
}, "users");

/// <reference path="../pb_data/types.d.ts" />
onRecordCreateRequest((e) => {
  if (e.auth && e.auth.collection().name !== "_superusers") {
    if (e.record.getString("role") && e.record.getString("role") !== "user") {
      throw new ForbiddenError("Create a User first. Only the Site Owner can change roles in Permissions.");
    }
    e.record.set("role", "user");
    e.record.set("staff_overrides", {});
    e.record.setVerified(false);
  }
  e.next();
}, "users");

onRecordUpdateRequest((e) => {
  if (e.auth && e.auth.collection().name === "_superusers") return e.next();
  const mail = require(__hooks + "/owner_mail.js");
  if (!e.auth) throw new ForbiddenError("Sign in to manage a directory account.");
  const record = e.record;
  if (["staff_permissions", "staff_overrides"].some((field) =>
      record.getString(field) !== record.original().getString(field))) {
    throw new ForbiddenError("Only the Site Owner can change permissions.");
  }
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
  return e.json(200, { accounts: mail.permissionList(e.app), capabilities: require(__hooks + "/staff_access.js").permissions });
}, $apis.requireAuth("users"));

routerAdd("PATCH", "/api/directory/permissions", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can change permissions.");
  const body = e.requestInfo().body;
  const before = mail.permissionList(e.app).find((row) => row.id === body.id);
  mail.changeAccess(e.app, body.id, body);
  const activity = require(__hooks + "/activity.js");
  const detail = [];
  if (body.role !== undefined && body.role !== before?.role) detail.push("Role: " + before?.role + " → " + body.role);
  if (body.enabled !== undefined && body.enabled !== before?.enabled) detail.push("Owner Emails: " + (body.enabled ? "allowed" : "denied"));
  if (body.overrides !== undefined) {
    const labels = require(__hooks + "/staff_access.js").permissions;
    Object.keys(labels).filter((key) => before?.overrides?.[key] !== body.overrides[key]).forEach((key) => {
      const value = body.overrides[key];
      detail.push(labels[key] + ": " + (value === undefined ? "role default" : value ? "allowed" : "denied"));
    });
  }
  if (detail.length) activity.log(e.app, { category: "changes", action: "Changed account permissions", ...activity.who(e.auth),
    target: before?.name || "Directory account", targetId: body.id, detail: detail.join(" · ") });
  return e.json(200, { accounts: mail.permissionList(e.app), capabilities: require(__hooks + "/staff_access.js").permissions });
}, $apis.requireAuth("users"));

routerAdd("PATCH", "/api/directory/permissions/{id}/email", (e) => {
  const mail = require(__hooks + "/owner_mail.js");
  if (!mail.isOwner(e.auth)) throw new ForbiddenError("Only the Site Owner can change sign-in emails.");
  const id = e.request.pathValue("id");
  const body = e.requestInfo().body;
  if (id === e.auth.id) throw new BadRequestError("Use the account email verification flow for your own account.");
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 200) throw new BadRequestError("Enter a valid email.");
  let target;
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
    target = record.getString("name");
  });
  if (target !== undefined) {
    const activity = require(__hooks + "/activity.js");
    activity.log(e.app, { category: "changes", action: "Changed sign-in email", ...activity.who(e.auth), target, targetId: id });
  }
  return e.json(200, { changed: true });
}, $apis.requireAuth("users"));

onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  const staff = require(__hooks + "/staff_access.js");
  if (auth && auth.collection().name === "users" && (staff.has(auth, "read_people") || staff.has(auth, "edit_people"))) {
    // People can still display contact addresses without the auth-record manage grant.
    e.record.ignoreEmailVisibility(true);
  }
  e.next();
}, "users");

routerAdd("GET", "/api/directory/assignment-people", (e) => {
  const staff = require(__hooks + "/staff_access.js");
  if (!staff.has(e.auth, "assign_repeaters") && !staff.has(e.auth, "assign_observers")) {
    throw new ForbiddenError("Manager assignment permission is required.");
  }
  const records = e.app.findAllRecords("users").map((record) => ({
    id: record.id, name: record.getString("name") || "Directory user", callsign: record.getString("callsign")
  })).sort((a, b) => a.name.localeCompare(b.name));
  return e.json(200, { people: records });
}, $apis.requireAuth("users"));

onRecordUpdateRequest((e) => {
  const staff = require(__hooks + "/staff_access.js");
  if (e.auth && e.auth.collection().name === "_superusers") return e.next();
  const record = e.record;
  const original = record.original();
  const oldManagers = original.getStringSlice("managers");
  const nextManagers = record.getStringSlice("managers");
  const assign = staff.has(e.auth, "assign_repeaters");
  const manages = e.auth && oldManagers.includes(e.auth.id);
  if (!assign && JSON.stringify(oldManagers.slice().sort()) !== JSON.stringify(nextManagers.slice().sort())) {
    throw new ForbiddenError("Repeater manager assignment permission is required.");
  }
  if (assign && !manages && nextManagers.includes(e.auth.id) && !staff.has(e.auth, "edit_repeaters")) {
    throw new ForbiddenError("You cannot assign yourself to a repeater you do not manage.");
  }
  if (!manages && !staff.has(e.auth, "edit_repeaters")) {
    const changes = e.requestInfo().body;
    if (Object.keys(changes).some((field) => !["managers", "managers+", "+managers", "managers-"].includes(field))) {
      throw new ForbiddenError("You can assign managers but cannot edit this listing.");
    }
  }
  if (assign && !record.getString("owner_name") && !original.getString("owner_name") && nextManagers.length) {
      const added = nextManagers.find((id) => !oldManagers.includes(id));
      if (added) {
        const person = e.app.findRecordById("users", added);
        record.set("owner_name", person.getString("name"));
        if (!record.getString("owner_callsign")) record.set("owner_callsign", person.getString("callsign"));
      }
  }
  const profile = record.getString("contact_from");
  if (profile && profile !== original.getString("contact_from") &&
      profile !== e.auth.id && !staff.has(e.auth, "read_people") && !staff.has(e.auth, "edit_people")) {
    throw new ForbiddenError("Only your own profile can be linked.");
  }
  if (Object.prototype.hasOwnProperty.call(e.requestInfo().body, "owner_name") && !record.getString("owner_name")) {
    throw new BadRequestError("The owner name is required.");
  }
  e.next();
}, "repeaters");

onRecordUpdateRequest((e) => require(__hooks + "/staff_access.js").decline(e, "approve_repeater_claims"), "claims");
onRecordUpdateRequest((e) => require(__hooks + "/staff_access.js").decline(e, "approve_observer_claims"), "observer_claims");

onRecordCreateRequest((e) => {
  const staff = require(__hooks + "/staff_access.js");
  const profile = e.record.getString("contact_from");
  if (profile && e.auth && profile !== e.auth.id &&
      !staff.has(e.auth, "read_people") && !staff.has(e.auth, "edit_people")) {
    throw new ForbiddenError("Only your own profile can be linked.");
  }
  e.next();
}, "repeaters");


onRecordEnrich((e) => {
  const auth = e.requestInfo.auth;
  const staff = require(__hooks + "/staff_access.js");
  if (auth && staff.has(auth, "assign_repeaters") &&
      !staff.has(auth, "read_repeaters") && !staff.has(auth, "edit_repeaters") &&
      !e.record.getStringSlice("managers").includes(auth.id)) {
    e.record.hide("contact_email", "contact_phone", "contact_discord", "contact_from");
  }
  e.next();
}, "repeaters");
