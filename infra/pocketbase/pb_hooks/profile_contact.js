// Shared by profile_contact.pb.js (JSVM handlers can't see each other's
// top-level functions, so they require() this).
module.exports = {
  // copy a user's profile into a repeater's owner/contact fields
  apply: (rep, user) => {
    rep.set("owner_name", user.getString("name"));
    rep.set("owner_callsign", user.getString("callsign").toUpperCase());
    rep.set("contact_email", user.email());
    rep.set("contact_phone", user.getString("phone"));
    rep.set("contact_discord", user.getString("discord"));
  },
};
