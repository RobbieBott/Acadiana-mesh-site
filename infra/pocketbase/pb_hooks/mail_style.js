const activity = require(__hooks + "/activity.js");
const SITE = "https://acadianamesh.com";
const PREFIX = "X-Acadiana-Internal-";
const MARKER = "data-acadiana-mail";

function escape(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function render(title, tag, html) {
  return '<!doctype html><html lang="en"><body style="margin:0;background:#0d0d14;color:#e2e8f0;font:16px/1.55 Arial,sans-serif">' +
    '<table ' + MARKER + ' role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0d14"><tr>' +
    '<td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" ' +
    'style="max-width:600px;background:#1a1a24;border:1px solid #383340;border-radius:12px;overflow:hidden">' +
    '<tr><td style="border-top:4px solid #f94d00;background:#111118;color:#fff;padding:20px 26px;font-size:21px;font-weight:bold">' +
    '<img src="' + SITE + '/assets/images/logo.png" width="34" alt="" style="vertical-align:middle;margin-right:10px">Acadiana Mesh</td></tr>' +
    '<tr><td style="padding:24px 26px;overflow-wrap:anywhere"><p style="margin:0;color:#ff9163;font-size:13px;font-weight:bold">' +
    escape(tag) + '</p><h1 style="color:#f1f5f9;font-size:24px;line-height:1.25;margin:8px 0 18px">' + escape(title) +
    '</h1>' + html.replace(/<a(?=\s)(?![^>]*\bstyle\s*=)/gi, '<a style="color:#ffac84;text-decoration:underline"') +
    '</td></tr><tr><td style="border-top:1px solid #383340;padding:15px 26px;color:#a7b1c3;font-size:13px">' +
    'Acadiana Mesh · <a href="' + SITE + '" style="color:#ffac84">acadianamesh.com</a></td></tr></table></td></tr></table></body></html>';
}

function headers(original, action, actorId, target, targetId, actor) {
  const result = Object.assign({}, original || {});
  if (action) result[PREFIX + "Action"] = action;
  if (actorId) result[PREFIX + "ActorId"] = actorId;
  if (target) result[PREFIX + "Target"] = target;
  if (targetId) result[PREFIX + "TargetId"] = targetId;
  if (actor) result[PREFIX + "Actor"] = actor;
  return result;
}

function classify(e, action) {
  e.message.headers = headers(e.message.headers, action, "", "", e.record.id);
  e.next();
}

function send(e) {
  const message = e.message;
  const original = message.headers || {};
  const forwarded = {};
  Object.keys(original).forEach((key) => {
    if (!key.startsWith(PREFIX)) forwarded[key] = original[key];
  });
  const action = original[PREFIX + "Action"] || "Directory email";
  const actorId = original[PREFIX + "ActorId"] || "";
  const targetId = original[PREFIX + "TargetId"] || "";
  const actor = activity.accountActor(e.app, actorId, original[PREFIX + "Actor"] || "System");
  const count = (message.to || []).length + (message.cc || []).length + (message.bcc || []).length;
  const item = { category: "email", action, ...actor, target: original[PREFIX + "Target"] || "", targetId };
  message.headers = forwarded;
  if (!String(message.html || "").includes(MARKER)) {
    const html = message.html || "<p>" + escape(message.text || "").replace(/\r?\n/g, "<br>") + "</p>";
    message.html = render(message.subject, action, html);
  }
  try {
    e.next();
  } catch (error) {
    activity.log(e.app, { ...item, detail: "Mail transport failed for " + count + (count === 1 ? " recipient." : " recipients.") });
    throw error;
  }
  activity.log(e.app, { ...item, detail: "Accepted by mail transport for " + count + (count === 1 ? " recipient." : " recipients.") });
}

module.exports = { render, headers, classify, send };
