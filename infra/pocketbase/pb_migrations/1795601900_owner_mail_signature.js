/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const batches = app.findCollectionByNameOrId("owner_mail_batches");
  batches.fields.add(new TextField({ name: "signature", max: 500 }));
  app.save(batches);
}, (app) => {
  const batches = app.findCollectionByNameOrId("owner_mail_batches");
  batches.fields.removeByName("signature");
  app.save(batches);
});
