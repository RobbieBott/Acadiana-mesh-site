/// <reference path="../pb_data/types.d.ts" />
// Prefix reservations: normalise, refuse overlaps (another reservation, a
// repeater in the directory, or one heard on the air), cap 5 per email for
// non-admins, then email the person a confirmation.

onRecordCreateRequest((e) => {
  const rec = e.record;
  const isAdmin = require(__hooks + "/staff_access.js").has(e.auth, "manage_prefixes");
  const code = rec.getString("code").trim().toUpperCase();
  rec.set("code", code);
  rec.set("reserved_by_email", rec.getString("reserved_by_email").trim().toLowerCase());
  rec.set("reserved_by_callsign", rec.getString("reserved_by_callsign").trim().toUpperCase());
  if (e.auth && e.auth.collection().name === "users" && !isAdmin) {
    // signed-in users reserve under their own account and email
    rec.set("user", e.auth.id);
    rec.set("reserved_by_email", e.auth.email().toLowerCase());
    if (!rec.getString("reserved_by_name")) rec.set("reserved_by_name", e.auth.getString("name"));
  }
  if (!/^[0-9A-F]+$/.test(code)) throw new BadRequestError("Prefixes use only 0–9 and A–F.");
  if (code.length !== 4 && code.length !== 6) throw new BadRequestError("A prefix is whole bytes: 4 characters (2 bytes) or 6 characters (3 bytes).");
  if (/^(00|FF)/.test(code)) throw new BadRequestError("Prefixes can't start with 00 or FF. MeshCore reserves those and won't use a key that starts with them.");

  const overlaps = (a, b) => a.indexOf(b) === 0 || b.indexOf(a) === 0;
  for (const p of e.app.findAllRecords("prefixes")) {
    const other = p.getString("code").toUpperCase();
    if (isAdmin && other.length === 2) continue;   // admins may replace old 1-byte reservations
    if (other && overlaps(code, other)) throw new BadRequestError(code + " overlaps the reserved prefix " + other + (p.getString("label") ? " (" + p.getString("label") + ")" : "") + ".");
  }
  for (const r of e.app.findAllRecords("repeaters")) {
    const key = r.getString("public_key").trim().toUpperCase();
    const own = [r.getString("prefix_2byte"), r.getString("prefix_3byte")].map((v) => v.trim().toUpperCase()).filter((v) => v.length >= 4);
    if ((key && key.indexOf(code) === 0) || own.some((v) => overlaps(code, v)))
      throw new BadRequestError(code + " is already used by " + r.getString("name") + " in the directory.");
  }
  try {
    const base = ($os.getenv("ANALYZER_URL") || "https://analyzer.acadianamesh.com").replace(/\/$/, "");
    const res = $http.send({ url: base + "/api/nodes?limit=5000", method: "GET", timeout: 8 });
    if (res.statusCode === 200) {
      const hit = ((res.json && res.json.nodes) || []).find((n) => n.role === "repeater" && String(n.public_key || "").toUpperCase().indexOf(code) === 0);
      if (hit) throw new BadRequestError(code + " is already used on the air by " + (hit.name || "a repeater") + ".");
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err;   // analyzer unreachable: skip the on-air check
  }

  if (!isAdmin) {
    const email = rec.getString("reserved_by_email");
    const mine = e.app.countRecords("prefixes", $dbx.exp("reserved_by_email = {:email}", { email: email }));
    if (mine >= 5) throw new BadRequestError("You already have 5 reserved prefixes. Release one first, or ask an admin.");
  }
  e.next();
}, "prefixes");

onRecordUpdateRequest((e) => {
  // Only a changed code is checked, so old reservations can still be renamed.
  const code = e.record.getString("code").trim().toUpperCase();
  if (code !== e.record.original().getString("code")) {
    e.record.set("code", code);
    if (!/^[0-9A-F]{4}([0-9A-F]{2})?$/.test(code) || /^(00|FF)/.test(code))
      throw new BadRequestError("A prefix is 4 or 6 characters (0–9, A–F) and can't start with 00 or FF.");
  }
  e.next();
}, "prefixes");

onRecordAfterCreateSuccess((e) => {
  const to = e.record.getString("reserved_by_email");
  if (to) {
    const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const meta = e.app.settings().meta;
    try {
      e.app.newMailClient().send(new MailerMessage({
        from: { address: meta.senderAddress, name: meta.senderName },
        to: [{ address: to }],
        subject: "Prefix " + e.record.getString("code") + " is reserved for you",
        headers: require(__hooks + "/mail_style.js").headers(null, "Prefix reservation confirmation",
          e.record.getString("user"), e.record.getString("code"), e.record.id, "Public visitor"),
        html: "<p>Hello " + esc(e.record.getString("reserved_by_name")) + ",</p>" +
          "<p>The repeater prefix <strong>" + esc(e.record.getString("code")) + "</strong> is now reserved for " +
          "<strong>" + esc(e.record.getString("label")) + "</strong> in the Acadiana Mesh repeater directory.</p>" +
          "<p>Generate your repeater's key so it starts with that prefix. To change or release the reservation, sign in at " +
          '<a href="https://acadianamesh.com/repeaters/manage/#prefixes">acadianamesh.com/repeaters/manage</a> with this email address.</p>' +
          "<p>Didn't reserve this? Reply to let us know and we'll remove it.</p><p>Thanks,<br/>Acadiana Mesh</p>",
      }));
    } catch (err) {
      console.log("[prefixes] confirmation email failed: " + err);
    }
  }
  e.next();
}, "prefixes");
