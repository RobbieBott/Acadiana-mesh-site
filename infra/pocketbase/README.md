# Repeater directory backend (PocketBase)

Serves **repeaters.acadianamesh.com**, which the website's `/repeaters/` and `/repeaters/manage/` pages read and write.
Jekyll ignores this folder (`exclude` in `_config.yml`). Nothing here is secret.

- `Dockerfile`: PocketBase 0.40.6, checksum-verified, with the migrations baked in.
- `pb_migrations/1795600000_repeater_directory.js`: collections and access rules.
  - `users`: name, callsign, role (`user`/`admin`). Sign in by emailed code or password. Only admins add people; there is no public sign-up.
  - `repeaters`: every column of the old Google Sheet, plus owner, contact details, "show publicly" switches and `managers`. Admins edit all; users edit repeaters where they are a manager and can't change managers. The owner name is required on every save.
  - `repeaters_public`: public read-only view. Email, phone and Discord appear only when the owner ticked "Show publicly".
  - `prefixes`: reserved prefixes (public; admins edit).
  - `maintenance`: repairs log (public; admins and the repeater's managers write).
- `pb_migrations/1795600100_import_sheet.js`: one-time import of the sheet (17 repeaters, 14 reserved prefixes), exported 2026-11-19.
- `pb_hooks/corescope_sync.js` + `corescope_sync.pb.js`: every hour (minute 17) and from the admin "Sync from CoreScope" button (`POST /api/directory/sync`), adds repeaters whose advertised location is inside the **us-la-lft** boundary (`pb_hooks/lft_boundary.js`, copied from `assets/data/la-regions.json`; no location → skipped), and removes earlier auto-added entries that are outside it as long as nobody touched them (no owner, managers, claims or maintenance). Also runs once at startup. CoreScope's own `region_placement` "LFT" is not used — it includes anything our observers hear. New entries get name, key, 1/2/3-byte prefixes, path hash size, status Online, `source = corescope` and no owner. It never overwrites entered data, except that an entry whose key the mesh doesn't hear adopts the mesh key of the single repeater matching its reserved 2-byte prefix or name. Deleting a repeater adds its key to `sync_ignore` so the sync won't add it back (remove it there to allow it again). Analyzer URL: `ANALYZER_URL` env, default https://analyzer.acadianamesh.com.
- `pb_hooks/claims.js` + `claims.pb.js` and migration `1795600600_claims.js`: "Claim this repeater" on the public page creates a `claims` row (anyone; always `pending`; max 3 per IP per 10 min; one pending claim per email per repeater) and emails verified admins. Admins approve on the manage page's Claims tab (`POST /api/directory/claims/{id}/approve`): creates the user if needed (random password, verification/invite email), adds them to `managers`, fills an empty owner name/callsign, marks the claim approved. Decline just marks it declined. A claim grants nothing until approved.
- `pb_migrations/1795600200_settings.js`: app name/URL, sender info@acadianamesh.com, rate limits, proxy header, nightly backups (7 kept).

## On the droplet

- Code: `/root/acadiana-stack/pocketbase/` (copy of this folder). Data: `/root/acadiana-stack/pocketbase/pb_data/`.
- Encryption key: `/root/acadiana-stack/pocketbase.env` (chmod 600).
- Compose service: `compose-service.yml`. Caddy block: `Caddyfile-block`.
- Dashboard: https://repeaters.acadianamesh.com/_/ (superusers only). SMTP login goes in Settings → Mail.
- Install or update: `bash /root/acadiana-stack/pocketbase/install.sh` (first time: `curl -fsSL https://raw.githubusercontent.com/RobbieBott/Acadiana-mesh-site/main/infra/pocketbase/install.sh | bash`). It downloads this folder from GitHub, keeps the data and key, adds the compose service and Caddy block once, rebuilds and restarts. Previous compose/Caddyfile go to `/root/archive/pocketbase-<time>/`.
