/// <reference path="../pb_data/types.d.ts" />
// "Claim this repeater": anyone can ask to manage a repeater; admins approve
// or decline. A claim grants nothing by itself.

const ADMIN = '@request.auth.role = "admin"';

migrate((app) => {
  const repeaters = app.findCollectionByNameOrId("repeaters");
  const users = app.findCollectionByNameOrId("users");
  const claims = new Collection({
    type: "base",
    name: "claims",
    listRule: ADMIN,
    viewRule: ADMIN,
    // anyone may file a claim, but only as "pending" and without the admin-only fields
    createRule: '(@request.body.status:isset = false || @request.body.status = "pending") && ' +
      '@request.body.user:isset = false && @request.body.handled_by:isset = false',
    updateRule: ADMIN,
    deleteRule: ADMIN,
    fields: [
      { name: "repeater", type: "relation", required: true, collectionId: repeaters.id, maxSelect: 1, cascadeDelete: true },
      { name: "name", type: "text", required: true, max: 100 },
      { name: "email", type: "email", required: true },
      { name: "callsign", type: "text", max: 20 },
      { name: "note", type: "text", max: 1000 },
      { name: "status", type: "select", values: ["pending", "approved", "declined"], maxSelect: 1 },
      { name: "user", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "handled_by", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_claims_pending ON claims (repeater, email) WHERE status = 'pending'"],
  });
  app.save(claims);

  // at most 3 claims per IP every 10 minutes
  const s = app.settings();
  const rl = JSON.parse(JSON.stringify(s.rateLimits));
  if (!rl.rules.some((r) => r.label === "claims:create")) {
    rl.rules.push({ label: "claims:create", audience: "", duration: 600, maxRequests: 3 });
    unmarshal({ rateLimits: rl }, s);
    app.save(s);
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("claims")); } catch (_) {}
});
