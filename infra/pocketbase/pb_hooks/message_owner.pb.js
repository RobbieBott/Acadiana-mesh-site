/// <reference path="../pb_data/types.d.ts" />
// "Message the owner": the visitor's message is emailed to the repeater's
// contact address with Reply-To set to the visitor, so the owner's address
// stays private until they reply. Only for owners who ticked "Let people
// message me". Rate limited (3 per IP per 10 min, see migration 1795600900);
// a filled-in honeypot field is silently dropped. Nothing is stored.

routerAdd("POST", "/api/directory/message", (e) => {
  const esc = (t) => String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const body = e.requestInfo().body || {};
  const clean = (v, max) => String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, max);

  if (body.website) return e.json(200, { sent: true });   // honeypot

  const name = clean(body.name, 100);
  const email = clean(body.email, 200).toLowerCase();
  const message = String(body.message == null ? "" : body.message).trim().slice(0, 2000);
  if (!name) return e.json(400, { message: "Please enter your name." });
  if (!/^[^\s@<>,;"]+@[^\s@<>,;"]+\.[a-z]{2,}$/i.test(email)) return e.json(400, { message: "Please enter a valid email address." });
  if (message.length < 10) return e.json(400, { message: "Please write a little more (at least 10 characters)." });

  let rep;
  try { rep = e.app.findRecordById("repeaters", String(body.repeater || "")); } catch (_) { return e.json(404, { message: "Repeater not found." }); }
  const to = rep.getString("contact_email");
  if (!rep.getBool("show_email") || !to) return e.json(400, { message: "This owner isn't accepting messages." });

  const meta = e.app.settings().meta;
  const repName = rep.getString("name");
  try {
    e.app.newMailClient().send(new MailerMessage({
      from: { address: meta.senderAddress, name: meta.senderName },
      to: [{ address: to, name: rep.getString("owner_name") }],
      headers: { "Reply-To": email },
      subject: "Message about your repeater " + repName,
      html:
        "<p><strong>" + esc(name) + "</strong> (" + esc(email) + ") sent you a message about <strong>" + esc(repName) +
        "</strong> through the Acadiana Mesh repeater directory:</p>" +
        '<blockquote style="border-left:3px solid #f94d00;margin:0;padding:8px 12px;white-space:pre-wrap">' + esc(message) + "</blockquote>" +
        "<p>Reply to this email to answer them. Your email address isn't shown to them until you reply.</p>" +
        '<p style="color:#666;font-size:12px">To stop getting these, untick “Let people message me” on your repeater at ' +
        '<a href="https://acadianamesh.com/repeaters/manage/">acadianamesh.com/repeaters/manage</a>.</p>',
      text: name + " (" + email + ") sent you a message about " + repName + ":\n\n" + message +
        "\n\nReply to this email to answer them.",
    }));
  } catch (err) {
    console.log("[message-owner] send failed: " + err);
    return e.json(502, { message: "The message couldn't be sent right now. Please try again later." });
  }
  return e.json(200, { sent: true });
});
