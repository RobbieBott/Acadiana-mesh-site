/// <reference path="../pb_data/types.d.ts" />
// New prefix reservations must be at least 2 bytes (4 hex characters).
// Existing 1-byte reservations stay until an admin replaces them.

migrate((app) => {
  const col = app.findCollectionByNameOrId("prefixes");
  const f = col.fields.getByName("code");
  f.pattern = "^[0-9A-Fa-f]{4,6}$";
  f.min = 4;
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("prefixes");
  const f = col.fields.getByName("code");
  f.pattern = "^[0-9A-Fa-f]{2,6}$";
  f.min = 0;
  app.save(col);
});
