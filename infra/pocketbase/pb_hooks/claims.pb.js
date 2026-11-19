/// <reference path="../pb_data/types.d.ts" />
// Repeater claims: new claims are always "pending" and admins get an email;
// admins approve with POST /api/directory/claims/{id}/approve.

onRecordCreate((e) => {
  e.record.set("status", "pending");
  e.record.set("email", e.record.getString("email").trim().toLowerCase());
  e.next();
}, "claims");

onRecordAfterCreateSuccess((e) => {
  try { require(`${__hooks}/claims.js`).notifyAdmins(e.app, e.record); } catch (err) { console.log("[claims] " + err); }
  e.next();
}, "claims");

routerAdd("POST", "/api/directory/claims/{id}/approve", (e) => {
  if (!e.auth || e.auth.getString("role") !== "admin") {
    return e.json(403, { message: "Only admins can approve claims." });
  }
  try {
    return e.json(200, require(`${__hooks}/claims.js`).approve(e.app, e.request.pathValue("id"), e.auth.id));
  } catch (err) {
    return e.json(400, { message: String(err).replace(/^Error: /, "") });
  }
}, $apis.requireAuth("users"));
