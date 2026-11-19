/// <reference path="../pb_data/types.d.ts" />
// App name, public URL, sender, rate limits, proxy header and nightly backups.
// SMTP login is entered by an admin in the dashboard (Settings → Mail), never here.

migrate((app) => {
  const s = app.settings();
  s.meta.appName = "Acadiana Mesh";
  s.meta.appURL = "https://repeaters.acadianamesh.com";
  s.meta.senderName = "Acadiana Mesh";
  s.meta.senderAddress = "info@acadianamesh.com";
  s.meta.hideControls = true;
  s.rateLimits.enabled = true;
  s.trustedProxy.headers = ["X-Forwarded-For"];
  s.trustedProxy.useLeftmostIP = false;
  s.backups.cron = "30 4 * * *";
  s.backups.cronMaxKeep = 7;
  app.save(s);
}, (app) => {});
