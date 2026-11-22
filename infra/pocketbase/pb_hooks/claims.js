// Approving a repeater claim: make (or reuse) the person's account, add them
// as a manager of the repeater, fill in the owner if it's empty, mark the
// claim approved, then email them.

function esc(t) {
  return String(t == null ? "" : t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function send(app, to, subject, html) {
  const meta = app.settings().meta;
  app.newMailClient().send(new MailerMessage({
    from: { address: meta.senderAddress, name: meta.senderName },
    to: [{ address: to }],
    subject: subject,
    html: html,
  }));
}

module.exports.approve = function (app, claimId, adminId, blockedEmail) {
  let user = null, isNew = false, repName = "";
  app.runInTransaction((tx) => {
    const claim = tx.findRecordById("claims", claimId);
    if (claim.getString("status") !== "pending") throw new Error("This claim was already handled.");
    const email = claim.getString("email").toLowerCase();
    if (email === blockedEmail) throw new Error("You cannot approve your own claim.");
    try { user = tx.findAuthRecordByEmail("users", email); } catch (_) { user = null; }
    if (!user) {
      user = new Record(tx.findCollectionByNameOrId("users"));
      const pw = $security.randomString(32);
      user.setEmail(email);
      user.setPassword(pw);
      user.set("name", claim.getString("name"));
      user.set("callsign", claim.getString("callsign").toUpperCase());
      user.set("role", "user");
      user.set("emailVisibility", false);
      tx.save(user);
      isNew = true;
    }
    const rep = tx.findRecordById("repeaters", claim.getString("repeater"));
    repName = rep.getString("name");
    const managers = rep.getStringSlice("managers");
    if (managers.indexOf(user.id) < 0) rep.set("managers", managers.concat([user.id]));
    if (!rep.getString("owner_name")) {
      rep.set("owner_name", claim.getString("name"));
      if (!rep.getString("owner_callsign") && claim.getString("callsign")) rep.set("owner_callsign", claim.getString("callsign").toUpperCase());
    }
    tx.save(rep);
    claim.set("status", "approved");
    claim.set("user", user.id);
    claim.set("handled_by", adminId);
    tx.save(claim);
  });

  let mailed = true;
  try {
    if (!user.verified()) {
      $mails.sendRecordPasswordReset(app, user);   // its link sets a password and confirms the email
    } else {
      send(app, user.email(), "You can now manage " + repName,
        "<p>Hello " + esc(user.getString("name")) + ",</p>" +
        "<p>Your claim was approved: you can now update <strong>" + esc(repName) + "</strong> in the Acadiana Mesh repeater directory.</p>" +
        '<p>Sign in at <a href="https://acadianamesh.com/repeaters/manage/">acadianamesh.com/repeaters/manage</a> with this email address.</p>' +
        "<p>Thanks,<br/>Acadiana Mesh</p>");
    }
  } catch (err) {
    mailed = false;
    console.log("[claims] approval email failed: " + err);
  }
  return { approved: true, repeater: repName, user: user.getString("name"), new_account: isNew, emailed: mailed };
};

module.exports.notifyAdmins = function (app, claim) {
  let repName = "";
  try { repName = app.findRecordById("repeaters", claim.getString("repeater")).getString("name"); } catch (_) {}
  const admins = app.findRecordsByFilter("users", "staff_permissions ~ '|approve-repeater-claims|' && verified = true", "", 50, 0);
  admins.forEach((a) => {
    try {
      send(app, a.email(), "Repeater claim: " + repName,
        "<p><strong>" + esc(claim.getString("name")) + "</strong>" +
        (claim.getString("callsign") ? " (" + esc(claim.getString("callsign").toUpperCase()) + ")" : "") +
        " &lt;" + esc(claim.getString("email")) + "&gt; asked to manage <strong>" + esc(repName) + "</strong>.</p>" +
        (claim.getString("note") ? "<p>Note: " + esc(claim.getString("note")) + "</p>" : "") +
        '<p>Approve or decline it on the <a href="https://acadianamesh.com/repeaters/manage/#claims">Claims tab</a>.</p>');
    } catch (err) {
      console.log("[claims] admin notice failed: " + err);
    }
  });
};
