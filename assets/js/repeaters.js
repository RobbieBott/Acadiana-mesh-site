/* Repeater Directory (public): reads the directory from PocketBase
   (repeaters_public view, prefixes, maintenance) and live "last heard"
   from the analyzer, matched by public key. */
(function () {
  var root = document.getElementById('rd');
  if (!root) return;
  var API = (root.getAttribute('data-api') || '').replace(/\/$/, '');
  var MANAGE = root.getAttribute('data-manage') || '/repeaters/manage/';
  var ANALYZER = (root.getAttribute('data-analyzer') || 'https://analyzer.acadianamesh.com').replace(/\/$/, '');

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); };

  var repeaters = [], prefixes = [], liveNodes = [], liveReady = false;
  var state = { q: '', status: 'all', sort: 'name' };

  // ── helpers ──────────────────────────────────────────────────
  function ago(iso) {
    if (!iso) return '';
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 90) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    var d = Math.round(s / 86400);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }
  function fmtDate(v) {
    if (!v) return '';
    var d = new Date(v.replace(' ', 'T'));
    if (isNaN(d)) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function heardAt(n) {
    if (!n) return null;
    var a = n.last_heard ? new Date(n.last_heard).getTime() : 0;
    var b = n.last_seen ? new Date(n.last_seen).getTime() : 0;
    var t = Math.max(a, b);
    return t ? new Date(t).toISOString() : null;
  }
  function freshness(iso) {
    if (!iso) return 'none';
    var h = (Date.now() - new Date(iso).getTime()) / 3600000;
    return h < 24 ? 'fresh' : h < 72 ? 'stale' : 'old';
  }
  // What the directory shows: live from the mesh for installed repeaters
  // (Online < 24 h, Stale 1–3 days, Offline > 3 days, Not heard), while the
  // owner's Retired / Maintenance / Down status always wins and Waiting for
  // install shows until the mesh hears it.
  var LIVE = {
    online: { label: 'Online', cls: 'ok' },
    stale: { label: 'Stale', cls: 'warn' },
    offline: { label: 'Offline', cls: 'bad' },
    unheard: { label: 'Not heard', cls: 'off' },
    waiting: { label: 'Waiting for install', cls: 'info' },
    maintenance: { label: 'Maintenance', cls: 'warn' },
    retired: { label: 'Retired', cls: 'off' },
    checking: { label: 'Checking…', cls: 'off' }
  };
  var LIVE_ORDER = ['online', 'stale', 'offline', 'unheard', 'waiting', 'maintenance', 'retired'];
  function liveStatus(r) {
    if (r.status === 'Retired') return 'retired';
    if (r.status === 'Maintenance') return 'maintenance';
    if (r.status === 'Offline') return 'offline';
    if (!liveReady) return 'checking';
    var f = freshness(r._heard);
    if (f === 'fresh') return 'online';
    if (r.status === 'Built Waiting For Install') return 'waiting';
    if (f === 'stale') return 'stale';
    if (f === 'old') return 'offline';
    return 'unheard';
  }
  function pill(r) {
    var st = LIVE[r._st || 'checking'];
    return '<span class="rd-pill ' + st.cls + '">' + esc(st.label) + '</span>';
  }

  // Match a directory entry to a live analyzer node: exact key, then the
  // reserved 2-byte prefix, then the same name.
  function matchLive(r) {
    if (!liveNodes.length) return null;
    var key = (r.public_key || '').toLowerCase();
    var hit = key && liveNodes.find(function (n) { return n.public_key === key; });
    if (hit) return hit;
    var p2 = (r.prefix_2byte || '').toLowerCase();
    if (/^[0-9a-f]{4}$/.test(p2)) {
      var byPrefix = liveNodes.filter(function (n) { return n.role === 'repeater' && n.public_key.indexOf(p2) === 0; });
      if (byPrefix.length === 1) return byPrefix[0];
    }
    var nm = norm(r.name);
    var byName = liveNodes.filter(function (n) { return n.role === 'repeater' && norm(n.name) === nm; });
    return byName.length === 1 ? byName[0] : null;
  }

  // 3-byte prefix: the reserved one if set, otherwise the first 3 bytes of the
  // key the mesh hears (or the key on file).
  function prefix3(r) {
    if (r.prefix_3byte) return { code: r.prefix_3byte.toUpperCase(), derived: false };
    var key = (r._live && r._live.public_key) || r.public_key || '';
    return key.length >= 6 ? { code: key.slice(0, 6).toUpperCase(), derived: true } : null;
  }

  // ── data ─────────────────────────────────────────────────────
  function getAll(collection, query) {
    var out = [];
    function page(n) {
      return fetch(API + '/api/collections/' + collection + '/records?perPage=500&page=' + n + (query || ''))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (d) { out = out.concat(d.items || []); return d.page < d.totalPages ? page(n + 1) : out; });
    }
    return page(1);
  }

  function load() {
    if (!API) { fail('The directory server isn’t configured yet.'); return; }
    Promise.all([getAll('repeaters_public', '&sort=name'), getAll('prefixes_public', '&sort=code')])
      .then(function (res) {
        repeaters = res[0]; prefixes = res[1];
        $('rd-loading').hidden = true;
        render(); renderPrefixes(); openFromHash();
      })
      .catch(function () { fail('The repeater directory couldn’t be loaded right now. Please try again in a few minutes.'); });

    fetch(ANALYZER + '/api/nodes?limit=2000')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        liveNodes = (d.nodes || []).map(function (n) { n.public_key = (n.public_key || '').toLowerCase(); return n; });
        liveReady = true;
        if (repeaters.length) { render(); renderPrefixes(); refreshDialog(); }
      })
      .catch(function () { liveReady = true; if (repeaters.length) render(); });
  }
  function fail(msg) {
    $('rd-loading').hidden = true;
    var e = $('rd-error'); e.textContent = msg; e.hidden = false;
  }

  // ── list ─────────────────────────────────────────────────────
  function buildChips(list) {
    var counts = {};
    list.forEach(function (r) { counts[r._st] = (counts[r._st] || 0) + 1; });
    if (state.status !== 'all' && !counts[state.status]) state.status = 'all';
    var chip = function (key, label, n) {
      return '<button type="button" class="rd-chip' + (state.status === key ? ' active' : '') + '" data-status="' + key + '">' + esc(label) + ' <span>' + n + '</span></button>';
    };
    $('rd-status').innerHTML = chip('all', 'All', list.length) + LIVE_ORDER.map(function (k) {
      return counts[k] ? chip(k, LIVE[k].label, counts[k]) : '';
    }).join('');
  }

  function haystack(r) {
    return [r.name, r.area, r.owner_name, r.owner_callsign, r.prefix, r.prefix_2byte, r.prefix_3byte, r.manufacturer, r.model, r.gps_model, r.firmware, r.public_key && r.public_key.slice(0, 8)]
      .join(' ').toLowerCase();
  }

  function render() {
    var q = state.q.trim().toLowerCase();
    var list = repeaters.map(function (r) { r._live = matchLive(r); r._heard = heardAt(r._live); r._st = liveStatus(r); return r; });
    var count = function (keys) { return liveReady ? list.filter(function (r) { return keys.indexOf(r._st) >= 0; }).length : '…'; };
    $('rd-count').textContent = list.length;
    $('rd-online').textContent = count(['online']);
    $('rd-stale').textContent = count(['stale', 'offline']);
    $('rd-unheard').textContent = count(['unheard', 'waiting']);
    buildChips(list);
    document.querySelectorAll('.tab-count[data-count-from="rd-count"]').forEach(function (el) { el.textContent = list.length; });

    var shown = list.filter(function (r) {
      if (state.status !== 'all' && r._st !== state.status) return false;
      return !q || haystack(r).indexOf(q) >= 0;
    });
    shown.sort(function (a, b) {
      if (state.sort === 'heard') return (b._heard || '').localeCompare(a._heard || '') || a.name.localeCompare(b.name);
      if (state.sort === 'installed') return (b.install_date || '').localeCompare(a.install_date || '') || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    $('rd-grid').innerHTML = shown.map(card).join('');
    $('rd-empty').hidden = shown.length > 0 || !repeaters.length;
  }

  function card(r) {
    var f = freshness(r._heard);
    var live = !liveReady ? '<span class="rd-live none">Checking the mesh…</span>'
      : r._heard ? '<span class="rd-live ' + f + '"><i></i>Heard ' + esc(ago(r._heard)) + '</span>'
      : '<span class="rd-live none"><i></i>Not heard by observers</span>';
    var hw = [r.manufacturer, r.model].filter(Boolean).join(' · ');
    var p3 = prefix3(r), pre = p3 && p3.code;
    return '<button type="button" class="rd-card" data-id="' + esc(r.id) + '">' +
      '<span class="rd-card-top"><span class="rd-card-name">' + esc(r.name) + '</span></span>' +
      '<span class="rd-card-meta">' + pill(r) + (r.area ? '<span>📍 ' + esc(r.area) + '</span>' : '') +
      (pre ? '<span class="rd-mono">' + esc(pre) + '</span>' : '') +
      (r.path_hash_bytes ? '<span>' + r.path_hash_bytes + '-byte path</span>' : '') + '</span>' +
      (hw ? '<span class="rd-card-hw">' + esc(hw) + '</span>' : '') +
      '<span class="rd-card-foot">' + live +
      (r.owner_name ? '<span class="rd-owner">' + esc(r.owner_callsign || r.owner_name) + '</span>' : '') + '</span>' +
      '</button>';
  }

  // ── detail dialog ────────────────────────────────────────────
  var dialog = $('rd-dialog'), current = null, map = null;

  function row(label, value) {
    if (value == null || value === '') return '';
    return '<div class="rd-kv"><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>';
  }
  function t(v) { return v ? esc(v) : ''; }
  function section(title, rows) {
    rows = rows.join('');
    return rows ? '<section class="rd-d-sec"><h3>' + esc(title) + '</h3><dl>' + rows + '</dl></section>' : '';
  }

  function openRepeater(id, push) {
    var r = repeaters.find(function (x) { return x.id === id; });
    if (!r) return;
    current = r;
    fillDialog(r);
    if (!dialog.open) dialog.showModal();
    if (push) history.replaceState(null, '', '#r-' + id);
    loadMaintenance(r);
  }
  function refreshDialog() { if (current && dialog.open && !claimOpen) { current._live = matchLive(current); current._heard = heardAt(current._live); fillDialog(current); loadMaintenance(current); } }

  function fillDialog(r) {
    var n = r._live, f = freshness(r._heard);
    $('rd-d-name').textContent = r.name;
    r._st = liveStatus(r);
    $('rd-d-sub').innerHTML = pill(r) +
      (r.area ? '<span>📍 ' + esc(r.area) + '</span>' : '');

    var liveHtml = !liveReady ? 'Checking…'
      : n ? '<span class="rd-live ' + f + '"><i></i>' + (r._heard ? 'Heard ' + esc(ago(r._heard)) : 'Seen') + '</span>' +
        (n.name && norm(n.name) !== norm(r.name) ? ' <span class="rd-muted">as “' + esc(n.name) + '”</span>' : '')
      : '<span class="rd-live none"><i></i>Not heard by observers</span>';

    var contact = [];
    if (r.owner_name || r.owner_callsign) {
      contact.push(row('Owner', esc(r.owner_name) + (r.owner_callsign ? ' <span class="rd-mono">' + esc(r.owner_callsign) + '</span>' : '')));
      if (r.phone) contact.push(row('Phone', '<a href="tel:' + esc(r.phone.replace(/[^0-9+]/g, '')) + '">' + esc(r.phone) + '</a>'));
      if (r.discord) contact.push(row('Discord', '<span class="rd-mono">' + esc(r.discord) + '</span>'));
    }
    var hasOwner = !!(r.owner_name || r.owner_callsign);
    var contactHtml = '<section class="rd-d-sec rd-contact"><h3>Contact</h3>' +
      (hasOwner
        ? '<dl>' + contact.join('') + '</dl>' +
          (r.can_message ? '<p class="rd-msg-cta"><button type="button" class="rd-btn" data-msg>✉️ Message the owner</button></p>' + msgFormHtml(r) : '') +
          '<p class="rd-claim-cta"><button type="button" class="rd-linkbtn" data-claim>Help manage this repeater</button></p>'
        : '<p class="rd-muted">Owner details haven’t been added yet. Is this your repeater?</p>' +
          '<p class="rd-claim-cta"><button type="button" class="rd-btn" data-claim>Claim this repeater</button></p>') +
      claimFormHtml(r) + '</section>';

    var key = r.public_key || (n && n.public_key) || '';
    var keyHtml = key ? '<span class="rd-mono rd-key">' + esc(key) + '</span>' : '';
    var mapHtml = n && n.lat && n.lon && !(n.lat === 0 && n.lon === 0) ? '<div class="rd-map" id="rd-map" aria-label="Location the repeater advertises"></div>' : '';

    $('rd-d-body').innerHTML =
      '<div class="rd-d-live">' + liveHtml +
      (key ? ' <a class="rd-ext" href="' + esc(ANALYZER) + '/#/nodes/' + esc(n ? n.public_key : key) + '" target="_blank" rel="noopener">Open in analyzer ↗</a>' : '') + '</div>' +
      mapHtml +
      '<div class="rd-d-grid">' +
      contactHtml +
      section('Overview', [
        row('Prefix', (function (p) { return p ? '<span class="rd-mono">' + esc(p.code) + '</span>' + (p.derived ? ' <span class="rd-muted">from key</span>' : '') : ''; })(prefix3(r))),
        row('Prefix compliant', t(r.prefix_compliant)),
        row('Path hash', r.path_hash_bytes ? r.path_hash_bytes + '-byte' : ''),
        row('Installed', fmtDate(r.install_date)),
        row('Antenna height', t(r.antenna_height)),
        row('Public key', keyHtml)
      ]) +
      section('Hardware', [
        row('Manufacturer', t(r.manufacturer)), row('Model', t(r.model)), row('Board revision', t(r.board_revision)),
        row('GPS module', esc([r.gps_module, r.gps_model].filter(Boolean).join(' · '))), row('Screen', t(r.screen)), row('WiFi / BT antenna', t(r.wifi_bt_antenna)),
        row('Antenna gain', t(r.antenna_gain)), row('Antenna SWR @ 910 MHz', t(r.antenna_swr))
      ]) +
      section('Firmware & radio', [
        row('Firmware', t(r.firmware)), row('Powersave', t(r.powersave)), row('AGC', t(r.agc))
      ]) +
      section('Power', [
        row('Power input', t(r.power_input)), row('Battery', t(r.battery_type)), row('Battery count / capacity', t(r.battery_count)),
        row('Solar panel', t(r.panel_watts)), row('MPPT', t(r.mppt))
      ]) +
      (r.notes ? '<section class="rd-d-sec rd-wide"><h3>Notes</h3><p class="rd-notes">' + esc(r.notes) + '</p></section>' : '') +
      '<section class="rd-d-sec rd-wide" id="rd-maint"></section>' +
      '</div>' +
      '<p class="rd-muted rd-updated">Directory entry updated ' + esc(fmtDate(r.updated)) + '.</p>';

    if (mapHtml && window.L) {
      setTimeout(function () {
        if (map) { map.remove(); map = null; }
        map = L.map('rd-map', { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([n.lat, n.lon], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        L.circleMarker([n.lat, n.lon], { radius: 8, color: '#fff', weight: 2, fillColor: '#f94d00', fillOpacity: 1 }).addTo(map);
      }, 30);
    }
  }

  // ── claim a repeater ─────────────────────────────────────────
  function claimFormHtml(r) {
    return '<form class="rd-claim" id="rd-claim" hidden novalidate>' +
      '<p class="rd-muted">Tell us who you are. An admin checks every claim and emails you when you can sign in and edit <strong>' + esc(r.name) + '</strong>. Your email is never shown publicly.</p>' +
      '<div class="rd-claim-grid">' +
      '<label><span>Your name <em>*</em></span><input name="name" maxlength="100" autocomplete="name" required></label>' +
      '<label><span>Email <em>*</em></span><input name="email" type="email" autocomplete="email" required></label>' +
      '<label><span>Callsign</span><input name="callsign" maxlength="20" autocomplete="off" class="rd-upper"></label>' +
      '</div>' +
      '<label><span>How do you know it’s yours?</span><textarea name="note" rows="2" maxlength="1000" placeholder="e.g. It’s on my house in Rayne, I built it in March"></textarea></label>' +
      '<label class="rd-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<div class="rd-claim-actions"><button type="button" class="rd-linkbtn" data-claim-cancel>Cancel</button><button type="submit" class="rd-btn">Send claim</button></div>' +
      '<p class="rd-claim-msg" aria-live="polite"></p>' +
      '</form>';
  }
  // ── message the owner (relayed by the server; the owner's address stays private) ──
  function msgFormHtml(r) {
    return '<form class="rd-claim" id="rd-msg" hidden novalidate>' +
      '<p class="rd-muted">We’ll email your message to the owner of <strong>' + esc(r.name) + '</strong>. They can reply to you directly. Their email address isn’t shown here.</p>' +
      '<div class="rd-claim-grid">' +
      '<label><span>Your name <em>*</em></span><input name="name" maxlength="100" autocomplete="name" required></label>' +
      '<label><span>Your email <em>*</em></span><input name="email" type="email" autocomplete="email" required></label>' +
      '</div>' +
      '<label><span>Message <em>*</em></span><textarea name="message" rows="4" maxlength="2000" required></textarea></label>' +
      '<label class="rd-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<div class="rd-claim-actions"><button type="button" class="rd-linkbtn" data-msg-cancel>Cancel</button><button type="submit" class="rd-btn">Send message</button></div>' +
      '<p class="rd-claim-msg" aria-live="polite"></p>' +
      '</form>';
  }
  function toggleForm(id, cta, open) {
    var form = $(id);
    if (!form) return;
    form.hidden = !open;
    var c = form.parentNode.querySelector(cta); if (c) c.hidden = open;
    claimOpen = open || !!document.querySelector('#rd-claim:not([hidden]), #rd-msg:not([hidden])');
    if (open) form.name.focus();
  }
  $('rd-d-body').addEventListener('click', function (e) {
    if (e.target.closest('[data-msg]')) toggleForm('rd-msg', '.rd-msg-cta', true);
    else if (e.target.closest('[data-msg-cancel]')) toggleForm('rd-msg', '.rd-msg-cta', false);
  });
  $('rd-d-body').addEventListener('submit', function (e) {
    var form = e.target.closest('#rd-msg');
    if (!form || !current) return;
    e.preventDefault();
    var msg = form.querySelector('.rd-claim-msg'), btn = form.querySelector('button[type=submit]');
    var say = function (t, bad) { msg.textContent = t; msg.className = 'rd-claim-msg ' + (bad ? 'bad' : 'ok'); };
    var data = { repeater: current.id, name: form.name.value.trim(), email: form.email.value.trim(), message: form.message.value.trim(), website: form.website.value };
    if (!data.name) { say('Please enter your name.', true); form.name.focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(data.email)) { say('Please enter a valid email so they can reply.', true); form.email.focus(); return; }
    if (data.message.length < 10) { say('Please write a little more.', true); form.message.focus(); return; }
    btn.disabled = true;
    fetch(API + '/api/directory/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (res) {
        if (res.ok) {
          claimOpen = !!document.querySelector('#rd-claim:not([hidden])');
          form.innerHTML = '<p class="rd-claim-msg ok">Sent! The owner will reply to <strong>' + esc(data.email) + '</strong> if they can.</p>';
          return;
        }
        return res.json().catch(function () { return {}; }).then(function (j) {
          btn.disabled = false;
          say(res.status === 429 ? 'Too many messages from this connection. Please try again in a few minutes.' : (j && j.message) || 'That didn’t go through. Please try again.', true);
        });
      })
      .catch(function () { btn.disabled = false; say('Couldn’t reach the directory server. Please try again.', true); });
  });

  var claimOpen = false;
  $('rd-d-body').addEventListener('click', function (e) {
    var form = $('rd-claim');
    if (!form) return;
    if (e.target.closest('[data-claim]')) {
      claimOpen = true; form.hidden = false;
      var cta = form.parentNode.querySelector('.rd-claim-cta'); if (cta) cta.hidden = true;
      form.name.focus();
    } else if (e.target.closest('[data-claim-cancel]')) {
      claimOpen = false; form.hidden = true;
      var cta2 = form.parentNode.querySelector('.rd-claim-cta'); if (cta2) cta2.hidden = false;
    }
  });
  $('rd-d-body').addEventListener('submit', function (e) {
    var form = e.target.closest('#rd-claim');
    if (!form || !current) return;
    e.preventDefault();
    var msg = form.querySelector('.rd-claim-msg'), btn = form.querySelector('button[type=submit]');
    var say = function (t, bad) { msg.textContent = t; msg.className = 'rd-claim-msg ' + (bad ? 'bad' : 'ok'); };
    if (form.website.value) { say('Thanks!'); return; }
    var data = { repeater: current.id, name: form.name.value.trim(), email: form.email.value.trim(), callsign: form.callsign.value.trim().toUpperCase(), note: form.note.value.trim() };
    if (!data.name) { say('Please enter your name.', true); form.name.focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(data.email)) { say('Please enter a valid email.', true); form.email.focus(); return; }
    btn.disabled = true;
    fetch(API + '/api/collections/claims/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (res) {
        if (res.ok) {
          claimOpen = false;
          form.innerHTML = '<p class="rd-claim-msg ok">Thanks, ' + esc(data.name) + '! Your claim was sent. An admin will review it and email <strong>' + esc(data.email) + '</strong>.</p>';
          return;
        }
        return res.json().catch(function () { return {}; }).then(function (j) {
          btn.disabled = false;
          if (res.status === 429) say('Too many claims from this connection. Please try again in a few minutes.', true);
          else if (j && j.data && j.data.email && j.data.email.code === 'validation_not_unique') say('You already have a claim waiting for this repeater. An admin will get to it soon.', true);
          else say('That didn’t go through. Please check your details and try again.', true);
        });
      })
      .catch(function () { btn.disabled = false; say('Couldn’t reach the directory server. Please try again.', true); });
  });

  function loadMaintenance(r) {
    var box = $('rd-maint');
    if (!box) return;
    fetch(API + '/api/collections/maintenance/records?perPage=50&sort=-date&filter=' + encodeURIComponent('repeater="' + r.id + '"'))
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (current !== r) return;
        var items = d.items || [];
        box.innerHTML = items.length ? '<h3>Repairs &amp; maintenance</h3><ul class="rd-log">' + items.map(function (m) {
          return '<li><span class="rd-log-date">' + esc(fmtDate(m.date)) + '</span><span>' + esc(m.notes) +
            (m.author ? ' <span class="rd-muted">— ' + esc(m.author) + '</span>' : '') + '</span></li>';
        }).join('') + '</ul>' : '';
      })
      .catch(function () {});
  }

  function closeDialog() {
    if (dialog.open) dialog.close();
  }
  dialog.addEventListener('close', function () {
    current = null; claimOpen = false;
    if (map) { map.remove(); map = null; }
    if (/^#r-/.test(location.hash)) history.replaceState(null, '', '#list');
  });
  $('rd-close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeDialog(); });

  function openFromHash() {
    var m = location.hash.match(/^#r-([a-z0-9]+)$/);
    if (m) openRepeater(m[1], false);
  }
  window.addEventListener('hashchange', openFromHash);

  // ── prefixes ─────────────────────────────────────────────────
  function prefixRows() {
    var rows = [];
    repeaters.forEach(function (r) {
      var p3 = prefix3(r);
      if (p3) rows.push({ code: p3.code, who: r.name, src: 'Directory', id: r.id });
    });
    prefixes.forEach(function (p) { rows.push({ code: p.code.toUpperCase(), who: p.label, src: 'Reserved' }); });
    var seen = {};
    return rows.filter(function (x) { var k = x.code + '|' + x.who; if (seen[k]) return false; seen[k] = 1; return true; });
  }
  function renderPrefixes() {
    // one row per repeater (its 3-byte prefix), then one per reservation
    var rows = repeaters.map(function (r) {
      var p3 = prefix3(r);
      return { who: r.name, id: r.id, code: p3 ? p3.code : '', derived: p3 && p3.derived };
    });
    prefixes.forEach(function (p) { rows.push({ who: p.label || '—', reserved: true, code: p.code.toUpperCase() }); });
    rows.sort(function (a, b) { return (a.code || 'ZZZZZZ').localeCompare(b.code || 'ZZZZZZ') || a.who.localeCompare(b.who); });
    $('rd-prefix-body').innerHTML = rows.map(function (x) {
      return '<tr><td>' + (x.id ? '<a href="#r-' + esc(x.id) + '" data-open="' + esc(x.id) + '">' + esc(x.who) + '</a>'
        : esc(x.who) + ' <span class="rd-pill info">Reserved</span>') + '</td>' +
        '<td>' + (x.code ? '<span class="rd-mono' + (x.derived ? ' rd-derived' : '') + '"' + (x.derived ? ' title="From the public key"' : '') + '>' + esc(x.code) + '</span>' : '<span class="rd-muted">—</span>') + '</td></tr>';
    }).join('') || '<tr><td colspan="2">No prefixes yet.</td></tr>';
    checkPrefix();
  }
  // A prefix is whole bytes (4 or 6 hex characters). MeshCore throws away keys
  // whose first byte is 00 or FF ("reserved id hashes"), so those never occur.
  function prefixProblem(q) {
    if (!/^[0-9A-F]+$/.test(q)) return ['Hex only', 'Use 0–9 and A–F.'];
    if (q.length !== 4 && q.length !== 6) return ['2 or 3 bytes', 'Enter exactly 4 characters (2 bytes) or 6 characters (3 bytes), like B3A1 or B3A1C2.'];
    if (/^(00|FF)/.test(q)) return ['Not allowed', 'Prefixes can’t start with 00 or FF. MeshCore reserves those and never gives a repeater a key that starts with them.'];
    return null;
  }
  var lastChecked = '';
  function checkPrefix() {
    var out = $('rd-prefix-result');
    var q = ($('rd-prefix-q').value || '').trim().toUpperCase();
    if (q === lastChecked && out.querySelector('#rd-reserve')) return;   // keep a half-filled form
    lastChecked = q;
    if (!q) { out.innerHTML = ''; return; }
    var bad = prefixProblem(q);
    if (bad && !/^[0-9A-F]+$/.test(q)) { out.innerHTML = '<span class="rd-pill warn">' + bad[0] + '</span> ' + bad[1]; return; }
    var taken = prefixRows().filter(function (x) { return x.code.indexOf(q) === 0 || q.indexOf(x.code) === 0; });
    var onAir = liveNodes.filter(function (n) { return n.role === 'repeater' && n.public_key.toUpperCase().indexOf(q) === 0; });
    var parts = [];
    var list = function (rows) { return rows.map(function (x) { return '<span class="rd-mono">' + esc(x.code) + '</span> ' + (x.who ? esc(x.who) : '<span class="rd-muted">(no name)</span>'); }).join(', '); };
    var res = taken.filter(function (x) { return x.src === 'Reserved'; }), dir = taken.filter(function (x) { return x.src !== 'Reserved'; });
    if (res.length) parts.push('<strong>Reserved:</strong> ' + list(res));
    if (dir.length) parts.push('<strong>In the directory:</strong> ' + list(dir));
    if (onAir.length) parts.push('<strong>On the air:</strong> ' + onAir.slice(0, 8).map(function (n) { return esc(n.name || n.public_key.slice(0, 8)); }).join(', ') + (onAir.length > 8 ? ' and ' + (onAir.length - 8) + ' more' : ''));
    // an invalid code can still be taken (e.g. an old reservation): say both
    if (bad) {
      out.innerHTML = (parts.length ? '<span class="rd-pill bad">Taken</span> ' + parts.join('<br>') + '<br>' : '') +
        '<span class="rd-pill warn">' + bad[0] + '</span> ' + bad[1];
      return;
    }
    out.innerHTML = parts.length
      ? '<span class="rd-pill bad">Taken</span> ' + parts.join('<br>')
      : '<span class="rd-pill ok">Looks free</span> No repeater in the directory or on the air uses <span class="rd-mono">' + esc(q) + '</span>' + (liveReady ? '' : ' (still checking the mesh)') + '.' +
        ' <button type="button" class="rd-linkbtn" data-reserve>Reserve it</button>' + reserveFormHtml(q);
  }

  // ── reserve a prefix ─────────────────────────────────────────
  // Signed in on the manage page? Reserve under that account (same site, so
  // the PocketBase SDK's saved session is readable here).
  function account() {
    try {
      var a = JSON.parse(localStorage.getItem('pocketbase_auth') || 'null');
      if (!a || !a.token || !a.record || a.record.collectionName !== 'users') return null;
      var exp = JSON.parse(atob(a.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp;
      return exp * 1000 > Date.now() + 60000 ? a : null;
    } catch (_) { return null; }
  }
  function reserveFormHtml(q) {
    var a = account(), u = a && a.record;
    return '<form class="rd-claim rd-reserve" id="rd-reserve" hidden novalidate>' +
      '<p class="rd-muted">' + (u
        ? 'Reserving <strong class="rd-mono">' + esc(q) + '</strong> as <strong>' + esc(u.name || u.email) + '</strong>. You can rename or release it under <a href="' + esc(MANAGE) + '#prefixes">Manage → Prefixes</a>.'
        : 'Reserve <strong class="rd-mono">' + esc(q) + '</strong> for your repeater. We’ll email you a confirmation. Your name and email aren’t shown publicly. Sign in to <a href="' + esc(MANAGE) + '">Manage</a> with the same email later to rename or release it.') + '</p>' +
      '<div class="rd-claim-grid">' +
      (u ? '' :
        '<label><span>Your name <em>*</em></span><input name="name" maxlength="100" autocomplete="name" required></label>' +
        '<label><span>Email <em>*</em></span><input name="email" type="email" autocomplete="email" required></label>' +
        '<label><span>Callsign</span><input name="callsign" maxlength="20" autocomplete="off" class="rd-upper"></label>') +
      '<label' + (u ? ' class="rd-span"' : '') + '><span>What’s it for? <em>*</em></span><input name="label" maxlength="120" required placeholder="e.g. Rayne water tower repeater"></label>' +
      '</div>' +
      '<label class="rd-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
      '<div class="rd-claim-actions"><button type="button" class="rd-linkbtn" data-reserve-cancel>Cancel</button><button type="submit" class="rd-btn">Reserve ' + esc(q) + '</button></div>' +
      '<p class="rd-claim-msg" aria-live="polite"></p>' +
      '</form>';
  }
  $('rd-prefix-result').addEventListener('click', function (e) {
    var form = $('rd-reserve');
    if (!form) return;
    var cta = this.querySelector('[data-reserve]');
    if (e.target.closest('[data-reserve]')) { form.hidden = false; cta.hidden = true; (form.name || form.label).focus(); }
    else if (e.target.closest('[data-reserve-cancel]')) { form.hidden = true; cta.hidden = false; }
  });
  $('rd-prefix-result').addEventListener('submit', function (e) {
    var form = e.target.closest('#rd-reserve');
    if (!form) return;
    e.preventDefault();
    var msg = form.querySelector('.rd-claim-msg'), btn = form.querySelector('button[type=submit]');
    var say = function (t, bad) { msg.textContent = t; msg.className = 'rd-claim-msg ' + (bad ? 'bad' : 'ok'); };
    var code = lastChecked, a = account();
    if (form.website.value) { say('Thanks!'); return; }
    var data = { code: code, label: form.label.value.trim() };
    if (a) { data.reserved_by_name = a.record.name || a.record.email; data.reserved_by_email = a.record.email; data.reserved_by_callsign = a.record.callsign || ''; }
    else { data.reserved_by_name = form.name.value.trim(); data.reserved_by_email = form.email.value.trim(); data.reserved_by_callsign = form.callsign.value.trim().toUpperCase(); }
    if (!data.reserved_by_name) { say('Please enter your name.', true); form.name.focus(); return; }
    if (!/^\S+@\S+\.\S+$/.test(data.reserved_by_email)) { say('Please enter a valid email.', true); form.email.focus(); return; }
    if (!data.label) { say('Please say what it’s for, like the repeater’s name or location.', true); form.label.focus(); return; }
    btn.disabled = true;
    var headers = { 'Content-Type': 'application/json' };
    if (a) headers.Authorization = a.token;
    fetch(API + '/api/collections/prefixes/records', { method: 'POST', headers: headers, body: JSON.stringify(data) })
      .then(function (res) {
        if (res.ok) {
          prefixes.push({ code: code, label: data.label });
          lastChecked = '';
          renderPrefixes();
          $('rd-prefix-result').innerHTML = '<span class="rd-pill ok">Reserved</span> <span class="rd-mono">' + esc(code) + '</span> is yours. A confirmation is on its way to <strong>' + esc(data.reserved_by_email) + '</strong>.';
          lastChecked = code;
          return;
        }
        return res.json().catch(function () { return {}; }).then(function (j) {
          btn.disabled = false;
          if (res.status === 429) say('Too many reservations from this connection. Please try again in a few minutes.', true);
          else if (res.status === 400 && j && j.message && !/^Failed to create/.test(j.message)) say(j.message, true);
          else say('That didn’t go through. Please check your details and try again.', true);
        });
      })
      .catch(function () { btn.disabled = false; say('Couldn’t reach the directory server. Please try again.', true); });
  });

  // ── events ───────────────────────────────────────────────────
  $('rd-grid').addEventListener('click', function (e) {
    var c = e.target.closest('.rd-card');
    if (c) openRepeater(c.getAttribute('data-id'), true);
  });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-open]');
    if (!a) return;
    e.preventDefault();
    openRepeater(a.getAttribute('data-open'), true);
  });
  $('rd-status').addEventListener('click', function (e) {
    var b = e.target.closest('.rd-chip');
    if (!b) return;
    state.status = b.getAttribute('data-status');
    this.querySelectorAll('.rd-chip').forEach(function (x) { x.classList.toggle('active', x === b); });
    render();
  });
  $('rd-q').addEventListener('input', function () { state.q = this.value; render(); });
  $('rd-sort').addEventListener('change', function () { state.sort = this.value; render(); });
  $('rd-prefix-q').addEventListener('input', checkPrefix);

  load();
})();
