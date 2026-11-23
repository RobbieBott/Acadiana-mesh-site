/* Public observer directory: uses CoreScope's public observer API. */
(function observerTab(doc, request) {
  'use strict';
  var root=doc.getElementById('rd');
  if (!root || !doc.getElementById('observers')) return;
  var $=function(id){return doc.getElementById(id);};
  var base=(root.getAttribute('data-analyzer')||'').replace(/\/$/,'');
  var list=[], loading=false, current=null;
  var api=(root.getAttribute('data-api')||'').replace(/\/$/,'');
  var manage=root.getAttribute('data-manage')||'/repeaters/manage/';
  var dialog=$('obs-dialog');
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function stamp(o){var t=Date.parse(o.last_seen);return Number.isFinite(t)?t:null;}
  function status(o,now){var t=stamp(o);if(t===null)return 'unknown';var age=now-t;return age<3600000?'online':age<86400000?'stale':'offline';}
  function ago(o,now){var t=stamp(o);if(t===null)return 'Unknown';var m=Math.max(0,Math.floor((now-t)/60000));return m<1?'Just now':m<60?m+' min ago':m<1440?Math.floor(m/60)+' h ago':Math.floor(m/1440)+' d ago';}
  function number(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v).toLocaleString():'—';}
  function name(o){return String(o.name||o.id||'Unnamed observer');}
  function region(o){return String(o.iata||'').trim().toUpperCase();}
  function render(){
    if(loading || !$('obs-error').hidden)return;
    var now=Date.now(), chosen=$('obs-region').value, q=$('obs-search').value.trim().toLowerCase(), selected=$('obs-status').value;
    var scoped=list.filter(function(o){return !chosen||region(o)===chosen;});
    var count={online:0,stale:0,offline:0,unknown:0};
    scoped.forEach(function(o){count[status(o,now)]++;});
    $('obs-count').textContent=String(scoped.length);
    $('obs-online').textContent=String(count.online);
    $('obs-stale').textContent=String(count.stale);
    $('obs-offline').textContent=String(count.offline+count.unknown);
    doc.querySelectorAll('.tab-count[data-count-from="obs-count"]').forEach(function(el){el.textContent=String(scoped.length);});
    var shown=scoped.filter(function(o){return (!selected||status(o,now)===selected)&&(!q||[name(o),o.model,o.firmware,o.client_version,o.id,region(o)].join(' ').toLowerCase().indexOf(q)>=0);});
    shown.sort(function(a,b){return (stamp(b)||0)-(stamp(a)||0)||name(a).localeCompare(name(b));});
    var labels={online:['Online','ok'],stale:['Stale','warn'],offline:['Offline','bad'],unknown:['Unknown','off']};
    $('obs-grid').innerHTML=shown.map(function(o){
      var s=labels[status(o,now)], hw=[o.model,o.firmware].filter(Boolean).join(' · ');
      return '<button type="button" class="rd-card" data-observer="'+esc(o.id||'')+'"><div class="rd-card-top"><span class="rd-card-name">'+esc(name(o))+'</span><span class="rd-pill '+s[1]+'">'+s[0]+'</span></div><div class="rd-card-meta">Region: '+esc(region(o)||'Unknown')+' · Last status: '+esc(ago(o,now))+'</div>'+(hw?'<div class="rd-card-hw">'+esc(hw)+'</div>':'')+(o.client_version?'<div class="rd-card-hw">'+esc(o.client_version)+'</div>':'')+'<div class="rd-card-foot"><span>'+esc(number(o.packetsLastHour))+' packets / hr</span><span>'+esc(number(o.packet_count))+' total</span></div></button>';
    }).join('');
    $('obs-empty').hidden=shown.length!==0;
  }
  function load(){
    if(loading)return;
    loading=true;
    $('obs-loading').hidden=false;$('obs-error').hidden=true;$('obs-empty').hidden=true;$('obs-refresh').disabled=true;$('obs-grid').innerHTML='';
    ['obs-count','obs-online','obs-stale','obs-offline'].forEach(function(id){$(id).textContent='—';});
    doc.querySelectorAll('.tab-count[data-count-from="obs-count"]').forEach(function(el){el.textContent='';});
    return Promise.resolve().then(function(){if(!base)throw new Error('Analyzer URL missing');return request(base+'/api/observers');})
      .then(function(res){if(!res.ok)throw new Error('HTTP '+res.status);return res.json();})
      .then(function(data){
        if(!data||!Array.isArray(data.observers))throw new Error('Unexpected observer response');
        list=data.observers.filter(function(o){return o&&typeof o==='object';});
        var select=$('obs-region'), prior=select.value, regions=Array.from(new Set(list.map(region).filter(Boolean))).sort();
        select.innerHTML='<option value="LFT">LFT</option><option value="">All regions</option>'+regions.filter(function(r){return r!=='LFT';}).map(function(r){return '<option value="'+esc(r)+'">'+esc(r)+'</option>';}).join('');
        select.value=prior===''||prior==='LFT'||regions.indexOf(prior)>=0?prior:'LFT';
        loading=false;render();
      }).catch(function(){
        list=[];$('obs-error').textContent='The observer list could not be loaded. Please try Refresh or open the live analyzer.';$('obs-error').hidden=false;
      }).finally(function(){loading=false;$('obs-loading').hidden=true;$('obs-refresh').disabled=false;});
  }

  function detailRow(label,value){
    return value==null||value===''?'':'<div class="rd-kv"><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>';
  }
  function detailSection(label,rows){return '<section class="rd-d-sec"><h3>'+esc(label)+'</h3><dl>'+rows+'</dl></section>';}
  function account(){
    try{
      var a=JSON.parse(localStorage.getItem('pocketbase_auth')||'null');
      if(a&&a.token&&a.record&&a.record.collectionName==='users'){
        var exp=JSON.parse(atob(a.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).exp;
        if(exp*1000>Date.now()+60000)return a;
      }
    }catch(_){}
    return null;
  }
  function pbList(collection,id,token){
    var filter='observer_id = "'+String(id).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
    return request(api+'/api/collections/'+collection+'/records?perPage=1&filter='+encodeURIComponent(filter),{headers:token?{Authorization:token}:{}})
      .then(function(r){if(!r.ok)throw new Error('Directory unavailable');return r.json();})
      .then(function(d){if(!Array.isArray(d.items))throw new Error('Unexpected directory response');return d.items[0]||null;});
  }
  function messageOwner(id, user) {
    var directory = $('obs-directory');
    directory.insertAdjacentHTML('beforeend',
      '<p><button type="button" class="btn btn-secondary" id="obs-message-open">Message the owner</button></p>' +
      '<form class="rd-claim" id="obs-message-form" hidden><div class="rd-claim-grid">' +
      '<label><span>Your name</span><input name="name" maxlength="100" autocomplete="name" required value="' + esc(user && user.name || '') + '"></label>' +
      '<label><span>Your email</span><input name="email" type="email" maxlength="200" autocomplete="email" required value="' + esc(user && user.email || '') + '"></label></div>' +
      '<input name="website" type="text" hidden tabindex="-1" autocomplete="off">' +
      '<label><span>Message</span><textarea name="message" minlength="10" maxlength="2000" rows="4" required></textarea></label>' +
      '<div class="rd-claim-actions"><button class="rd-btn" type="submit">Send message</button></div><p class="rd-claim-msg" role="status"></p></form>');
    var form = $('obs-message-form');
    $('obs-message-open').addEventListener('click', function () {
      this.hidden = true;
      form.hidden = false;
      form.elements.name.focus();
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var button = form.querySelector('button[type=submit]'), message = form.querySelector('[role=status]');
      if (button.disabled) return;
      button.disabled = true;
      var body = { observer: id };
      ['name', 'email', 'message', 'website'].forEach(function (key) { body[key] = form.elements[key].value.trim(); });
      request(api + '/api/directory/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (response) {
          if (response.ok) return;
          if (response.status === 429) throw new Error('Too many messages. Try again in a few minutes.');
          return response.json().then(function (result) { throw new Error(result.message || 'Could not send the message.'); });
        }).then(function () { message.textContent = 'Message sent.'; })
        .catch(function (error) { button.disabled = false; message.textContent = error.message || 'Could not send the message.'; });
    });
  }

  function openObserver(o){
    current=o;
    var now=Date.now(),s=status(o,now),labels={online:['Online','ok'],stale:['Stale','warn'],offline:['Offline','bad'],unknown:['Unknown','off']};
    $('obs-d-name').textContent=name(o);
    $('obs-d-sub').innerHTML='<span class="rd-pill '+labels[s][1]+'">'+labels[s][0]+'</span> <span>'+esc(region(o)||'Unknown region')+'</span>';
    var url=base+'/#/observers'+(o.id?'/'+encodeURIComponent(String(o.id)):'');
    $('obs-d-body').innerHTML=detailSection('Live activity',detailRow('Last status',ago(o,now))+detailRow('Last packet',o.last_packet_at?ago({last_seen:o.last_packet_at},now):null)+detailRow('Packets / hour',number(o.packetsLastHour))+detailRow('Total packets',number(o.packet_count))+detailRow('First seen',o.first_seen))+
      detailSection('Hardware & software',detailRow('Model',o.model||'Not reported')+detailRow('Firmware',o.firmware)+detailRow('Client',o.client_version)+detailRow('Radio settings',o.radio)+detailRow('Node type',o.nodeRole)+detailRow('Observer ID',o.id))+
      '<p><a class="btn btn-secondary" href="'+esc(url)+'" target="_blank" rel="noopener">Open in analyzer ↗</a></p><section class="rd-d-sec"><h3>Owner &amp; directory</h3><div id="obs-directory">Checking directory…</div></section>';
    if(!dialog.open)dialog.showModal();
    if(!api||!o.id){$('obs-directory').textContent='Observer management is unavailable.';return;}
    var a=account();
    Promise.all([pbList('managed_observers_public',o.id),a?pbList('managed_observers',o.id,a.token).catch(function(){return null;}):Promise.resolve(null)])
      .then(function(records){
        if(current!==o||!dialog.open)return;
        var pub=records[0]||{},mine=records[1],u=a&&a.record;
        var info=detailRow('Directory name',pub.display_name)+detailRow('Area',pub.area)+detailRow('Hardware',pub.hardware)+detailRow('Public owner',pub.public_owner)+detailRow('Callsign',pub.owner_callsign)+detailRow('Phone',pub.phone)+detailRow('Discord',pub.discord)+detailRow('Notes',pub.notes);
        $('obs-directory').innerHTML=(info?'<dl>'+info+'</dl>':'<p class="rd-muted">No additional directory details yet.</p>')+
          (mine?'<a class="btn btn-primary" href="'+esc(manage)+'#observers">Manage this observer</a>':
          '<button type="button" class="btn btn-primary" id="obs-claim-open">Claim this observer</button>'+
          '<form class="rd-claim" id="obs-claim-form" hidden><p class="rd-muted">An admin will verify your claim before adding this observer to your account. Your email is never public.'+(u?' You are signed in as '+esc(u.email||u.name)+'.':' Use your existing account email if you have one.')+'</p>'+
          '<div class="rd-claim-grid"><label><span>Your name *</span><input name="name" maxlength="100" autocomplete="name" required value="'+esc(u&&u.name||'')+'" '+(u&&u.name?'readonly':'')+'></label>'+
          '<label><span>Email *</span><input name="email" type="email" autocomplete="email" required value="'+esc(u&&u.email||'')+'" '+(u&&u.email?'readonly':'')+'></label>'+
          '<label><span>Callsign</span><input name="callsign" maxlength="20" value="'+esc(u&&u.callsign||'')+'"></label></div>'+
          '<label><span>How do you know it is yours?</span><textarea name="note" maxlength="1000" rows="3"></textarea></label>'+
          '<div class="rd-claim-actions"><button class="rd-btn" type="submit">Send claim</button></div><p class="rd-claim-msg" role="status"></p></form>');
        if(pub.can_message)messageOwner(pub.id,u);
        if(mine)return;
        $('obs-claim-open').addEventListener('click',function(){this.hidden=true;$('obs-claim-form').hidden=false;$('obs-claim-form').elements.name.focus();});
        $('obs-claim-form').addEventListener('submit',function(e){
          e.preventDefault();var form=this,msg=form.querySelector('.rd-claim-msg'),btn=form.querySelector('button[type=submit]');
          if(btn.disabled)return;
          var data={observer_id:String(o.id),name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),callsign:form.elements.callsign.value.trim(),note:form.elements.note.value.trim()};
          if(!data.name||!data.email){msg.textContent='Please enter your name and email.';return;}
          btn.disabled=true;var headers={'Content-Type':'application/json'};if(a)headers.Authorization=a.token;
          request(api+'/api/collections/observer_claims/records',{method:'POST',headers:headers,body:JSON.stringify(data)})
            .then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(r.status===429?'Too many claims. Please try again later.':(d.message||'Could not submit claim.'));return d;});})
            .then(function(){msg.textContent='Claim submitted. An admin will review it and email you.';})
            .catch(function(err){msg.textContent=err.message||'Could not submit the claim.';btn.disabled=false;});
        });
      }).catch(function(){if(current===o&&dialog.open)$('obs-directory').textContent='Observer management is temporarily unavailable. You can still open the analyzer.';});
  }
  $('obs-grid').addEventListener('click',function(e){
    var b=e.target.closest('[data-observer]');if(!b)return;
    var id=b.getAttribute('data-observer'),o=list.find(function(n){return String(n.id||'')===id;});
    if(o)openObserver(o);
  });
  $('obs-close').addEventListener('click',function(){dialog.close();});
  dialog.addEventListener('click',function(e){if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',function(){current=null;});

  $('obs-search').addEventListener('input',render);
  $('obs-region').addEventListener('change',render);
  $('obs-status').addEventListener('change',render);
  $('obs-refresh').addEventListener('click',load);
  return load();
})(document, window.fetch.bind(window));
