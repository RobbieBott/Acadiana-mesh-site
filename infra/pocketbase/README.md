# Repeater directory backend (PocketBase)

Serves **data.acadianamesh.com**, which the website's `/repeaters/` and `/repeaters/manage/` pages read and write.
Jekyll ignores this folder (`exclude` in `_config.yml`). Nothing here is secret.

- `Dockerfile`: PocketBase 0.40.6, checksum-verified, with the migrations baked in.
- `pb_migrations/1795600000_repeater_directory.js`: collections and access rules.
  - `users`: name, callsign, role (`user`/`admin`). Sign in by emailed code or password. Only admins add people; there is no public sign-up.
  - `repeaters`: every column of the old Google Sheet, plus owner, contact details, "show publicly" switches and `managers`. Admins edit all; users edit repeaters where they are a manager and can't change managers. The owner name is required on every save.
  - `repeaters_public`: public read-only view. Email, phone and Discord appear only when the owner ticked "Show publicly".
  - `prefixes`: reserved prefixes (public; admins edit).
  - `maintenance`: repairs log (public; admins and the repeater's managers write).
- `pb_migrations/1795600100_import_sheet.js`: one-time import of the sheet (17 repeaters, 14 reserved prefixes), exported 2026-11-19.
- `pb_migrations/1795600200_settings.js`: app name/URL, sender info@acadianamesh.com, rate limits, proxy header, nightly backups (7 kept).

## On the droplet

- Code: `/root/acadiana-stack/pocketbase/` (copy of this folder). Data: `/root/acadiana-stack/pocketbase/pb_data/`.
- Encryption key: `/root/acadiana-stack/pocketbase.env` (chmod 600).
- Compose service: `compose-service.yml`. Caddy block: `Caddyfile-block`.
- Dashboard: https://data.acadianamesh.com/_/ (superusers only). SMTP login goes in Settings → Mail.
- Install or update: `bash /root/acadiana-stack/pocketbase/install.sh` (first time: `curl -fsSL https://raw.githubusercontent.com/RobbieBott/Acadiana-mesh-site/main/infra/pocketbase/install.sh | bash`). It downloads this folder from GitHub, keeps the data and key, adds the compose service and Caddy block once, rebuilds and restarts. Previous compose/Caddyfile go to `/root/archive/pocketbase-<time>/`.
