/// <reference path="../pb_data/types.d.ts" />
// Owners' email addresses are no longer public. The public view only says
// whether the owner accepts messages ("Message the owner" form, relayed by
// POST /api/directory/message). Phone and Discord are unchanged.

const VIEW_QUERY =
  "SELECT id, name, status, prefix, prefix_2byte, prefix_3byte, public_key, prefix_compliant, manufacturer, model, " +
  "gps_module, gps_model, board_revision, screen, wifi_bt_antenna, firmware, powersave, agc, path_hash_bytes, " +
  "antenna_height, install_date, area, power_input, battery_type, battery_count, panel_watts, " +
  "antenna_gain, antenna_swr, mppt, notes, owner_name, owner_callsign, " +
  "(CASE WHEN show_email AND contact_email != '' THEN 1 ELSE 0 END) AS can_message, " +
  "(CASE WHEN show_phone THEN contact_phone ELSE '' END) AS phone, " +
  "(CASE WHEN show_discord THEN contact_discord ELSE '' END) AS discord, " +
  "updated FROM repeaters";

migrate((app) => {
  const pub = app.findCollectionByNameOrId("repeaters_public");
  pub.viewQuery = VIEW_QUERY;
  app.save(pub);

  // at most 3 messages per IP every 10 minutes
  const s = app.settings();
  const rl = JSON.parse(JSON.stringify(s.rateLimits));
  if (!rl.rules.some((r) => r.label === "POST /api/directory/message")) {
    rl.rules.push({ label: "POST /api/directory/message", audience: "", duration: 600, maxRequests: 3 });
    unmarshal({ rateLimits: rl }, s);
    app.save(s);
  }
}, (app) => {
  const pub = app.findCollectionByNameOrId("repeaters_public");
  pub.viewQuery = VIEW_QUERY.replace(
    "(CASE WHEN show_email AND contact_email != '' THEN 1 ELSE 0 END) AS can_message",
    "(CASE WHEN show_email THEN contact_email ELSE '' END) AS email");
  app.save(pub);
});
