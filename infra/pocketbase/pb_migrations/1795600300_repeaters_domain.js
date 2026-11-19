/// <reference path="../pb_data/types.d.ts" />
// The backend moved from data.acadianamesh.com to repeaters.acadianamesh.com.
// appURL is used for the links in invite and set-password emails.

migrate((app) => {
  const s = app.settings();
  s.meta.appURL = "https://repeaters.acadianamesh.com";
  app.save(s);
}, (app) => {});
