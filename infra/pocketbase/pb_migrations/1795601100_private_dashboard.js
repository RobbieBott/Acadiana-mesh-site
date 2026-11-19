/// <reference path="../pb_data/types.d.ts" />
// The dashboard (/_/) is no longer reachable from the internet (Caddy blocks
// it; admins use an SSH tunnel). So the users' invite and set-password emails
// link to acadianamesh.com/repeaters/manage/ instead of dashboard pages, and
// dashboard logins need a second step: password + emailed one-time code.

const MANAGE = "https://acadianamesh.com/repeaters/manage/";

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  users.verificationTemplate.body =
    '<p>Hello,</p>\n' +
    '<p>You\'ve been added as a repeater manager on the Acadiana Mesh repeater directory.</p>\n' +
    '<p>Click below to confirm this email address:</p>\n' +
    '<p><a class="btn" href="' + MANAGE + '#verify={TOKEN}" target="_blank" rel="noopener">Confirm my email</a></p>\n' +
    '<p>Then sign in at <a href="' + MANAGE + '">acadianamesh.com/repeaters/manage</a> ' +
    'with this email address. We\'ll email you a sign-in code, or you can set a password there.</p>\n' +
    '<p>Thanks,<br/>{APP_NAME}</p>';
  users.resetPasswordTemplate.subject = "Set your {APP_NAME} password";
  users.resetPasswordTemplate.body =
    '<p>Hello,</p>\n' +
    '<p>Click below to set a password for your Acadiana Mesh repeater directory account.</p>\n' +
    '<p><a class="btn" href="' + MANAGE + '#reset={TOKEN}" target="_blank" rel="noopener">Set my password</a></p>\n' +
    '<p>If you didn\'t ask for this, you can ignore this email.</p>\n' +
    '<p>Thanks,<br/>{APP_NAME}</p>';
  app.save(users);

  // dashboard logins: password, then a one-time code by email
  const su = app.findCollectionByNameOrId("_superusers");
  su.otp.enabled = true;
  su.mfa.enabled = true;
  app.save(su);
}, (app) => {
  const su = app.findCollectionByNameOrId("_superusers");
  su.mfa.enabled = false;
  su.otp.enabled = false;
  app.save(su);
});
