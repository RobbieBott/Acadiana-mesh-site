/// <reference path="../pb_data/types.d.ts" />
// 1) Email sign-in ignores capitals: "RobbieBott@gmail.com" finds the account
//    saved as "robbiebott@gmail.com". PocketBase matches emails without regard
//    to case only when the unique email index is COLLATE NOCASE.
// 2) Invites now go out as the "set your password" email (its link also
//    confirms the address), so a new person picks a password in one step.

const MANAGE = "https://acadianamesh.com/repeaters/manage/";
const PLAIN = "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email`) WHERE `email` != ''";
const NOCASE = "CREATE UNIQUE INDEX `idx_email__pb_users_auth_` ON `users` (`email` COLLATE NOCASE) WHERE `email` != ''";

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const dupes = new DynamicModel({ n: 0 });
  app.db().newQuery("SELECT COUNT(*) AS n FROM (SELECT LOWER(email) e FROM users WHERE email != '' GROUP BY e HAVING COUNT(*) > 1)").one(dupes);
  if (dupes.n === 0) {
    users.indexes = users.indexes.filter((i) => i.indexOf("(`email`") < 0).concat([NOCASE]);
  } else {
    console.log("[migrate] users: " + dupes.n + " emails differ only by capitals; email index left case-sensitive");
  }

  users.resetPasswordTemplate.subject = "Set your {APP_NAME} password";
  users.resetPasswordTemplate.body =
    '<p>Hello,</p>\n' +
    '<p>Click below to choose a password for your Acadiana Mesh repeater directory account. ' +
    'If you were just added as a repeater manager, this also confirms your email.</p>\n' +
    '<p><a class="btn" href="' + MANAGE + '#reset={TOKEN}" target="_blank" rel="noopener">Set my password</a></p>\n' +
    '<p>You can also skip the password and sign in at <a href="' + MANAGE + '">acadianamesh.com/repeaters/manage</a> ' +
    'with a code we email you.</p>\n' +
    '<p>Didn\'t expect this? You can ignore it.</p>\n' +
    '<p>Thanks,<br/>{APP_NAME}</p>';
  app.save(users);
}, (app) => {
  const users = app.findCollectionByNameOrId("users");
  users.indexes = users.indexes.filter((i) => i.indexOf("(`email`") < 0).concat([PLAIN]);
  app.save(users);
});
