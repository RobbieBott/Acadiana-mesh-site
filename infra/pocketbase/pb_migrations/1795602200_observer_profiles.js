/// <reference path="../pb_data/types.d.ts" />
const previousView = "SELECT id, observer_id, display_name, area, hardware, notes, public_owner FROM managed_observers";

migrate((app) => {
  const observers = app.findCollectionByNameOrId("managed_observers");
  const users = app.findCollectionByNameOrId("users");
  observers.fields.add(new RelationField({ name: "contact_from", collectionId: users.id, maxSelect: 1 }));
  for (const name of ["show_phone", "show_discord", "show_email"]) observers.fields.add(new BoolField({ name }));
  app.save(observers);

  // Preserve the manual owner label as a fallback and only infer an unambiguous owner.
  app.db().newQuery(`
    UPDATE managed_observers
       SET contact_from = json_extract(managers, '$[0]')
     WHERE json_array_length(managers) = 1
       AND EXISTS (SELECT 1 FROM users WHERE id = json_extract(managers, '$[0]'))
  `).execute();

  const view = app.findCollectionByNameOrId("managed_observers_public");
  view.viewQuery = `
    SELECT o.id, o.observer_id, o.display_name, o.area, o.hardware, o.notes,
      (COALESCE(NULLIF(u.name, ''), o.public_owner)) AS public_owner,
      (COALESCE(u.callsign, '')) AS owner_callsign,
      (CASE WHEN o.show_phone THEN COALESCE(u.phone, '') ELSE '' END) AS phone,
      (CASE WHEN o.show_discord THEN COALESCE(u.discord, '') ELSE '' END) AS discord,
      (CASE WHEN o.show_email AND u.verified AND u.email != '' THEN 1 ELSE 0 END) AS can_message
    FROM managed_observers o
    LEFT JOIN users u ON u.id = o.contact_from
      AND EXISTS (SELECT 1 FROM json_each(o.managers) WHERE value = u.id)
  `;
  app.save(view);
}, (app) => {
  const view = app.findCollectionByNameOrId("managed_observers_public");
  view.viewQuery = previousView;
  app.save(view);
  const observers = app.findCollectionByNameOrId("managed_observers");
  for (const name of ["contact_from", "show_phone", "show_discord", "show_email"]) observers.fields.removeByName(name);
  app.save(observers);
});
