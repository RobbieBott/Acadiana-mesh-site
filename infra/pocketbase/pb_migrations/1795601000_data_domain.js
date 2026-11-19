/// <reference path="../pb_data/types.d.ts" />
// The backend moved back to data.acadianamesh.com (from repeaters.acadianamesh.com).
// appURL is used for the links in invite and set-password emails.

migrate((app) => {
  const s = app.settings();
  s.meta.appURL = "https://data.acadianamesh.com";
  app.save(s);
}, (app) => {});
