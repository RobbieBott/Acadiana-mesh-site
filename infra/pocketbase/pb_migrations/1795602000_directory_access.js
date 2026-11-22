/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  // Keep the profile update API, but remove the broad auth-record manager grant.
  users.manageRule = null;
  app.save(users);
  const grants = app.findCollectionByNameOrId("owner_mail_permissions");
  grants.fields.getByName("user").cascadeDelete = true;
  app.save(grants);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.manageRule = '@request.auth.role = "admin"';
  app.save(users);
  const grants = app.findCollectionByNameOrId("owner_mail_permissions");
  grants.fields.getByName("user").cascadeDelete = false;
  app.save(grants);
});
