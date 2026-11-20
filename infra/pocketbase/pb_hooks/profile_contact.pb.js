/// <reference path="../pb_data/types.d.ts" />
// Repeaters with contact_from set show that account's profile as their
// owner/contact info. On save, copy it in; when the profile changes, update
// every repeater that follows it. (Visibility ticks stay per repeater.)

onRecordCreateRequest((e) => {
  const uid = e.record.getString("contact_from");
  if (uid) {
    try { require(`${__hooks}/profile_contact.js`).apply(e.record, e.app.findRecordById("users", uid)); } catch (_) {}
  }
  e.next();
}, "repeaters");

onRecordUpdateRequest((e) => {
  const uid = e.record.getString("contact_from");
  if (uid) {
    try { require(`${__hooks}/profile_contact.js`).apply(e.record, e.app.findRecordById("users", uid)); } catch (_) {}
  }
  e.next();
}, "repeaters");

onRecordAfterUpdateSuccess((e) => {
  const user = e.record;
  const { apply } = require(`${__hooks}/profile_contact.js`);
  let reps = [];
  try { reps = e.app.findRecordsByFilter("repeaters", "contact_from = {:id}", "", 0, 0, { id: user.id }); } catch (_) {}
  for (const rep of reps) {
    apply(rep, user);
    try { e.app.save(rep); } catch (err) { console.log("[profile] couldn't update " + rep.getString("name") + ": " + err); }
  }
  e.next();
}, "users");
