/// <reference path="../pb_data/types.d.ts" />
// Acadiana Mesh repeater directory: accounts, repeaters, public view,
// reserved prefixes and maintenance log. No secrets or personal data here.

const ADMIN = '@request.auth.role = "admin"';
const SIGNED_IN = '@request.auth.id != ""';
// owner name is mandatory whenever a repeater is created or saved
const OWNER_SET = '((@request.body.owner_name:isset = true && @request.body.owner_name != "") || (@request.body.owner_name:isset = false && owner_name != ""))';

migrate((app) => {
  // ── users (built-in auth collection) ─────────────────────────
  const users = app.findCollectionByNameOrId("users");
  const nameField = users.fields.getByName("name");
  if (nameField) { nameField.required = true; nameField.max = 100; nameField.presentable = true; }
  else users.fields.add(new TextField({ name: "name", required: true, max: 100, presentable: true }));
  users.fields.add(new TextField({ name: "callsign", max: 20 }));
  users.fields.add(new SelectField({ name: "role", values: ["user", "admin"], maxSelect: 1 }));
  users.listRule = SIGNED_IN + ' && (id = @request.auth.id || ' + ADMIN + ')';
  users.viewRule = users.listRule;
  users.createRule = ADMIN;
  users.updateRule = ADMIN + ' || (id = @request.auth.id && @request.body.role:isset = false)';
  users.deleteRule = ADMIN + ' && id != @request.auth.id';
  users.manageRule = ADMIN;
  users.passwordAuth.enabled = true;
  users.otp.enabled = true;
  users.otp.duration = 600;
  users.otp.length = 6;
  users.otp.emailTemplate.subject = "Your {APP_NAME} sign-in code";
  users.otp.emailTemplate.body =
    '<p>Hello,</p>\n' +
    '<p>Your sign-in code for the Acadiana Mesh repeater directory is:</p>\n' +
    '<p style="font-size:24px;letter-spacing:4px"><strong>{OTP}</strong></p>\n' +
    '<p>The code works for 10 minutes. If you didn\'t ask for it, you can ignore this email.</p>\n' +
    '<p>Thanks,<br/>{APP_NAME}</p>';
  users.verificationTemplate.subject = "You've been added to the {APP_NAME} repeater directory";
  users.verificationTemplate.body =
    '<p>Hello,</p>\n' +
    '<p>You\'ve been added as a repeater manager on the Acadiana Mesh repeater directory.</p>\n' +
    '<p>Click below to confirm this email address:</p>\n' +
    '<p><a class="btn" href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}" target="_blank" rel="noopener">Confirm my email</a></p>\n' +
    '<p>Then sign in at <a href="https://acadianamesh.com/repeaters/manage/">acadianamesh.com/repeaters/manage</a> ' +
    'with this email address. We\'ll email you a sign-in code, or you can set a password there.</p>\n' +
    '<p>Thanks,<br/>{APP_NAME}</p>';
  users.resetPasswordTemplate.subject = "Set your {APP_NAME} password";
  app.save(users);

  // ── repeaters ────────────────────────────────────────────────
  const yesNo = (name) => ({ name, type: "select", values: ["Yes", "No"], maxSelect: 1 });
  const text = (name, max) => ({ name, type: "text", max: max || 200 });
  const manages = 'managers.id ?= @request.auth.id';

  const repeaters = new Collection({
    type: "base",
    name: "repeaters",
    listRule: SIGNED_IN + ' && (' + ADMIN + ' || ' + manages + ')',
    viewRule: SIGNED_IN + ' && (' + ADMIN + ' || ' + manages + ')',
    createRule: SIGNED_IN + ' && ' + OWNER_SET + ' && (' + ADMIN +
      ' || (@request.body.managers:length = 1 && @request.body.managers:each = @request.auth.id))',
    updateRule: SIGNED_IN + ' && ' + OWNER_SET + ' && (' + ADMIN +
      ' || (' + manages + ' && @request.body.managers:isset = false))',
    deleteRule: ADMIN,
    fields: [
      { name: "name", type: "text", required: true, max: 100, presentable: true },
      { name: "status", type: "select", required: true, maxSelect: 1,
        values: ["Online", "Offline", "Built Waiting For Install", "Maintenance", "Retired"] },
      text("prefix", 8),
      text("prefix_2byte", 8),
      { name: "public_key", type: "text", max: 64, pattern: "^([0-9a-fA-F]{64})?$" },
      yesNo("prefix_compliant"),
      text("manufacturer"),
      text("model"),
      yesNo("gps_module"),
      text("board_revision"),
      yesNo("screen"),
      text("wifi_bt_antenna"),
      text("firmware"),
      yesNo("powersave"),
      text("agc"),
      { name: "path_hash_bytes", type: "number", onlyInt: true, min: 1, max: 3 },
      text("antenna_height"),
      { name: "install_date", type: "date" },
      text("area"),
      text("power_input"),
      text("battery_type"),
      text("battery_count"),
      text("panel_watts"),
      text("antenna_gain"),
      text("antenna_swr"),
      text("mppt"),
      { name: "notes", type: "text", max: 3000 },
      text("owner_name", 100),
      text("owner_callsign", 20),
      { name: "contact_email", type: "email" },
      text("contact_phone", 40),
      text("contact_discord", 60),
      { name: "show_email", type: "bool" },
      { name: "show_phone", type: "bool" },
      { name: "show_discord", type: "bool" },
      { name: "managers", type: "relation", collectionId: users.id, maxSelect: 99, cascadeDelete: false },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_repeaters_public_key ON repeaters (public_key) WHERE public_key != ''",
    ],
  });
  app.save(repeaters);

  // ── public view: only the contact details each owner chose to show ──
  const pub = new Collection({
    type: "view",
    name: "repeaters_public",
    listRule: "",
    viewRule: "",
    viewQuery:
      "SELECT id, name, status, prefix, prefix_2byte, public_key, prefix_compliant, manufacturer, model, " +
      "gps_module, board_revision, screen, wifi_bt_antenna, firmware, powersave, agc, path_hash_bytes, " +
      "antenna_height, install_date, area, power_input, battery_type, battery_count, panel_watts, " +
      "antenna_gain, antenna_swr, mppt, notes, owner_name, owner_callsign, " +
      "(CASE WHEN show_email THEN contact_email ELSE '' END) AS email, " +
      "(CASE WHEN show_phone THEN contact_phone ELSE '' END) AS phone, " +
      "(CASE WHEN show_discord THEN contact_discord ELSE '' END) AS discord, " +
      "updated FROM repeaters",
  });
  app.save(pub);

  // ── reserved prefixes (public list, admins edit) ─────────────
  const prefixes = new Collection({
    type: "base",
    name: "prefixes",
    listRule: "",
    viewRule: "",
    createRule: ADMIN,
    updateRule: ADMIN,
    deleteRule: ADMIN,
    fields: [
      { name: "code", type: "text", required: true, max: 6, pattern: "^[0-9A-Fa-f]{2,6}$", presentable: true },
      { name: "label", type: "text", max: 120 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(prefixes);

  // ── maintenance log (public read; admins and the repeater's managers write) ──
  const canWrite = SIGNED_IN + ' && (' + ADMIN + ' || repeater.managers.id ?= @request.auth.id)';
  const maintenance = new Collection({
    type: "base",
    name: "maintenance",
    listRule: "",
    viewRule: "",
    createRule: canWrite,
    updateRule: canWrite + ' && (' + ADMIN + ' || @request.body.repeater:isset = false)',
    deleteRule: canWrite,
    fields: [
      { name: "repeater", type: "relation", required: true, collectionId: repeaters.id, maxSelect: 1, cascadeDelete: true },
      { name: "date", type: "date", required: true },
      { name: "notes", type: "text", required: true, max: 2000 },
      { name: "author", type: "text", max: 100 },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(maintenance);
}, (app) => {
  for (const name of ["maintenance", "prefixes", "repeaters_public", "repeaters"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
  const users = app.findCollectionByNameOrId("users");
  for (const f of ["callsign", "role"]) users.fields.removeByName(f);
  const nameField = users.fields.getByName("name");
  if (nameField) nameField.required = false;
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = "";
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";
  users.manageRule = null;
  users.otp.enabled = false;
  app.save(users);
});
