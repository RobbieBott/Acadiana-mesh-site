/* Public observer directory: uses CoreScope's public observer API. */
(function observerTab(doc, request) {
  'use strict';
  var root=doc.getElementById('rd');
  if (!root || !doc.getElementById('observers')) return;
  var $=function(id){return doc.getElementById(id);};
  var base=(root.getAttribute('data-analyzer')||'').replace(/\/$/,'');
  var list=[], loading=false;
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
      return '<a class="rd-card" href="'+esc(base+'/#/observers'+(o.id?'/'+encodeURIComponent(String(o.id)):''))+'" target="_blank" rel="noopener"><div class="rd-card-top"><span class="rd-card-name">'+esc(name(o))+'</span><span class="rd-pill '+s[1]+'">'+s[0]+'</span></div><div class="rd-card-meta">Region: '+esc(region(o)||'Unknown')+' · Last status: '+esc(ago(o,now))+'</div>'+(hw?'<div class="rd-card-hw">'+esc(hw)+'</div>':'')+(o.client_version?'<div class="rd-card-hw">'+esc(o.client_version)+'</div>':'')+'<div class="rd-card-foot"><span>'+esc(number(o.packetsLastHour))+' packets / hr</span><span>'+esc(number(o.packet_count))+' total</span></div></a>';
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
  $('obs-search').addEventListener('input',render);
  $('obs-region').addEventListener('change',render);
  $('obs-status').addEventListener('change',render);
  $('obs-refresh').addEventListener('click',load);
  return load();
})(document, window.fetch.bind(window));
