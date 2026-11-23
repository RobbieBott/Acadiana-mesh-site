/// <reference path="../pb_data/types.d.ts" />
// Verify the ID against CoreScope before accepting a claim. No ownership is
// granted until an administrator approves it.
onRecordCreateRequest((e)=>{
  const r=e.record,id=r.getString("observer_id");
  if(!id||id.length>250)throw new BadRequestError("Invalid observer ID.");
  const directory=require(__hooks + "/observer_directory.js");
  const found=directory.observerFeed().find(o=>o&&String(o.id)===id);
  if(!found)throw new BadRequestError("Observer not found in the analyzer.");
  directory.setIdentity(r,id,found);
  if(e.auth&&e.auth.collection().name==="users"){
    r.set("email",e.auth.email());r.set("name",e.auth.getString("name"));r.set("callsign",e.auth.getString("callsign"));
  }
  r.set("email",r.getString("email").trim().toLowerCase());r.set("status","pending");
  r.set("user","");r.set("handled_by","");
  e.next();
},"observer_claims");
onRecordAfterCreateSuccess((e)=>{
  try{require(`${__hooks}/observer_claims.js`).notify(e.app,e.record);}catch(err){console.log("[observer claims] "+err);}
  e.next();
},"observer_claims");
onRecordUpdateRequest((e)=>{
  const r=e.record,old=r.original();
  for(const key of ["observer_id","observer_name","region"]){
    if(r.getString(key)!==old.getString(key))throw new BadRequestError("Analyzer identity cannot be edited.");
  }
  const staff = require(__hooks + "/staff_access.js");
  const assign = staff.has(e.auth, "assign_observers");
  if(!assign){
    if(JSON.stringify(r.getStringSlice("managers").sort())!==JSON.stringify(old.getStringSlice("managers").sort()))
      throw new ForbiddenError("Observer manager assignment permission is required.");
  }
  if (assign && !staff.has(e.auth, "edit_observers") && !old.getStringSlice("managers").includes(e.auth.id)) {
    if (r.getStringSlice("managers").includes(e.auth.id)) throw new ForbiddenError("You cannot assign yourself to this observer.");
    if (Object.keys(e.requestInfo().body).some((field) => !["managers", "managers+", "+managers", "managers-"].includes(field))) {
      throw new ForbiddenError("You can assign managers but cannot edit this listing.");
    }
  }
  if (e.auth && e.auth.collection().name !== "_superusers") {
    require(__hooks + "/observer_directory.js").validateProfile(r, old, e.requestInfo().body, e.auth, assign);
  }
  e.next();
},"managed_observers");
routerAdd("POST","/api/directory/observer-claims/{id}/approve",(e)=>{
  if(!require(__hooks + "/staff_access.js").has(e.auth, "approve_observer_claims"))return e.json(403,{message:"Observer claim approval permission is required."});
  try {
    const id = e.request.pathValue("id");
    const result = require(__hooks + "/observer_claims.js").approve(e.app, id, e.auth.id,
      require(__hooks + "/staff_access.js").has(e.auth, "edit_observers") ? "" : e.auth.email().toLowerCase());
    const activity = require(__hooks + "/activity.js");
    activity.log(e.app, { category: "changes", action: "Approved observer claim", ...activity.who(e.auth),
      target: result.observer, targetId: id, detail: result.user + " assigned. " +
        (result.new_account ? "Account created. " : "") + (result.emailed ? "Approval or setup email accepted by mail transport." : "Approval email failed.") });
    return e.json(200, result);
  }
  catch(err){console.log("[observer claims] approval failed: "+err);return e.json(400,{message:"Could not approve observer claim. It may already have been handled."});}
},$apis.requireAuth("users"));


routerAdd("POST", "/api/directory/people/{id}/observers", (e) => {
  if (!require(__hooks + "/staff_access.js").has(e.auth, "assign_observers")) {
    throw new ForbiddenError("Observer manager assignment permission is required.");
  }
  const id = e.request.pathValue("id");
  const body = e.requestInfo().body;
  if (id === e.auth.id && Array.isArray(body.add) && body.add.length &&
      !require(__hooks + "/staff_access.js").has(e.auth, "edit_observers")) {
    throw new ForbiddenError("You cannot assign yourself to an observer you do not manage.");
  }
  require(__hooks + "/observer_directory.js").assign(e.app, id, body);
  const activity = require(__hooks + "/activity.js");
  const refs = (key) => (Array.isArray(body[key]) ? body[key] : []).map((value) => {
    const observer = e.app.findRecordsByFilter("managed_observers", "observer_id = {:id}", "", 1, 0, { id: value })[0];
    return observer ? activity.target(observer).target : String(value);
  }).join(", ");
  try {
    if ((body.add || []).length || (body.remove || []).length) {
      const added = refs("add"), removed = refs("remove");
      activity.log(e.app, { category: "changes", action: "Changed observer assignments", ...activity.who(e.auth),
        target: activity.accountActor(e.app, id).actor, targetId: id,
        detail: [added ? "Assigned: " + added : "", removed ? "Removed: " + removed : ""].filter(Boolean).join(". ") });
    }
  } catch (_) { console.log("[directory activity] observer assignments unavailable"); }
  return e.json(200, {saved: true});
}, $apis.requireAuth("users"));

routerAdd("POST", "/api/directory/observers", (e) => {
  const staff = require(__hooks + "/staff_access.js");
  if (!staff.has(e.auth, "edit_observers")) {
    throw new ForbiddenError("Observer listing edit permission is required.");
  }
  const directory = require(__hooks + "/observer_directory.js");
  const result = directory.register(e.app, e.requestInfo().body, e.auth, staff.has(e.auth, "assign_observers"));
  const activity = require(__hooks + "/activity.js");
  activity.log(e.app, { category: "changes", action: "Registered observer", ...activity.who(e.auth),
    target: result.display_name || result.observer_name, targetId: result.id });
  return e.json(201, result);
}, $apis.requireAuth("users"));
