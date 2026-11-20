/// <reference path="../pb_data/types.d.ts" />
// Let the old 1-byte (2-character) reservations be saved again, so admins can
// rename them. New codes are still checked in pb_hooks/prefixes.pb.js: exactly
// 4 or 6 hex characters, never starting with 00 or FF.
const VALID = "(0[1-9A-Fa-f]|[1-9A-Ea-e][0-9A-Fa-f]|[Ff][0-9A-Ea-e])([0-9A-Fa-f]{2}|[0-9A-Fa-f]{4})";

migrate((app) => {
  const col = app.findCollectionByNameOrId("prefixes");
  const f = col.fields.getByName("code");
  f.pattern = "^([0-9A-Fa-f]{2}|" + VALID + ")$";
  f.min = 2;
  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("prefixes");
  const f = col.fields.getByName("code");
  f.pattern = "^" + VALID + "$";
  f.min = 4;
  app.save(col);
});
