/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const admin = '@request.auth.role = "admin"';
  const manager = '(@request.auth.id != "" && managers.id ?= @request.auth.id)';
  const users = app.findCollectionByNameOrId("users");
  const text = (name,max,required=false) => ({name,type:"text",max,required});
  const date = (name,onUpdate) => ({name,type:"autodate",onCreate:true,onUpdate});
  const rel = (name,maxSelect=1) => ({name,type:"relation",collectionId:users.id,maxSelect,cascadeDelete:false});
  app.save(new Collection({
    type:"base", name:"managed_observers", listRule:admin+" || "+manager, viewRule:admin+" || "+manager,
    createRule:null, deleteRule:admin, updateRule:admin+" || "+manager,
    fields:[text("observer_id",250,true),text("observer_name",250,true),text("region",30),rel("managers",99),
      text("display_name",100),text("area",100),text("hardware",200),text("notes",2000),text("public_owner",100),date("created",false),date("updated",true)],
    indexes:["CREATE UNIQUE INDEX idx_managed_observer_id ON managed_observers (observer_id)"]
  }));
  app.save(new Collection({
    type:"view",name:"managed_observers_public",listRule:"",viewRule:"",
    viewQuery:"SELECT id, observer_id, display_name, area, hardware, notes, public_owner FROM managed_observers"
  }));
  app.save(new Collection({
    type:"base",name:"observer_claims",listRule:admin,viewRule:admin,
    createRule:'(@request.body.status:isset = false || @request.body.status = "pending") && @request.body.user:isset = false && @request.body.handled_by:isset = false',
    updateRule:admin,deleteRule:admin,
    fields:[text("observer_id",250,true),text("observer_name",250),text("region",30),text("name",100,true),
      {name:"email",type:"email",required:true},text("callsign",20),text("note",1000),
      {name:"status",type:"select",values:["pending","approved","declined"],maxSelect:1},rel("user"),rel("handled_by"),date("created",false),date("updated",true)],
    indexes:["CREATE UNIQUE INDEX idx_observer_claim_pending ON observer_claims (observer_id, email) WHERE status = 'pending'"]
  }));
  const s=app.settings(), rl=JSON.parse(JSON.stringify(s.rateLimits));
  if(!rl.rules.some(r=>r.label==="observer_claims:create")){
    rl.rules.push({label:"observer_claims:create",audience:"",duration:600,maxRequests:3});
    unmarshal({rateLimits:rl},s);app.save(s);
  }
},(app)=>{
  for(const name of ["observer_claims","managed_observers_public","managed_observers"])app.delete(app.findCollectionByNameOrId(name));
  const s=app.settings(),rl=JSON.parse(JSON.stringify(s.rateLimits));
  rl.rules=rl.rules.filter(r=>r.label!=="observer_claims:create");unmarshal({rateLimits:rl},s);app.save(s);
});
