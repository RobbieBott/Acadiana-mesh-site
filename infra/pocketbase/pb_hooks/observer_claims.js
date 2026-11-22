// Approval and observer manager assignment are one transaction.
function esc(t){return String(t==null?"":t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function send(app,to,subject,html){
  const meta=app.settings().meta;
  app.newMailClient().send(new MailerMessage({from:{address:meta.senderAddress,name:meta.senderName},to:[{address:to}],subject,html}));
}
module.exports.approve=function(app,claimId,adminId){
  let user,isNew=false,observerName;
  app.runInTransaction(tx=>{
    const c=tx.findRecordById("observer_claims",claimId);
    if(c.getString("status")!=="pending")throw new Error("Already handled");
    const email=c.getString("email").toLowerCase();
    try{user=tx.findAuthRecordByEmail("users",email);}catch(_){user=null;}
    if(!user){
      user=new Record(tx.findCollectionByNameOrId("users"));user.setEmail(email);user.setPassword($security.randomString(32));
      user.set("name",c.getString("name"));user.set("callsign",c.getString("callsign").toUpperCase());user.set("role","user");user.set("emailVisibility",false);
      tx.save(user);isNew=true;
    }
    const id=c.getString("observer_id");observerName=c.getString("observer_name")||id;
    let obs;try{obs=tx.findFirstRecordByData("managed_observers","observer_id",id);}catch(_){obs=null;}
    if(!obs){
      obs=new Record(tx.findCollectionByNameOrId("managed_observers"));
      obs.set("observer_id",id);obs.set("observer_name",observerName);obs.set("region",c.getString("region"));
    }
    const managers=obs.getStringSlice("managers");
    if(managers.indexOf(user.id)<0)obs.set("managers",managers.concat([user.id]));
    tx.save(obs);c.set("status","approved");c.set("user",user.id);c.set("handled_by",adminId);tx.save(c);
  });
  let mailed=true;
  try{
    if(!user.verified())$mails.sendRecordPasswordReset(app,user);
    else send(app,user.email(),"Your observer claim was approved","<p>Hello "+esc(user.getString("name"))+",</p><p>You can now manage <strong>"+esc(observerName)+"</strong> in the Acadiana Mesh directory.</p><p><a href='https://acadianamesh.com/repeaters/manage/#observers'>Open My Observers</a></p>");
  }catch(err){mailed=false;console.log("[observer claims] approval email failed: "+err);}
  return{approved:true,observer:observerName,user:user.getString("name"),new_account:isNew,emailed:mailed};
};
module.exports.notify=function(app,c){
  const admins=app.findRecordsByFilter("users","role = 'admin' && verified = true","",50,0);
  admins.forEach(a=>{
    try{send(app,a.email(),"Observer claim awaiting approval","<p>"+esc(c.getString("name"))+" &lt;"+esc(c.getString("email"))+"&gt; asked to manage <strong>"+esc(c.getString("observer_name"))+"</strong>.</p><p>"+esc(c.getString("note"))+"</p><p><a href='https://acadianamesh.com/repeaters/manage/#claims'>Review claim</a></p>");}
    catch(err){console.log("[observer claims] admin notice failed: "+err);}
  });
};
