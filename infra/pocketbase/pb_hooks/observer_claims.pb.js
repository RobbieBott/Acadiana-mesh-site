/// <reference path="../pb_data/types.d.ts" />
// Verify the ID against CoreScope before accepting a claim. No ownership is
// granted until an administrator approves it.
onRecordCreateRequest((e)=>{
  const r=e.record,id=r.getString("observer_id");
  if(!id||id.length>250)throw new BadRequestError("Invalid observer ID.");
  const base=($os.getenv("ANALYZER_URL")||"https://analyzer.acadianamesh.com").replace(/\/$/,"");
  let found;
  try{
    const res=$http.send({url:base+"/api/observers",method:"GET",timeout:10});
    if(res.statusCode!==200||!res.json||!Array.isArray(res.json.observers))throw new Error("Unavailable");
    found=res.json.observers.find(o=>o&&String(o.id)===id);
  }catch(_){throw new BadRequestError("The analyzer is unavailable. Try again later.");}
  if(!found)throw new BadRequestError("Observer not found in the analyzer.");
  r.set("observer_name",String(found.name||id).slice(0,250));r.set("region",String(found.iata||"").slice(0,30));
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
  if(!e.auth||e.auth.getString("role")!=="admin"){
    if(JSON.stringify(r.getStringSlice("managers").sort())!==JSON.stringify(old.getStringSlice("managers").sort()))
      throw new BadRequestError("Only admins can assign observer managers.");
  }
  e.next();
},"managed_observers");
routerAdd("POST","/api/directory/observer-claims/{id}/approve",(e)=>{
  if(!e.auth||e.auth.getString("role")!=="admin")return e.json(403,{message:"Only admins can approve claims."});
  try{return e.json(200,require(`${__hooks}/observer_claims.js`).approve(e.app,e.request.pathValue("id"),e.auth.id));}
  catch(err){console.log("[observer claims] approval failed: "+err);return e.json(400,{message:"Could not approve observer claim. It may already have been handled."});}
},$apis.requireAuth("users"));
