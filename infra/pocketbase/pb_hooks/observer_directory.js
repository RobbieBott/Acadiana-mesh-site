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
      const managers = record.getStringSlice("managers");
      if (!managers.includes(userId)) {
        record.set("managers", managers.concat(userId));
        tx.save(record);
      }
    }
    for (const id of remove) {
      const record = find(tx, id);
      if (!record) continue;
      const managers = record.getStringSlice("managers");
      if (managers.includes(userId)) {
        record.set("managers", managers.filter((manager) => manager !== userId));
        tx.save(record);
      }
    }
  });
}

module.exports = {observerFeed, setIdentity, assign};
