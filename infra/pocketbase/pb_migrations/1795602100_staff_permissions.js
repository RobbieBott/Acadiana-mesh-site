/// <reference path="../pb_data/types.d.ts" />
const permissionNames = [
  "read_repeaters", "edit_repeaters", "assign_repeaters",
  "read_observers", "edit_observers", "assign_observers",
  "read_repeater_claims", "approve_repeater_claims", "read_observer_claims", "approve_observer_claims",
  "read_prefixes", "manage_prefixes", "read_people", "edit_people", "invite_users",
  "manage_maintenance", "sync_corescope", "sync_exclusions"
];
const legacyAdmin = '@request.auth.role = "admin"';
function access(...names) {
  return "(" + names.map((name) => '@request.auth.staff_permissions ?= "' + name + '"').join(" || ") + ")";
}
function replaceRule(collection, field, capabilities) {
  collection[field] = collection[field].split(legacyAdmin).join(access(...capabilities));
}
function listView(collection, capabilities) {
  for (const field of ["listRule", "viewRule"]) replaceRule(collection, field, capabilities);
}

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.fields.add(new JSONField({ name: "staff_overrides", hidden: true, maxSize: 4096 }));
  users.fields.add(new SelectField({ name: "staff_permissions", hidden: true, maxSelect: permissionNames.length, values: permissionNames }));
  listView(users, ["read_people", "edit_people"]);
  replaceRule(users, "createRule", ["invite_users"]);
  replaceRule(users, "updateRule", ["edit_people"]);
  app.save(users);
  app.db().newQuery("UPDATE users SET staff_permissions = {:permissions} WHERE role = 'admin'")
    .bind({ permissions: JSON.stringify(permissionNames) }).execute();

  const repeaters = app.findCollectionByNameOrId("repeaters");
  listView(repeaters, ["read_repeaters", "edit_repeaters", "assign_repeaters"]);
  replaceRule(repeaters, "createRule", ["assign_repeaters"]);
  // The request hook checks the final manager list and restricts assignment-only updates.
  repeaters.updateRule = '@request.auth.id != "" && (' +
    access("edit_repeaters", "assign_repeaters") + ' || managers.id ?= @request.auth.id)';
  // The contact hook enforces which profile can be linked.
  repeaters.deleteRule = access("edit_repeaters", "assign_repeaters", "read_repeaters");
  app.save(repeaters);

  const observers = app.findCollectionByNameOrId("managed_observers");
  listView(observers, ["read_observers", "edit_observers", "assign_observers"]);
  replaceRule(observers, "updateRule", ["edit_observers", "assign_observers"]);
  observers.deleteRule = access("edit_observers", "assign_observers", "read_observers");
  app.save(observers);

  for (const [name, read, approve] of [
    ["claims", "read_repeater_claims", "approve_repeater_claims"],
    ["observer_claims", "read_observer_claims", "approve_observer_claims"]
  ]) {
    const collection = app.findCollectionByNameOrId(name);
    listView(collection, [read, approve]);
    replaceRule(collection, "updateRule", [approve]);
    collection.deleteRule = null;
    app.save(collection);
  }

  const prefixes = app.findCollectionByNameOrId("prefixes");
  listView(prefixes, ["read_prefixes", "manage_prefixes"]);
  for (const field of ["createRule", "updateRule", "deleteRule"]) replaceRule(prefixes, field, ["manage_prefixes"]);
  app.save(prefixes);
  const maintenance = app.findCollectionByNameOrId("maintenance");
  for (const field of ["createRule", "updateRule", "deleteRule"]) replaceRule(maintenance, field, ["manage_maintenance"]);
  app.save(maintenance);
  const ignore = app.findCollectionByNameOrId("sync_ignore");
  listView(ignore, ["sync_exclusions"]);
  for (const field of ["createRule", "deleteRule"]) replaceRule(ignore, field, ["sync_exclusions"]);
  app.save(ignore);
}, (app) => {
  const collectionNames = ["users", "repeaters", "managed_observers", "claims", "observer_claims", "prefixes", "maintenance", "sync_ignore"];
  let collections = collectionNames.map((name) => app.findCollectionByNameOrId(name));
  for (const collection of collections) {
    for (const field of ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]) {
      if (collection[field]) collection[field] = collection[field].replace(/\(@request\.auth\.staff_permissions \?= "[a-z_]+"(?: \|\| @request\.auth\.staff_permissions \?= "[a-z_]+")*\)/g, legacyAdmin);
    }
    if (collection.name === "repeaters") {
      const owner = '((@request.body.owner_name:isset = true && @request.body.owner_name != "") || (@request.body.owner_name:isset = false && owner_name != ""))';
      const link = '(@request.body.contact_from:isset = false || @request.body.contact_from = "" || @request.body.contact_from = @request.auth.id || ' + legacyAdmin + ')';
      collection.updateRule = '(@request.auth.id != "" && ' + owner + ' && (' + legacyAdmin +
        ' || (managers.id ?= @request.auth.id && @request.body.managers:isset = false))) && ' + link;
    }
    if (["claims", "observer_claims"].includes(collection.name)) collection.deleteRule = legacyAdmin;
    app.save(collection);
  }
  const users = collections[0];
  users.fields.removeByName("staff_permissions");
  users.fields.removeByName("staff_overrides");
  app.save(users);
});
