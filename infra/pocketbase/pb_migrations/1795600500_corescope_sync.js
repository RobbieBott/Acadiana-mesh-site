/// <reference path="../pb_data/types.d.ts" />
// CoreScope sync support: where each repeater came from, and a list of keys
// the sync must not add back (filled when an admin deletes a repeater).

const ADMIN = '@request.auth.role = "admin"';

migrate((app) => {
  const repeaters = app.findCollectionByNameOrId("repeaters");
  if (!repeaters.fields.getByName("source")) {
    repeaters.fields.add(new SelectField({ name: "source", values: ["sheet", "corescope", "manual"], maxSelect: 1 }));
    app.save(repeaters);
    app.db().newQuery("UPDATE repeaters SET source = 'sheet' WHERE source = '' OR source IS NULL").execute();
  }

  const ignore = new Collection({
    type: "base",
    name: "sync_ignore",
    listRule: ADMIN,
    viewRule: ADMIN,
    createRule: ADMIN,
    updateRule: null,
    deleteRule: ADMIN,
    fields: [
      { name: "public_key", type: "text", required: true, max: 64, pattern: "^[0-9a-f]{64}$" },
      { name: "name", type: "text", max: 100 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_sync_ignore_key ON sync_ignore (public_key)"],
  });
  app.save(ignore);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("sync_ignore")); } catch (_) {}
  const repeaters = app.findCollectionByNameOrId("repeaters");
  repeaters.fields.removeByName("source");
  app.save(repeaters);
});
