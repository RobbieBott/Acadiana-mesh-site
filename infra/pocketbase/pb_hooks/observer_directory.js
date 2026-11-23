function observerFeed() {
  const base = ($os.getenv("ANALYZER_URL") || "https://analyzer.acadianamesh.com").replace(/\/$/, "");
  try {
    const response = $http.send({url: base + "/api/observers", method: "GET", timeout: 10});
    if (response.statusCode === 200 && response.json && Array.isArray(response.json.observers)) {
      return response.json.observers;
    }
  } catch (_) {}
  throw new BadRequestError("The analyzer is unavailable. Try again later.");
}

function setIdentity(record, id, observer) {
  record.set("observer_id", id);
  record.set("observer_name", String(observer.name || id).slice(0, 250));
  record.set("region", String(observer.iata || "").slice(0, 30));
}

function find(app, id) {
  return app.findRecordsByFilter("managed_observers", "observer_id = {:id}", "", 1, 0, {id})[0];
}

function readIds(value) {
  if (!Array.isArray(value) || value.length > 250 ||
      value.some((id) => typeof id !== "string" || !id || id.length > 250)) {
    throw new BadRequestError("Invalid observer selection.");
  }
  return Array.from(new Set(value));
}

const visibility = ["show_phone", "show_discord", "show_email"];

function setManagers(record, managers) {
  record.set("managers", managers);
  const linked = record.getString("contact_from");
  if (linked && !managers.includes(linked)) {
    record.set("contact_from", "");
    for (const field of visibility) record.set(field, false);
  }
}

function addManager(record, id) {
  const managers = record.getStringSlice("managers");
  if (!managers.length && !record.getString("public_owner")) record.set("contact_from", id);
  if (!managers.includes(id)) setManagers(record, managers.concat(id));
}

function validateProfile(record, old, body, auth, canAssign) {
  const previous = old ? old.getString("contact_from") : "";
  const linked = record.getString("contact_from");
  const switched = linked !== previous;
  const managers = record.getStringSlice("managers");
  if (linked && !managers.includes(linked)) {
    if (switched) throw new BadRequestError("Choose a profile from the assigned managers.");
    setManagers(record, managers);
    return;
  }
  if (switched && linked && linked !== auth.id && !canAssign) {
    throw new ForbiddenError("You can link only your own profile.");
  }
  for (const field of visibility) {
    if (linked && record.getBool(field) !== !!(old && old.getBool(field)) && linked !== auth.id && !canAssign) {
      throw new ForbiddenError("You can change public contact settings only for your own profile.");
    }
    if (!linked || (switched && !Object.prototype.hasOwnProperty.call(body, field))) record.set(field, false);
  }
}

function assign(app, userId, input) {
  const add = readIds(input.add);
  const remove = readIds(input.remove);
  if (add.some((id) => remove.includes(id))) throw new BadRequestError("Invalid observer selection.");
  const missing = add.filter((id) => !find(app, id));
  const live = new Map(missing.length ? observerFeed().filter(Boolean).map((observer) => [String(observer.id), observer]) : []);
  if (missing.some((id) => !live.has(id))) throw new BadRequestError("An observer is no longer in the analyzer. Reopen the editor to refresh the list.");
  app.runInTransaction((tx) => {
    tx.findRecordById("users", userId);
    const collection = tx.findCollectionByNameOrId("managed_observers");
    for (const id of add) {
      let record = find(tx, id);
      if (!record) {
        if (!live.has(id)) throw new BadRequestError("An observer assignment changed. Reopen the editor and try again.");
        record = new Record(collection);
        setIdentity(record, id, live.get(id));
      }
      if (!record.getStringSlice("managers").includes(userId)) {
        addManager(record, userId);
        tx.save(record);
      }
    }
    for (const id of remove) {
      const record = find(tx, id);
      if (!record) continue;
      const managers = record.getStringSlice("managers");
      if (managers.includes(userId)) {
        setManagers(record, managers.filter((manager) => manager !== userId));
        tx.save(record);
      }
    }
  });
}

function register(app, input, auth, canAssign) {
  const id = input.observer_id;
  if (typeof id !== "string" || !id || id.length > 250) throw new BadRequestError("Invalid observer ID.");

  const fields = ["display_name", "area", "hardware", "notes", "public_owner", "offline_pause_until", "contact_from"];
  if (Object.keys(input).some((key) => !["observer_id", "managers", ...fields, ...visibility].includes(key))) {
    throw new BadRequestError("Only observer listing details and manager assignments can be saved here.");
  }
  if (input.managers !== undefined && !canAssign) {
    throw new ForbiddenError("Observer manager assignment permission is required.");
  }
  const managers = input.managers === undefined ? [] : readIds(input.managers);
  if (fields.some((key) => input[key] !== undefined && typeof input[key] !== "string")) {
    throw new BadRequestError("Invalid observer listing details.");
  }

  if (visibility.some((key) => input[key] !== undefined && typeof input[key] !== "boolean")) {
    throw new BadRequestError("Invalid public contact settings.");
  }

  const live = observerFeed().find((entry) => entry && String(entry.id) === id);
  if (!live) throw new BadRequestError("Observer not found in the analyzer.");

  let saved;
  app.runInTransaction((tx) => {
    if (find(tx, id)) throw new BadRequestError("This observer is already registered. Refresh the page and reopen it.");
    const record = new Record(tx.findCollectionByNameOrId("managed_observers"));
    setIdentity(record, id, live);
    for (const key of [...fields, ...visibility]) {
      if (input[key] !== undefined) record.set(key, input[key]);
    }
    record.set("managers", managers);
    validateProfile(record, null, input, auth, canAssign);
    tx.save(record);
    saved = record.publicExport();
  });
  return saved;
}

module.exports = {observerFeed, setIdentity, assign, register, validateProfile, addManager};
