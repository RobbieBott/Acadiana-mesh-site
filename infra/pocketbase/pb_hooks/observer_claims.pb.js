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
  e.next();
},"managed_observers");
routerAdd("POST","/api/directory/observer-claims/{id}/approve",(e)=>{
  if(!require(__hooks + "/staff_access.js").has(e.auth, "approve_observer_claims"))return e.json(403,{message:"Observer claim approval permission is required."});
  try{return e.json(200,require(`${__hooks}/observer_claims.js`).approve(e.app,e.request.pathValue("id"),e.auth.id,
      require(__hooks + "/staff_access.js").has(e.auth, "edit_observers") ? "" : e.auth.email().toLowerCase()));}
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
  return e.json(200, {saved: true});
}, $apis.requireAuth("users"));
