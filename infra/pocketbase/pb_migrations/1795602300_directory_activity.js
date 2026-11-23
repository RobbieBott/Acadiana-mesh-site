/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const text = (name, max, required = false) => ({ name, type: "text", max, required });
  app.save(new Collection({
    name: "directory_activity", type: "base",
    fields: [
      text("category", 20, true), text("action", 100, true), text("actor", 160, true), text("actor_id", 40),
      text("target", 180), text("target_id", 250), text("detail", 3000),
      { name: "created", type: "autodate", onCreate: true }
    ],
    indexes: ["CREATE INDEX idx_directory_activity_latest ON directory_activity (created DESC, id DESC)",
      "CREATE INDEX idx_directory_activity_category ON directory_activity (category, created DESC)"]
  }));
  app.save(new Collection({
    name: "directory_settings", type: "base",
    fields: [text("key", 40, true), { name: "enabled", type: "bool" }],
    indexes: ["CREATE UNIQUE INDEX idx_directory_settings_key ON directory_settings (key)"]
  }));
}, (app) => {
  app.delete(app.findCollectionByNameOrId("directory_settings"));
  app.delete(app.findCollectionByNameOrId("directory_activity"));
});
