const PERMISSIONS = "owner_mail_permissions";
const BATCHES = "owner_mail_batches";
const DELIVERIES = "owner_mail_deliveries";
const TEMPLATES = { general: "Owner notice", network: "Network change", maintenance: "Maintenance", offline: "Device offline" };
const SITE = "https://acadianamesh.com";

function one(app, collection, filter, params) {
  return app.findRecordsByFilter(collection, filter, "", 1, 0, params)[0];
}

function grant(app, id) {
  return one(app, PERMISSIONS, "user = {:id}", { id });
}

function isOwner(record) {
  const id = $os.getenv("DIRECTORY_SITE_OWNER_ID");
  return !!(id && record && record.collection().name === "users" &&
    record.id === id && record.getString("role") === "admin" && record.verified());
}

function canSend(app, user) {
  return !!(user && user.collection().name === "users" && user.verified() &&
    (isOwner(user) || grant(app, user.id)));
}

function setGrant(app, user, enabled) {
  if (typeof enabled !== "boolean") throw new BadRequestError("Select an email permission.");
  if (enabled && !user.verified()) throw new BadRequestError("The account must verify its email before sending.");
  const existing = grant(app, user.id);
  if (existing && !enabled) app.delete(existing);
  if (!existing && enabled) {
    const row = new Record(app.findCollectionByNameOrId(PERMISSIONS));
    row.set("user", user.id);
    app.save(row);
  }
}

function changeAccess(app, id, input) {
  if (typeof id !== "string" || !/^[a-z0-9]{15}$/.test(id) || id === $os.getenv("DIRECTORY_SITE_OWNER_ID")) {
    throw new BadRequestError("Choose a different directory account.");
  }
  if (input.role !== undefined && !["user", "admin"].includes(input.role)) {
    throw new BadRequestError("Choose User or Admin.");
  }
  app.runInTransaction((tx) => {
    const user = tx.findRecordById("users", id);
    if ((input.previousRole !== undefined && user.getString("role") !== input.previousRole) ||
        (input.previousEnabled !== undefined && !!grant(tx, id) !== input.previousEnabled)) {
      throw new BadRequestError("These permissions changed. Refresh the grid and try again.");
    }
    if (input.role !== undefined && user.getString("role") !== input.role) {
      user.set("role", input.role);
      tx.save(user);
    }
    if (input.enabled !== undefined) setGrant(tx, user, input.enabled);
  });
}

function permissionList(app) {
  const granted = new Set(app.findAllRecords(PERMISSIONS).map((row) => row.getString("user")));
  return app.findAllRecords("users").map((record) => ({
    id: record.id, name: record.getString("name") || record.email(), email: record.email(),
    role: record.getString("role"), owner: isOwner(record), verified: record.verified(),
    enabled: isOwner(record) || granted.has(record.id)
  })).sort((a,b) => Number(b.owner) - Number(a.owner) || a.name.localeCompare(b.name));
}

function devices(app) {
  return [["repeater", "repeaters"], ["observer", "managed_observers"]].flatMap(([type, collection]) =>
    app.findAllRecords(collection).map((record) => ({
      id: type + ":" + record.id,
      type,
      record,
      name: record.getString(type === "repeater" ? "name" : "display_name") ||
        record.getString("observer_name") || record.id,
      managers: record.getStringSlice("managers")
    })).filter((device) => device.managers.length > 0)
  ).sort((a, b) => a.name.localeCompare(b.name));
}

function verifiedOwners(app, list) {
  const ids = new Set();
  list.forEach((device) => device.managers.forEach((id) => ids.add(id)));
  const owners = new Map();
  for (const id of ids) {
    const record = one(app, "users", "id = {:id} && verified = true", { id });
    if (record && record.email()) owners.set(id, {
      id, name: record.getString("name") || "Directory owner", callsign: record.getString("callsign"),
      email: record.email().trim().toLowerCase()
    });
  }
  return owners;
}

function catalog(app) {
  const list = devices(app);
  const owners = verifiedOwners(app, list);
  return {
    devices: list.map(({ id, type, name }) => ({ id, type, name })),
    owners: Array.from(owners.values(), ({ id, name, callsign }) => ({ id, name, callsign }))
      .sort((a, b) => a.name.localeCompare(b.name))
  };
}

function audience(app, body, notice, actor) {
  const scope = body.scope;
  const ids = Array.isArray(body.ids) ? Array.from(new Set(body.ids)) : [];
  if (!["all", "repeater", "observer", "devices", "owners"].includes(scope) ||
      ids.length > 500 || ids.some((id) => typeof id !== "string" || id.length > 40) ||
      (["devices", "owners"].includes(scope) && !ids.length)) {
    throw new BadRequestError("Choose the recipients for this email.");
  }
  let selected = devices(app);
  if (scope === "devices") selected = selected.filter((device) => ids.includes(device.id));
  if (scope === "owners") selected = selected.filter((device) => device.managers.some((id) => ids.includes(id)));
  if (scope === "repeater" || scope === "observer") selected = selected.filter((device) => device.type === scope);
  const owners = verifiedOwners(app, selected);
  if (scope === "owners" && ids.some((id) => !owners.has(id)) ||
      scope === "devices" && selected.length !== ids.length) {
    throw new BadRequestError("The selected audience changed. Reload the recipient list.");
  }
  const addresses = new Set();
  const targetList = selected.map((device) => {
    const emails = device.managers
      .filter((id) => scope !== "owners" || ids.includes(id))
      .map((id) => owners.get(id)?.email).filter(Boolean).sort();
    emails.forEach((email) => addresses.add(email));
    return { id: device.id, name: device.name, emails };
  });
  return {
    emails: Array.from(addresses).sort(),
    targets: targetList.map(({ id, name }) => ({ id, name })),
    skipped: targetList.filter((target) => !target.emails.length).length,
    fingerprint: $security.hs256(JSON.stringify([scope, notice, targetList]), actor.tokenKey()),
    scope
  };
}

function buttonLink(raw) {
  if (typeof raw !== "string") return "";
  const url = raw.trim();
  const pattern = /^https?:\/\/(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:.]+\])(?::[0-9]{1,5})?(?:[/?#][^\s\\<>"\u0000-\u001f\u007f]*)?$/i;
  return url.length <= 2048 && pattern.test(url) ? url : "";
}

function content(body) {
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!subject || subject.length > 150 || /[\u0000-\u001f\u007f]/.test(subject) || !message ||
      message.length > 5000 || !["general", "network", "maintenance"].includes(body.template)) {
    throw new BadRequestError("Enter a subject, message, and template.");
  }
  const buttonMode = body.buttonMode === undefined ? "directory" : body.buttonMode;
  const buttonUrl = buttonMode === "custom" ? buttonLink(body.buttonUrl) : "";
  if (!["directory", "custom", "hidden"].includes(buttonMode) || (buttonMode === "custom" && !buttonUrl)) {
    throw new BadRequestError("Enter a full http or https URL for the email button.");
  }
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";
  if (signature.length > 500) throw new BadRequestError("Keep the signature to 500 characters.");
  return { subject, message, signature, template: body.template, buttonMode, buttonUrl };
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function render(notice) {
  const tag = TEMPLATES[notice.template];
  const paragraphs = escape(notice.message).split(/\r?\n\s*\r?\n/).map((paragraph) =>
    '<p style="margin:0 0 16px">' + paragraph.replace(/\r?\n/g, "<br>") + "</p>").join("");
  const signature = notice.signature ?
    '<p data-owner-mail-signature style="margin:20px 0 16px;color:#cbd5e1">' +
    escape(notice.signature).replace(/\r?\n/g, "<br>") + '</p>' : '';
  const directoryUrl = notice.template === "offline" ? SITE + "/repeaters/manage/" : SITE + "/repeaters/";
  const url = notice.buttonMode === "hidden" ? "" : notice.buttonMode === "custom" ? buttonLink(notice.buttonUrl) : directoryUrl;
  const button = url ? '<a data-owner-mail-button href="' + escape(url) +
    '" style="display:inline-block;background:#f94d00;color:#0d0d14;border-radius:6px;padding:9px 14px;text-decoration:none">' +
    (notice.buttonMode === "custom" ? "Open link" : "Open Acadiana Mesh") + '</a>' : '';
  return {
    text: "Acadiana Mesh · " + tag + "\n\n" + notice.subject + "\n\n" + notice.message + (notice.signature ? "\n\n" + notice.signature : "") + (url ? "\n\n" + url : ""),
    html: '<!doctype html><html lang="en"><body style="margin:0;background:#0d0d14;color:#e2e8f0;font:16px/1.55 Arial,sans-serif">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#1a1a24;border-radius:12px;overflow:hidden">' +
      '<tr><td style="background:#111118;color:#fff;padding:24px 28px;font-size:22px;font-weight:bold">' +
      '<img src="' + SITE + '/assets/images/logo.png" width="36" alt="" style="vertical-align:middle;margin-right:10px">Acadiana Mesh</td></tr>' +
      '<tr><td style="padding:26px 28px"><p style="margin:0;color:#ff6a1a;font-size:13px;font-weight:bold">' + tag + '</p>' +
      '<h1 style="font-size:25px;line-height:1.25;margin:8px 0 20px">' + escape(notice.subject) + "</h1>" + paragraphs +
      signature + button + '</td></tr>' +
      '</table></td></tr></table></body></html>'
  };
}

function templateSamples() {
  const samples = [
    { template: "general", subject: "Acadiana Mesh owner update",
      message: "Thanks for helping keep the Acadiana Mesh network running. Please review your device listing in the directory and update any details that have changed." },
    { template: "network", subject: "Example: moving from SF9 to SF7",
      message: "We plan to move the selected devices from SF9 to SF7 on Saturday at 9 a.m. Central.\n\nAfter the change, update your radio settings and confirm that your device is reporting in the analyzer." },
    { template: "maintenance", subject: "Example: scheduled repeater maintenance",
      message: "The repeater may be offline Saturday from 8 to 10 a.m. Central while we replace the antenna cable.\n\nCheck the directory for updates after the maintenance window." }
  ];
  return Object.fromEntries(samples.map((notice) => [notice.template, render(notice).html]));
}

function preview(app, actor, body) {
  const notice = content(body);
  const target = audience(app, body, notice, actor);
  return { count: target.emails.length, skipped: target.skipped, fingerprint: target.fingerprint, html: render(notice).html };
}

function addBatch(app, key, kind, notice, target, sender = "") {
  const batch = new Record(app.findCollectionByNameOrId(BATCHES));
  batch.set("request_key", key);
  batch.set("kind", kind);
  batch.set("subject", notice.subject);
  batch.set("message", notice.message);
  batch.set("signature", notice.signature || "");
  batch.set("template", notice.template);
  batch.set("button_mode", notice.buttonMode || "directory");
  batch.set("button_url", notice.buttonUrl || "");
  batch.set("sender", sender);
  batch.set("audience", target.scope);
  batch.set("device_labels", target.targets);
  app.save(batch);
  const collection = app.findCollectionByNameOrId(DELIVERIES);
  for (const email of target.emails) {
    const row = new Record(collection);
    row.set("batch", batch.id);
    row.set("email", email);
    row.set("status", "pending");
    app.save(row);
  }
  return batch;
}

function queue(app, actor, body) {
  const notice = content(body);
  if (typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/.test(body.requestId)) {
    throw new BadRequestError("Preview the email again.");
  }
  const key = actor.id + ":" + body.requestId;
  let id;
  app.runInTransaction((tx) => {
    const user = tx.findRecordById("users", actor.id);
    if (!canSend(tx, user)) throw new ForbiddenError("Owner email permission is required.");
    const existing = one(tx, BATCHES, "request_key = {:key}", { key });
    if (existing) { id = existing.id; return; }
    const target = audience(tx, body, notice, user);
    if (!target.emails.length || body.fingerprint !== target.fingerprint) {
      throw new BadRequestError("The audience changed or is empty. Preview the email again.");
    }
    id = addBatch(tx, key, "manual", notice, target, actor.id).id;
  });
  return { id };
}

function history(app) {
  return app.findRecordsByFilter(BATCHES, "id != ''", "-created", 20, 0).map((batch) => {
    const counts = { pending: 0, sending: 0, accepted: 0, failed: 0, unknown: 0 };
    const deliveries = app.findRecordsByFilter(DELIVERIES, "batch = {:id}", "", 0, 0, { id: batch.id });
    deliveries.forEach((row) => { counts[row.getString("status")]++; });
    const sender = batch.getString("sender");
    const account = sender ? one(app, "users", "id = {:id}", { id: sender }) : null;
    return { subject: batch.getString("subject"), created: batch.getString("created"), counts,
      sender: account ? account.getString("name") || sender : sender || "Offline monitor",
      devices: JSON.parse(batch.getString("device_labels") || "[]").map((device) => device.name) };
  });
}

function processQueue(app) {
  const now = new Date();
  const expired = new Date(now.getTime() - 3600000).toISOString().replace("T", " ");
  for (const row of app.findRecordsByFilter(DELIVERIES, "status = 'sending' && attempted_at < {:expired}", "", 50, 0, { expired })) {
    row.set("status", "unknown");
    app.save(row);
  }
  for (let count = 0; count < 12; count++) {
    let job;
    app.runInTransaction((tx) => {
      const row = one(tx, DELIVERIES, "status = 'pending'");
      if (!row) return;
      row.set("status", "sending");
      row.set("attempted_at", new Date().toISOString());
      tx.save(row);
      job = row.id;
    });
    if (!job) break;
    const row = app.findRecordById(DELIVERIES, job);
    const batch = app.findRecordById(BATCHES, row.getString("batch"));
    const subject = batch.getString("subject");
    const output = render({ subject, message: batch.getString("message"), template: batch.getString("template"),
      signature: batch.getString("signature"), buttonMode: batch.getString("button_mode"), buttonUrl: batch.getString("button_url") });
    const meta = app.settings().meta;
    let status = "accepted";
    try {
      app.newMailClient().send(new MailerMessage({
        from: { address: meta.senderAddress, name: meta.senderName },
        to: [{ address: row.getString("email") }], subject, html: output.html, text: output.text
      }));
    } catch (_) {
      // SMTP errors can be ambiguous. Retrying automatically could send twice.
      status = "failed";
      console.log("[owner mail] SMTP error for delivery " + row.id);
    }
    row.set("status", status);
    app.save(row);
  }
}

module.exports = { one, isOwner, canSend, changeAccess, permissionList, devices, verifiedOwners,
  catalog, templateSamples, preview, queue, addBatch, history, processQueue };
