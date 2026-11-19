/// <reference path="../pb_data/types.d.ts" />
// Adds the GPS module model (e.g. ATGM336H, L76K) to repeaters and the public view.

const VIEW_QUERY =
  "SELECT id, name, status, prefix, prefix_2byte, prefix_3byte, public_key, prefix_compliant, manufacturer, model, " +
  "gps_module, gps_model, board_revision, screen, wifi_bt_antenna, firmware, powersave, agc, path_hash_bytes, " +
  "antenna_height, install_date, area, power_input, battery_type, battery_count, panel_watts, " +
  "antenna_gain, antenna_swr, mppt, notes, owner_name, owner_callsign, " +
  "(CASE WHEN show_email THEN contact_email ELSE '' END) AS email, " +
  "(CASE WHEN show_phone THEN contact_phone ELSE '' END) AS phone, " +
  "(CASE WHEN show_discord THEN contact_discord ELSE '' END) AS discord, " +
  "updated FROM repeaters";

migrate((app) => {
  const repeaters = app.findCollectionByNameOrId("repeaters");
  if (!repeaters.fields.getByName("gps_model")) {
    repeaters.fields.add(new TextField({ name: "gps_model", max: 100 }));
    app.save(repeaters);
  }
  const pub = app.findCollectionByNameOrId("repeaters_public");
  pub.viewQuery = VIEW_QUERY;
  app.save(pub);
}, (app) => {
  const pub = app.findCollectionByNameOrId("repeaters_public");
  pub.viewQuery = VIEW_QUERY.replace("gps_model, ", "");
  app.save(pub);
  const repeaters = app.findCollectionByNameOrId("repeaters");
  repeaters.fields.removeByName("gps_model");
  app.save(repeaters);
});
