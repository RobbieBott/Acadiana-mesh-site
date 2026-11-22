const permissions = {
  read_repeaters: "View all repeater records",
  edit_repeaters: "Edit all repeater listings",
  assign_repeaters: "Assign repeater managers",
  read_observers: "View all observer records",
  edit_observers: "Edit all observer listings",
  assign_observers: "Assign and register observers",
  read_repeater_claims: "View repeater claims",
  approve_repeater_claims: "Approve or decline repeater claims",
  read_observer_claims: "View observer claims",
  approve_observer_claims: "Approve or decline observer claims",
  read_prefixes: "View all prefix reservations",
  manage_prefixes: "Manage all prefix reservations",
  read_people: "View the People directory",
  edit_people: "Edit directory profiles",
  invite_users: "Invite regular users",
  manage_maintenance: "Manage all repeater maintenance logs",
  sync_corescope: "Run CoreScope sync",
  sync_exclusions: "Manage CoreScope sync exclusions"
};

function isOwner(record) {
  const id = $os.getenv("DIRECTORY_SITE_OWNER_ID");
  return !!(id && record && record.collection().name === "users" &&
    record.id === id && record.getString("role") === "admin" && record.verified());
}

function overrides(record) {
  return JSON.parse(record.getString("staff_overrides") || "{}") || {};
}

function effective(record) {
  if (!record || record.collection().name !== "users") return [];
  if (isOwner(record)) return Object.keys(permissions);
  const custom = overrides(record);
  return Object.keys(permissions).filter((key) => custom[key] === true ||
    (custom[key] !== false && record.getString("role") === "admin"));
}

function has(record, key) {
  return !!(record && (record.collection().name === "_superusers" || effective(record).includes(key)));
}

function valid(params) {
  return params && typeof params === "object" && !Array.isArray(params) &&
    Object.keys(params).every((key) => Object.prototype.hasOwnProperty.call(permissions, key) &&
      typeof params[key] === "boolean");
}

function decline(e, capability) {
  if (e.auth && e.auth.collection().name === "_superusers") return e.next();
  if (!has(e.auth, capability)) throw new ForbiddenError("You do not have permission to handle this claim.");
  const body = e.requestInfo().body;
  const original = e.record.original();
  if (original.getString("status") !== "pending" || body.status !== "declined" ||
      Object.keys(body).some((key) => !["status", "handled_by"].includes(key))) {
    throw new BadRequestError("Only pending claims can be declined here.");
  }
  e.record.set("handled_by", e.auth.id);
  e.next();
}

module.exports = { permissions, isOwner, effective, overrides, has, valid, decline };
