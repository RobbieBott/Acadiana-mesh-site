/// <reference path="../pb_data/types.d.ts" />
// Anyone can reserve a prefix (name + email required, checked and limited in
// pb_hooks/prefixes.pb.js); people with an account manage their own
// reservations. Who reserved it stays private: the public reads the
// prefixes_public view (code, label, date only).
//
// A prefix is whole bytes: exactly 4 or 6 hex characters. MeshCore treats a
// key whose first byte is 00 or FF as a "reserved id hash" and regenerates it
// (examples/simple_repeater/main.cpp), so those can never be anyone's prefix.

const ADMIN = '@request.auth.role = "admin"';
const CODE = "^(0[1-9A-Fa-f]|[1-9A-Ea-e][0-9A-Fa-f]|[Ff][0-9A-Ea-e])([0-9A-Fa-f]{2}|[0-9A-Fa-f]{4})$";
const OWNER = '(@request.auth.id != "" && (user = @request.auth.id || reserved_by_email = @request.auth.email))';

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const col = app.findCollectionByNameOrId("prefixes");
  if (!col.fields.getByName("reserved_by_name")) {
    col.fields.add(new TextField({ name: "reserved_by_name", max: 100 }));
    col.fields.add(new EmailField({ name: "reserved_by_email" }));
    col.fields.add(new TextField({ name: "reserved_by_callsign", max: 20 }));
    col.fields.add(new RelationField({ name: "user", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
  }
  const code = col.fields.getByName("code");
  code.pattern = CODE;
  code.min = 4;
  col.listRule = ADMIN + " || " + OWNER;
  col.viewRule = col.listRule;
  col.createRule = ADMIN + ' || ((@request.body.user:isset = false || @request.body.user = @request.auth.id) && ' +
    '@request.body.reserved_by_name != "" && @request.body.reserved_by_email != "" && @request.body.label != "")';
  col.updateRule = ADMIN + " || (" + OWNER + ' && @request.body.code:isset = false && @request.body.user:isset = false && ' +
    '@request.body.reserved_by_email:isset = false)';
  col.deleteRule = ADMIN + " || " + OWNER;
  app.save(col);

  const pub = new Collection({
    type: "view",
    name: "prefixes_public",
    listRule: "",
    viewRule: "",
    viewQuery: "SELECT id, code, label, created FROM prefixes",
  });
  app.save(pub);

  // at most 5 reservation attempts per IP every 10 minutes
  const s = app.settings();
  const rl = JSON.parse(JSON.stringify(s.rateLimits));
  if (!rl.rules.some((r) => r.label === "prefixes:create")) {
    rl.rules.push({ label: "prefixes:create", audience: "", duration: 600, maxRequests: 5 });
    unmarshal({ rateLimits: rl }, s);
    app.save(s);
  }
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("prefixes_public")); } catch (_) {}
  const col = app.findCollectionByNameOrId("prefixes");
  for (const f of ["reserved_by_name", "reserved_by_email", "reserved_by_callsign", "user"]) col.fields.removeByName(f);
  col.fields.getByName("code").pattern = "^[0-9A-Fa-f]{4,6}$";
  col.listRule = "";
  col.viewRule = "";
  col.createRule = ADMIN;
  col.updateRule = ADMIN;
  col.deleteRule = ADMIN;
  app.save(col);
});
