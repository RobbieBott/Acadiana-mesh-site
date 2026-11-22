/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Null API rules keep addresses, message history, and permissions on the server.
  const text = (name, max, required = true) => ({ name, type: "text", max, required });
  const date = (name) => ({ name, type: "date" });
  const users = app.findCollectionByNameOrId("users");
  const relation = (name, collectionId) => ({ name, type: "relation", collectionId, maxSelect: 1 });
  function create(name, fields, indexes) {
    const collection = new Collection({ name, type: "base", fields, indexes });
    app.save(collection);
    return collection;
  }
  create("owner_mail_permissions", [relation("user", users.id)], [
    "CREATE UNIQUE INDEX idx_owner_mail_permission ON owner_mail_permissions (user)"
  ]);
  const batches = create("owner_mail_batches", [
    text("request_key", 150), text("kind", 20), text("subject", 150), text("message", 5000),
    text("template", 20), relation("sender", users.id), text("audience", 40),
    { name: "device_labels", type: "json", maxSize: 262144 },
    { name: "created", type: "autodate", onCreate: true }
  ], ["CREATE UNIQUE INDEX idx_owner_mail_request ON owner_mail_batches (request_key)"]);
  create("owner_mail_deliveries", [
    relation("batch", batches.id), { name: "email", type: "email", required: true },
    text("status", 20), date("attempted_at")
  ], [
    "CREATE UNIQUE INDEX idx_owner_mail_batch_address ON owner_mail_deliveries (batch, email)",
    "CREATE INDEX idx_owner_mail_delivery_status ON owner_mail_deliveries (status)"
  ]);
  create("owner_offline_state", [
    text("device", 40), text("identity", 250), date("last_seen"), { name: "notified", type: "bool" }
  ], ["CREATE UNIQUE INDEX idx_owner_offline_device ON owner_offline_state (device)"]);
  for (const name of ["repeaters", "managed_observers"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.add(new DateField({ name: "offline_pause_until" }));
    app.save(collection);
  }
}, (app) => {
  for (const name of ["repeaters", "managed_observers"]) {
    const collection = app.findCollectionByNameOrId(name);
    collection.fields.removeByName("offline_pause_until");
    app.save(collection);
  }
  for (const name of ["owner_offline_state", "owner_mail_deliveries", "owner_mail_batches", "owner_mail_permissions"]) {
    app.delete(app.findCollectionByNameOrId(name));
  }
});
