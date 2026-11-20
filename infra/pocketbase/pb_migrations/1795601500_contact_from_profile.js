/// <reference path="../pb_data/types.d.ts" />
// "Use my profile" for a repeater's contact info: users get optional phone and
// Discord; repeaters get contact_from (the account whose profile they follow).
// pb_hooks/profile_contact.pb.js copies the profile into the repeater and keeps
// it in step when the profile changes. People can link a repeater only to their
// own profile (admins to anyone's); anyone who can edit it can unlink it.

const ADMIN = '@request.auth.role = "admin"';
const LINK = '(@request.body.contact_from:isset = false || @request.body.contact_from = "" || @request.body.contact_from = @request.auth.id || ' + ADMIN + ')';

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  if (!users.fields.getByName("phone")) {
    users.fields.add(new TextField({ name: "phone", max: 40 }));
    users.fields.add(new TextField({ name: "discord", max: 60 }));
    app.save(users);
  }
  const rep = app.findCollectionByNameOrId("repeaters");
  if (!rep.fields.getByName("contact_from")) {
    rep.fields.add(new RelationField({ name: "contact_from", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
  }
  if (rep.createRule.indexOf("contact_from") < 0) rep.createRule = "(" + rep.createRule + ") && " + LINK;
  if (rep.updateRule.indexOf("contact_from") < 0) rep.updateRule = "(" + rep.updateRule + ") && " + LINK;
  app.save(rep);
}, (app) => {
  const rep = app.findCollectionByNameOrId("repeaters");
  const strip = (r) => r.replace(/^\((.*)\) && \(@request\.body\.contact_from.*$/, "$1");
  rep.createRule = strip(rep.createRule);
  rep.updateRule = strip(rep.updateRule);
  rep.fields.removeByName("contact_from");
  app.save(rep);
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("phone");
  users.fields.removeByName("discord");
  app.save(users);
});
