/* Repeater Directory (public): reads the directory from PocketBase
   (repeaters_public view, prefixes, maintenance) and live "last heard"
   from the analyzer, matched by public key. */
(function () {
  var root = document.getElementById('rd');
  if (!root) return;
  var API = (root.getAttribute('data-api') || '').replace(/\/$/, '');
  var ANALYZER = (root.getAttribute('data-analyzer') || 'https://analyzer.acadianamesh.com').replace(/\/$/, '');
  var DISCORD = root.getAttribute('data-discord') || '';

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
  function statusClass(s) {
    return { 'Online': 'ok', 'Offline': 'bad', 'Maintenance': 'warn', 'Retired': 'off' }[s] || 'info';
  }
  function statusLabel(s) { return s === 'Built Waiting For Install' ? 'Waiting for install' : s; }

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
    Promise.all([getAll('repeaters_public', '&sort=name'), getAll('prefixes', '&sort=code')])
      .then(function (res) {
        repeaters = res[0]; prefixes = res[1];
        $('rd-loading').hidden = true;
        buildChips(); render(); renderPrefixes(); openFromHash();
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
  var STATUS_ORDER = ['Online', 'Built Waiting For Install', 'Maintenance', 'Offline', 'Retired'];
  function buildChips() {
    var counts = {};
    repeaters.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
    var html = '<button type="button" class="rd-chip active" data-status="all">All <span>' + repeaters.length + '</span></button>';
    STATUS_ORDER.forEach(function (s) {
      if (counts[s]) html += '<button type="button" class="rd-chip" data-status="' + esc(s) + '">' + esc(statusLabel(s)) + ' <span>' + counts[s] + '</span></button>';
    });
    $('rd-status').innerHTML = html;
  }

  function haystack(r) {
    return [r.name, r.area, r.owner_name, r.owner_callsign, r.prefix, r.prefix_2byte, r.manufacturer, r.model, r.firmware, r.public_key && r.public_key.slice(0, 8)]
      .join(' ').toLowerCase();
  }

  function render() {
    var q = state.q.trim().toLowerCase();
    var list = repeaters.map(function (r) { r._live = matchLive(r); r._heard = heardAt(r._live); return r; });

    var online = list.filter(function (r) { return r.status === 'Online'; }).length;
    var heard = list.filter(function (r) { return freshness(r._heard) === 'fresh'; }).length;
    var waiting = list.filter(function (r) { return r.status === 'Built Waiting For Install'; }).length;
    $('rd-count').textContent = list.length;
    $('rd-online').textContent = online;
    $('rd-heard').textContent = liveReady ? heard : '…';
    $('rd-waiting').textContent = waiting;
    document.querySelectorAll('.tab-count[data-count-from="rd-count"]').forEach(function (el) { el.textContent = list.length; });

    var shown = list.filter(function (r) {
      if (state.status !== 'all' && r.status !== state.status) return false;
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
    var pre = r.prefix_2byte || r.prefix;
    return '<button type="button" class="rd-card" data-id="' + esc(r.id) + '">' +
      '<span class="rd-card-top"><span class="rd-card-name">' + esc(r.name) + '</span>' +
      '<span class="rd-pill ' + statusClass(r.status) + '">' + esc(statusLabel(r.status)) + '</span></span>' +
      '<span class="rd-card-meta">' + (r.area ? '<span>📍 ' + esc(r.area) + '</span>' : '') +
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
  function refreshDialog() { if (current && dialog.open) { current._live = matchLive(current); current._heard = heardAt(current._live); fillDialog(current); loadMaintenance(current); } }

  function fillDialog(r) {
    var n = r._live, f = freshness(r._heard);
    $('rd-d-name').textContent = r.name;
    $('rd-d-sub').innerHTML = '<span class="rd-pill ' + statusClass(r.status) + '">' + esc(statusLabel(r.status)) + '</span>' +
      (r.area ? '<span>📍 ' + esc(r.area) + '</span>' : '');

    var liveHtml = !liveReady ? 'Checking…'
      : n ? '<span class="rd-live ' + f + '"><i></i>' + (r._heard ? 'Heard ' + esc(ago(r._heard)) : 'Seen') + '</span>' +
        (n.name && norm(n.name) !== norm(r.name) ? ' <span class="rd-muted">as “' + esc(n.name) + '”</span>' : '')
      : '<span class="rd-live none"><i></i>Not heard by observers</span>';

    var contact = [];
    if (r.owner_name || r.owner_callsign) {
      contact.push(row('Owner', esc(r.owner_name) + (r.owner_callsign ? ' <span class="rd-mono">' + esc(r.owner_callsign) + '</span>' : '')));
      if (r.email) contact.push(row('Email', '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>'));
      if (r.phone) contact.push(row('Phone', '<a href="tel:' + esc(r.phone.replace(/[^0-9+]/g, '')) + '">' + esc(r.phone) + '</a>'));
      if (r.discord) contact.push(row('Discord', '<span class="rd-mono">' + esc(r.discord) + '</span>'));
    }
    var contactHtml = contact.length
      ? '<section class="rd-d-sec rd-contact"><h3>Contact</h3><dl>' + contact.join('') + '</dl>' +
        (!r.email && !r.phone && !r.discord ? '<p class="rd-muted">The owner hasn’t shared contact details. You can reach them through the Acadiana Mesh <a href="' + esc(DISCORD) + '" target="_blank" rel="noopener">Discord</a>.</p>' : '') +
        '</section>'
      : '<section class="rd-d-sec rd-contact"><h3>Contact</h3><p class="rd-muted">Owner details haven’t been added yet. Is this your repeater? <a href="/repeaters/manage/">Sign in</a> or ask an admin on <a href="' + esc(DISCORD) + '" target="_blank" rel="noopener">Discord</a> to link it to you.</p></section>';

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
        row('Prefix', r.prefix ? '<span class="rd-mono">' + esc(r.prefix) + '</span>' : ''),
        row('2-byte prefix', r.prefix_2byte ? '<span class="rd-mono">' + esc(r.prefix_2byte) + '</span>' : ''),
        row('Prefix compliant', t(r.prefix_compliant)),
        row('Path hash', r.path_hash_bytes ? r.path_hash_bytes + '-byte' : ''),
        row('Installed', fmtDate(r.install_date)),
        row('Antenna height', t(r.antenna_height)),
        row('Public key', keyHtml)
      ]) +
      section('Hardware', [
        row('Manufacturer', t(r.manufacturer)), row('Model', t(r.model)), row('Board revision', t(r.board_revision)),
        row('GPS module', t(r.gps_module)), row('Screen', t(r.screen)), row('WiFi / BT antenna', t(r.wifi_bt_antenna)),
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
    current = null;
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
      [r.prefix, r.prefix_2byte].forEach(function (p) {
        if (p) rows.push({ code: p.toUpperCase(), who: r.name, src: 'Directory', id: r.id });
      });
    });
    prefixes.forEach(function (p) { rows.push({ code: p.code.toUpperCase(), who: p.label, src: 'Reserved' }); });
    var seen = {};
    rows = rows.filter(function (x) { var k = x.code + '|' + x.who; if (seen[k]) return false; seen[k] = 1; return true; });
    rows.sort(function (a, b) { return a.code.localeCompare(b.code) || a.who.localeCompare(b.who); });
    return rows;
  }
  function renderPrefixes() {
    var rows = prefixRows();
    $('rd-prefix-body').innerHTML = rows.map(function (x) {
      return '<tr><td class="rd-mono">' + esc(x.code) + '</td><td>' +
        (x.id ? '<a href="#r-' + esc(x.id) + '" data-open="' + esc(x.id) + '">' + esc(x.who) + '</a>' : esc(x.who)) +
        '</td><td><span class="rd-pill ' + (x.src === 'Reserved' ? 'info' : 'ok') + '">' + x.src + '</span></td></tr>';
    }).join('') || '<tr><td colspan="3">No prefixes yet.</td></tr>';
    checkPrefix();
  }
  function checkPrefix() {
    var out = $('rd-prefix-result');
    var q = ($('rd-prefix-q').value || '').trim().toUpperCase();
    if (!q) { out.innerHTML = ''; return; }
    if (!/^[0-9A-F]{2,6}$/.test(q)) { out.innerHTML = '<span class="rd-pill warn">Hex only</span> Use 2–6 characters, 0–9 and A–F.'; return; }
    var taken = prefixRows().filter(function (x) { return x.code.indexOf(q) === 0 || q.indexOf(x.code) === 0; });
    var onAir = liveNodes.filter(function (n) { return n.role === 'repeater' && n.public_key.toUpperCase().indexOf(q) === 0; });
    var parts = [];
    if (taken.length) parts.push('<strong>In the directory:</strong> ' + taken.map(function (x) { return '<span class="rd-mono">' + esc(x.code) + '</span> ' + esc(x.who); }).join(', '));
    if (onAir.length) parts.push('<strong>On the air:</strong> ' + onAir.slice(0, 8).map(function (n) { return esc(n.name || n.public_key.slice(0, 8)); }).join(', ') + (onAir.length > 8 ? ' and ' + (onAir.length - 8) + ' more' : ''));
    out.innerHTML = parts.length
      ? '<span class="rd-pill bad">Taken</span> ' + parts.join('<br>')
      : '<span class="rd-pill ok">Looks free</span> No repeater in the directory or on the air uses <span class="rd-mono">' + esc(q) + '</span>' + (liveReady ? '' : ' (still checking the mesh)') + '. Ask an admin to reserve it.';
  }

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
