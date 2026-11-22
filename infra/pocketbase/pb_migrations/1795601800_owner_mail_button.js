/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const batches = app.findCollectionByNameOrId("owner_mail_batches");
  batches.fields.add(new SelectField({ name: "button_mode", values: ["directory", "custom", "hidden"] }));
  batches.fields.add(new TextField({ name: "button_url", max: 2048 }));
  app.save(batches);
}, (app) => {
  const batches = app.findCollectionByNameOrId("owner_mail_batches");
  batches.fields.removeByName("button_mode");
  batches.fields.removeByName("button_url");
  app.save(batches);
});
