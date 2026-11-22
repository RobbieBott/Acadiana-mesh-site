/* Repeater Directory — management page. Sign in with an emailed code or a
   password (PocketBase users collection). Users edit the repeaters assigned
   to them; admins edit everything and manage people and prefixes.
   All access rules are enforced on the server; this page only hides what a
   user can't do. */
(function () {
  var root = document.getElementById('rm');
  if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var API = (root.getAttribute('data-api') || '').replace(/\/$/, '');
  var ANALYZER = (root.getAttribute('data-analyzer') || 'https://analyzer.acadianamesh.com').replace(/\/$/, '');
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  if (!window.PocketBase || !API) {
    $('rm-loading').hidden = true;
    toast('The directory server couldn’t be reached. Please try again later.', 'bad', true);
    return;
  }
  var pb = new PocketBase(API);
  pb.autoCancellation(false);

  var me = null, isAdmin = false;
  var repeaters = [], people = [], prefixes = [], liveNodes = [], claims = [];
  var editing = null;        // repeater record being edited (null = new)
  var editingPerson = null;  // user record being edited (null = new)

  // ── small helpers ────────────────────────────────────────────
  var toastTimer;
  function toast(msg, kind, sticky) {
    var t = $('rm-toast');
    t.className = 'rm-toast ' + (kind || 'ok');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(function () { t.hidden = true; }, 5000);
  }
  function errText(e) {
    if (!e) return 'Something went wrong.';
    if (e.status === 0) return 'Couldn’t reach the directory server. Check your connection and try again.';
    if (e.status === 429) return 'Too many tries. Please wait a minute and try again.';
    var data = e.response && e.response.data;
    if (data && Object.keys(data).length) {
      return Object.keys(data).map(function (k) { return k.replace(/_/g, ' ') + ': ' + (data[k].message || 'invalid'); }).join(' · ');
    }
    if (e.status === 404 || e.status === 403) return 'You don’t have permission to do that.';
    return (e.response && e.response.message) || e.message || 'Something went wrong.';
  }
  function fmtDate(v) {
    if (!v) return '';
    var d = new Date(String(v).replace(' ', 'T'));
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function toInputDate(v) { return v ? String(v).slice(0, 10) : ''; }
  function fromInputDate(v) { return v ? v + ' 12:00:00.000Z' : ''; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function randomPassword() {
    var a = new Uint8Array(24); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function statusLabel(s) { return s === 'Built Waiting For Install' ? 'Waiting for install' : s === 'Online' ? 'Installed' : s === 'Offline' ? 'Down (known)' : s; }
  function busy(form, on) {
    form.querySelectorAll('button[type=submit]').forEach(function (b) { b.disabled = on; });
  }
  // two-click confirm, so nothing is deleted by a stray tap
  function confirmClick(btn, label, action) {
    if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; action(); return; }
    btn.dataset.armed = '1';
    btn.textContent = 'Click again to confirm';
    setTimeout(function () { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = label; } }, 4000);
  }

  // ── sign in ──────────────────────────────────────────────────
  var otpId = null;
  document.querySelectorAll('.rm-seg button').forEach(function (b) {
    b.addEventListener('click', function () {
      var code = b.getAttribute('data-method') === 'code';
      document.querySelectorAll('.rm-seg button').forEach(function (x) {
        x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false');
      });
      $('rm-code-form').hidden = !code;
      $('rm-pass-form').hidden = code;
    });
  });

  $('rm-code-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    var email = f.email.value.trim().toLowerCase();
    if (!otpId) {
      if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Enter your email address.', 'bad'); return; }
      busy(f, true);
      pb.collection('users').requestOTP(email).then(function (res) {
        otpId = res.otpId;
        $('rm-code-email').textContent = email;
        $('rm-code-step1').hidden = true;
        $('rm-code-step2').hidden = false;
        f.otp.value = '';
        f.otp.focus();
      }).catch(function (err) { toast(errText(err), 'bad'); })
        .then(function () { busy(f, false); });
    } else {
      var code = f.otp.value.replace(/\D/g, '');
      if (code.length !== 6) { toast('Enter the 6-digit code from the email.', 'bad'); return; }
      busy(f, true);
      pb.collection('users').authWithOTP(otpId, code).then(function () {
        otpId = null; signedIn();
      }).catch(function (err) {
        toast(err.status === 400 ? 'That code didn’t work. Check it, or send a new one.' : errText(err), 'bad');
      }).then(function () { busy(f, false); });
    }
  });
  $('rm-code-back').addEventListener('click', function () {
    otpId = null;
    $('rm-code-step1').hidden = false;
    $('rm-code-step2').hidden = true;
  });

  $('rm-pass-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    busy(f, true);
    pb.collection('users').authWithPassword(f.email.value.trim().toLowerCase(), f.password.value).then(function () {
      f.password.value = ''; signedIn();
    }).catch(function (err) {
      toast(err.status === 400 ? 'Email or password is wrong. You can also sign in with an emailed code.' : errText(err), 'bad');
    }).then(function () { busy(f, false); });
  });
  $('rm-forgot').addEventListener('click', function () {
    var email = $('rm-pass-form').email.value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Enter your email above first.', 'bad'); return; }
    pb.collection('users').requestPasswordReset(email).then(function () {
      toast('If that email has an account, we sent a link to set a password.');
    }).catch(function (err) { toast(errText(err), 'bad'); });
  });

  $('rm-signout').addEventListener('click', function () {
    pb.authStore.clear();
    location.hash = '';
    location.reload();
  });

  // ── layout / tabs ────────────────────────────────────────────
  var PANELS = ['repeaters', 'observers', 'claims', 'people', 'prefixes', 'account'];
  function showPanel(name, push) {
    if (PANELS.indexOf(name) < 0 || ((name === 'people' || name === 'claims') && !isAdmin)) name = 'repeaters';
    PANELS.forEach(function (p) { $('rm-p-' + p).hidden = p !== name; });
    $('rm-p-editor').hidden = true;
    document.querySelectorAll('#rm-tabs [data-panel]').forEach(function (a) {
      var on = a.getAttribute('data-panel') === name;
      a.classList.toggle('active', on);
      a.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (push) history.replaceState(null, '', '#' + name);
  }
  $('rm-tabs').addEventListener('click', function (e) {
    var a = e.target.closest('[data-panel]');
    if (!a) return;
    e.preventDefault();
    showPanel(a.getAttribute('data-panel'), true);
  });

  function signedIn() {
    me = pb.authStore.record;
    isAdmin = me && me.role === 'admin';
    $('rm-signin').hidden = true;
    $('rm-app').hidden = false;
    $('rm-tabs').hidden = false;
    $('rm-loading').hidden = true;
    root.classList.toggle('rm-is-admin', isAdmin);
    document.querySelectorAll('#rm-tabs [data-admin], [data-admin-only]').forEach(function (a) { a.hidden = !isAdmin; });
    $('rm-me-name').textContent = me.name || me.email;
    $('rm-me-role').textContent = isAdmin ? 'Admin' : 'User';
    $('rm-rep-title').textContent = isAdmin ? 'All Repeaters' : 'My Repeaters';
    $('rm-sync').hidden = !isAdmin;
    var af = $('rm-account-form');
    af.name.value = me.name || ''; af.callsign.value = me.callsign || ''; af.email.value = me.email || '';
    af.phone.value = me.phone || ''; af.discord.value = me.discord || '';
    var start = location.hash.replace('#', '');
    showPanel(start || 'repeaters', false);
    loadAll().then(function () {
      var m = location.hash.match(/^#edit-([a-z0-9]+)$/);
      if (m) { var r = repeaters.find(function (x) { return x.id === m[1]; }); if (r) openEditor(r); }
    });
    loadLive();
    loadObservers();
    if (isAdmin) loadObserverClaims();
  }

  function signedOut() {
    $('rm-loading').hidden = true;
    $('rm-signin').hidden = false;
    $('rm-app').hidden = true;
    $('rm-tabs').hidden = true;
  }

  // ── data ─────────────────────────────────────────────────────
  function loadAll() {
    var jobs = [
      pb.collection('repeaters').getFullList({ sort: 'name', expand: 'managers,contact_from' }).then(function (l) { repeaters = l; }),
      pb.collection('prefixes').getFullList({ sort: 'code' }).then(function (l) { prefixes = l; })
    ];
    if (isAdmin) jobs.push(pb.collection('users').getFullList({ sort: 'name' }).then(function (l) { people = l; }));
    if (isAdmin) jobs.push(loadClaims());
    return Promise.all(jobs).then(renderAll).catch(function (err) { toast(errText(err), 'bad', true); });
  }
  function renderAll() { renderRepeaters(); renderPeople(); renderPrefixes(); renderClaims(); }

  // ── claims (admins) ──────────────────────────────────────────
  function loadClaims() {
    return pb.collection('claims').getList(1, 200, { sort: '-created', expand: 'repeater,handled_by' }).then(function (res) { claims = res.items; });
  }
  function ago(v) {
    var s = (Date.now() - new Date(String(v).replace(' ', 'T')).getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return fmtDate(v);
  }
  function renderClaims() {
    if (!isAdmin) return;
    var pending = claims.filter(function (c) { return c.status === 'pending'; });
    updateClaimCount();
    $('rm-claims-body').innerHTML = pending.map(function (c) {
      var rep = (c.expand && c.expand.repeater) || {};
      return '<tr><td><strong>' + esc(rep.name || '—') + '</strong>' + (rep.owner_name ? '<div class="rm-sub">Owner: ' + esc(rep.owner_name) + '</div>' : '<div class="rm-sub">No owner yet</div>') + '</td>' +
        '<td>' + esc(c.name) + (c.callsign ? ' <span class="rd-mono">' + esc(c.callsign.toUpperCase()) + '</span>' : '') + '<div class="rm-sub">' + esc(c.email) + '</div>' +
        (c.note ? '<div class="rm-sub rm-show-sm">“' + esc(c.note) + '”</div>' : '') + '</td>' +
        '<td class="rm-hide-sm">' + (c.note ? esc(c.note) : '<span class="rd-muted">—</span>') + '</td>' +
        '<td class="rm-hide-sm rd-muted">' + esc(ago(c.created)) + '</td>' +
        '<td class="rm-right rm-nowrap"><button type="button" class="btn btn-primary rm-sm" data-approve="' + esc(c.id) + '">Approve</button> ' +
        '<button type="button" class="rm-link rm-x" data-decline="' + esc(c.id) + '">Decline</button></td></tr>';
    }).join('') || '<tr><td colspan="5" class="rd-muted">No claims waiting.</td></tr>';
    var done = claims.filter(function (c) { return c.status !== 'pending'; }).slice(0, 15);
    $('rm-claims-done').innerHTML = done.map(function (c) {
      var rep = (c.expand && c.expand.repeater) || {}, by = (c.expand && c.expand.handled_by) || {};
      return '<li><span class="rd-pill ' + (c.status === 'approved' ? 'ok' : 'off') + '">' + (c.status === 'approved' ? 'Approved' : 'Declined') + '</span> ' +
        esc(c.name) + ' → ' + esc(rep.name || '—') + ' <span class="rd-muted">' + (by.name ? 'by ' + esc(by.name) + ', ' : '') + esc(ago(c.updated)) + '</span></li>';
    }).join('') || '<li class="rd-muted">Nothing yet.</li>';
  }
  $('rm-claims-body').addEventListener('click', function (e) {
    var ok = e.target.closest('[data-approve]'), no = e.target.closest('[data-decline]');
    if (ok) {
      var id = ok.getAttribute('data-approve');
      confirmClick(ok, 'Approve', function () {
        ok.disabled = true;
        pb.send('/api/directory/claims/' + encodeURIComponent(id) + '/approve', { method: 'POST' }).then(function (r) {
          toast('Approved: ' + r.user + ' can now manage ' + r.repeater + '.' + (r.new_account ? ' Their account was created.' : '') +
            (r.emailed ? ' They’ve been emailed.' : ' The email couldn’t be sent; let them know to sign in at /repeaters/manage/.'), r.emailed ? 'ok' : 'warn', !r.emailed);
          return loadAll();
        }).catch(function (err) { ok.disabled = false; toast(errText(err), 'bad'); });
      });
    }
    if (no) {
      var did = no.getAttribute('data-decline');
      confirmClick(no, 'Decline', function () {
        pb.collection('claims').update(did, { status: 'declined', handled_by: me.id }).then(function () {
          toast('Claim declined.'); return loadClaims().then(renderClaims);
        }).catch(function (err) { toast(errText(err), 'bad'); });
      });
    }
  });

  function loadLive() {
    fetch(ANALYZER + '/api/nodes?limit=2000').then(function (r) { return r.json(); }).then(function (d) {
      liveNodes = (d.nodes || []).filter(function (n) { return n.role === 'repeater'; })
        .map(function (n) { n.public_key = String(n.public_key || '').toLowerCase(); return n; });
      liveReady = true;
      liveNodes.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      $('rm-nodes').innerHTML = liveNodes.map(function (n) {
        return '<option value="' + esc((n.name || 'Unnamed') + ' — ' + n.public_key.slice(0, 8)) + '"></option>';
      }).join('');
      renderRepeaters();
    }).catch(function () { liveReady = true; renderRepeaters(); });
  }

  // Live status from the mesh, same rules as the public directory:
  // Online < 24 h, Stale 1–3 days, Offline > 3 days, Not heard; the owner's
  // Maintenance / Retired / Down always win, Waiting for install until heard.
  var liveReady = false;
  var LIVE = {
    online: ['Online', 'ok'], stale: ['Stale', 'warn'], offline: ['Offline', 'bad'], unheard: ['Not heard', 'off'],
    waiting: ['Waiting for install', 'info'], maintenance: ['Maintenance', 'warn'], retired: ['Retired', 'off'], checking: ['Checking…', 'off']
  };
  function normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function matchLive(r) {
    var key = (r.public_key || '').toLowerCase();
    var hit = key && liveNodes.find(function (n) { return n.public_key === key; });
    if (hit) return hit;
    var p2 = (r.prefix_2byte || '').toLowerCase();
    if (/^[0-9a-f]{4}$/.test(p2)) {
      var byPrefix = liveNodes.filter(function (n) { return n.public_key.indexOf(p2) === 0; });
      if (byPrefix.length === 1) return byPrefix[0];
    }
    var nm = normName(r.name);
    var byName = liveNodes.filter(function (n) { return normName(n.name) === nm; });
    return byName.length === 1 ? byName[0] : null;
  }
  function heardAt(n) {
    if (!n) return null;
    var t = Math.max(n.last_heard ? new Date(n.last_heard).getTime() : 0, n.last_seen ? new Date(n.last_seen).getTime() : 0);
    return t || null;
  }
  function liveStatus(r) {
    if (r.status === 'Retired') return 'retired';
    if (r.status === 'Maintenance') return 'maintenance';
    if (r.status === 'Offline') return 'offline';
    if (!liveReady) return 'checking';
    var t = heardAt(matchLive(r)), h = t ? (Date.now() - t) / 3600000 : null;
    if (h !== null && h < 24) return 'online';
    if (r.status === 'Built Waiting For Install') return 'waiting';
    if (h === null) return 'unheard';
    return h < 72 ? 'stale' : 'offline';
  }
  function heardText(r) {
    if (!liveReady) return '';
    var t = heardAt(matchLive(r));
    if (!t) return '';
    var s = (Date.now() - t) / 1000;
    var ago = s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago';
    return 'Heard ' + ago;
  }

  // ── repeaters list ───────────────────────────────────────────
  function managerNames(r) {
    var list = (r.expand && r.expand.managers) || [];
    return list.map(function (u) { return u.name || u.email; });
  }
  function renderRepeaters() {
    var q = ($('rm-rep-q').value || '').toLowerCase();
    var rows = repeaters.filter(function (r) {
      return !q || [r.name, r.area, r.owner_name, r.owner_callsign, r.prefix, r.prefix_2byte, r.prefix_3byte].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    $('rm-rep-sub').textContent = isAdmin
      ? repeaters.length + ' repeaters. ' + repeaters.filter(function (r) { return !r.owner_name; }).length + ' still need an owner.'
      : repeaters.length ? 'These are the repeaters assigned to you.' : '';
    $('rm-rep-body').innerHTML = rows.map(function (r) {
      return '<tr><td><button type="button" class="rm-rowlink" data-edit="' + esc(r.id) + '">' + esc(r.name) + '</button>' +
        (r.area ? '<div class="rm-sub">' + esc(r.area) + '</div>' : '') + '</td>' +
        (function () { var st = LIVE[liveStatus(r)]; return '<td><span class="rd-pill ' + st[1] + '">' + esc(st[0]) + '</span>' +
          (heardText(r) ? '<div class="rm-sub">' + esc(heardText(r)) + '</div>' : '') + '</td>'; })() +
        '<td class="rm-hide-sm">' + (r.owner_name ? esc(r.owner_name) : '<span class="rd-pill warn">Needs owner</span>') + '</td>' +
        '<td class="rm-hide-sm rm-admin-col">' + (esc(managerNames(r).join(', ')) || '<span class="rd-muted">—</span>') + '</td>' +
        '<td class="rm-hide-sm rd-muted">' + esc(fmtDate(r.updated)) + '</td>' +
        '<td class="rm-right"><button type="button" class="btn btn-secondary rm-sm" data-edit="' + esc(r.id) + '">Edit</button></td></tr>';
    }).join('') || '<tr><td colspan="6" class="rd-muted">' +
      (repeaters.length ? 'No repeaters match.' : (isAdmin ? 'No repeaters yet.' : 'No repeaters are assigned to you yet. Add one, or ask an admin to link your existing repeater to your account.')) +
      '</td></tr>';
  }
  $('rm-rep-q').addEventListener('input', renderRepeaters);
  $('rm-rep-body').addEventListener('click', function (e) {
    var b = e.target.closest('[data-edit]');
    if (!b) return;
    openEditor(repeaters.find(function (r) { return r.id === b.getAttribute('data-edit'); }));
  });
  $('rm-add-repeater').addEventListener('click', function () { openEditor(null); });
  $('rm-sync').addEventListener('click', function () {
    var btn = this;
    btn.disabled = true; btn.textContent = 'Syncing…';
    pb.send('/api/directory/sync', { method: 'POST' }).then(function (r) {
      var parts = [];
      if (r.added.length) parts.push('added ' + r.added.length + (r.added.length === 1 ? ' repeater' : ' repeaters'));
      if (r.rekeyed.length) parts.push('updated the public key on ' + r.rekeyed.join(', '));
      if (r.removed && r.removed.length) parts.push('removed ' + r.removed.length + ' outside the Lafayette area');
      toast(parts.length ? 'CoreScope sync: ' + parts.join('; ') + '.' : 'CoreScope sync: already up to date (' + r.heard_in_region + ' repeaters in the Lafayette area).');
      return loadAll();
    }).catch(function (err) { toast(errText(err), 'bad', true); })
      .then(function () { btn.disabled = false; btn.textContent = 'Sync from CoreScope'; });
  });

  // ── repeater editor ──────────────────────────────────────────
  var STATUSES = ['Online', 'Offline', 'Built Waiting For Install', 'Maintenance', 'Retired'];
  var YESNO = [['', '—'], ['Yes', 'Yes'], ['No', 'No']];
  var GROUPS = [
    { title: 'Basics', fields: [
      { k: 'name', label: 'Repeater name', req: true, max: 100 },
      { k: 'status', label: 'Status', req: true, type: 'select', opts: STATUSES.map(function (s) { return [s, statusLabel(s)]; }), help: 'For an installed repeater the public directory shows Online, Stale or Offline from when the mesh last heard it. Use Maintenance, Down or Retired to say so yourself.' },
      { k: 'area', label: 'General area', help: 'A town or area, like “NE of Rayne”. Don’t enter a street address.' },
      { k: 'install_date', label: 'Install date', type: 'date' },
      { k: 'antenna_height', label: 'Antenna height', ph: "40'" }
    ] },
    { title: 'On the mesh', fields: [
      { k: 'meshfind', label: 'Find it on the mesh', type: 'meshfind', wide: true, help: 'Start typing the repeater’s name as the mesh hears it to fill in the public key.' },
      { k: 'public_key', label: 'Public key', wide: true, mono: true, max: 64, help: '64 characters, 0–9 and a–f.' },
      { k: 'prefix_3byte', label: 'Prefix (3 byte)', mono: true, max: 8, upper: true, help: 'Left blank, it’s filled from the public key when you save.' },
      { k: 'prefix_compliant', label: 'Prefix compliant', type: 'select', opts: YESNO },
      { k: 'path_hash_bytes', label: 'Path hash size', type: 'select', opts: [['', '—'], ['1', '1-byte (mode 0)'], ['2', '2-byte (mode 1)'], ['3', '3-byte (mode 2)']] }
    ] },
    { title: 'Owner & contact', id: 'contact', note: 'The owner’s name always shows publicly. Your email is never shown: tick “Let people message me” and visitors can send you a message through the directory, which you can answer by replying. Phone and Discord show publicly only if you tick “Show publicly”. Admins can always see these details.', fields: [
      { k: 'owner_name', label: 'Owner name', req: true, max: 100 },
      { k: 'owner_callsign', label: 'Owner callsign', max: 20, upper: true },
      { k: 'contact_email', label: 'Email', type: 'email', show: 'show_email' },
      { k: 'contact_phone', label: 'Phone', type: 'tel', max: 40, show: 'show_phone' },
      { k: 'contact_discord', label: 'Discord username', max: 60, show: 'show_discord' }
    ] },
    { title: 'Hardware', fields: [
      { k: 'manufacturer', label: 'Manufacturer', ph: 'RAK, Heltec…' },
      { k: 'model', label: 'Model', ph: '19007 + 4631' },
      { k: 'board_revision', label: 'Board revision' },
      { k: 'gps_module', label: 'GPS module', type: 'select', opts: YESNO },
      { k: 'gps_model', label: 'GPS module model', max: 100, ph: 'e.g. ATGM336H, L76K, RAK12500', help: 'If you know it.' },
      { k: 'screen', label: 'Screen installed', type: 'select', opts: YESNO },
      { k: 'wifi_bt_antenna', label: 'WiFi / Bluetooth antenna', ph: 'Yes, Onboard…' },
      { k: 'antenna_gain', label: 'Antenna gain', ph: '5.8 dBi' },
      { k: 'antenna_swr', label: 'Antenna SWR @ 910 MHz', ph: '1.2' }
    ] },
    { title: 'Firmware & radio', fields: [
      { k: 'firmware', label: 'Firmware version', ph: 'MC 1.15' },
      { k: 'powersave', label: 'Powersave on', type: 'select', opts: YESNO },
      { k: 'agc', label: 'AGC setting', ph: 'Auto' }
    ] },
    { title: 'Power', fields: [
      { k: 'power_input', label: 'Power input', ph: 'Battery / Solar' },
      { k: 'battery_type', label: 'Battery type', ph: 'Cells / 18650' },
      { k: 'battery_count', label: 'Battery count / mAh', ph: '4/3300 mAh' },
      { k: 'panel_watts', label: 'Solar panel', ph: '7W' },
      { k: 'mppt', label: 'MPPT module', ph: 'Yes, Onboard…' }
    ] },
    { title: 'Notes', fields: [
      { k: 'notes', label: 'Notes', type: 'textarea', wide: true, max: 3000 }
    ] }
  ];

  function fieldHtml(f, r) {
    var v = r ? r[f.k] : '';
    if (f.k === 'install_date') v = toInputDate(v);
    if (f.k === 'path_hash_bytes') v = v ? String(v) : '';
    if (v == null) v = '';
    var id = 'rm-f-' + f.k;
    var label = '<label class="rm-label" for="' + id + '">' + esc(f.label) + (f.req ? ' <em>*</em>' : '') + '</label>';
    var input;
    if (f.type === 'select') {
      input = '<select id="' + id + '" name="' + f.k + '"' + (f.req ? ' required' : '') + '>' + f.opts.map(function (o) {
        return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
      }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      input = '<textarea id="' + id + '" name="' + f.k + '" rows="4" maxlength="' + (f.max || 3000) + '">' + esc(v) + '</textarea>';
    } else if (f.type === 'meshfind') {
      input = '<input id="' + id + '" list="rm-nodes" autocomplete="off" placeholder="' + (liveNodes.length ? 'Search ' + liveNodes.length + ' repeaters heard on the mesh' : 'Search repeaters heard on the mesh') + '">';
    } else {
      input = '<input id="' + id + '" name="' + f.k + '" type="' + (f.type || 'text') + '" value="' + esc(v) + '"' +
        (f.max ? ' maxlength="' + f.max + '"' : '') + (f.req ? ' required' : '') + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') +
        ' class="' + (f.mono ? 'rm-mono' : '') + (f.upper ? ' rm-upper' : '') + '" spellcheck="' + (f.mono ? 'false' : 'true') + '">';
    }
    var show = f.show ? '<label class="rm-check rm-show"><input type="checkbox" name="' + f.show + '"' + (r && r[f.show] ? ' checked' : '') + '> ' + (f.show === 'show_email' ? 'Let people message me' : 'Show publicly') + '</label>' : '';
    return '<div class="rm-field' + (f.wide ? ' rm-wide-field' : '') + '">' + label + input + show +
      (f.help ? '<small class="rm-hint">' + esc(f.help) + '</small>' : '') + '</div>';
  }

  function managersHtml(r) {
    if (!isAdmin) return '';
    var ids = (r && r.managers) || [];
    return '<fieldset class="rm-group"><legend>Managers</legend><p class="rm-hint rm-note">People who can edit this repeater. Admins can edit every repeater.</p>' +
      '<div class="rm-checklist">' + (people.map(function (u) {
        return '<label class="rm-check"><input type="checkbox" name="managers" value="' + esc(u.id) + '"' + (ids.indexOf(u.id) >= 0 ? ' checked' : '') + '> ' +
          esc(u.name || u.email) + (u.role === 'admin' ? ' <span class="rd-muted">(admin)</span>' : '') + '</label>';
      }).join('') || '<span class="rd-muted">No people yet. Add them on the People tab.</span>') + '</div></fieldset>';
  }

  function openEditor(r) {
    editing = r || null;
    PANELS.forEach(function (p) { $('rm-p-' + p).hidden = true; });
    $('rm-p-editor').hidden = false;
    $('rm-editor-title').textContent = r ? r.name : 'Add a repeater';
    var view = $('rm-editor-view');
    view.hidden = !r;
    if (r) view.href = '/repeaters/#r-' + r.id;
    $('rm-delete').hidden = !(r && isAdmin);
    var defaults = r || { status: 'Online', owner_name: me.name || '', owner_callsign: me.callsign || '', contact_email: me.email || '', show_email: !!me.email };
    $('rm-editor-fields').innerHTML = GROUPS.map(function (g) {
      return '<fieldset class="rm-group"' + (g.id ? ' id="rm-g-' + g.id + '"' : '') + '><legend>' + esc(g.title) + '</legend>' +
        (g.note ? '<p class="rm-hint rm-note">' + esc(g.note) + '</p>' : '') +
        '<div class="rm-grid">' + g.fields.map(function (f) { return fieldHtml(f, defaults); }).join('') + '</div></fieldset>';
    }).join('') + managersHtml(r);
    followSetup(r);
    // "Let people message me" turns on by itself when an email is added to a
    // repeater that had none, unless the owner has set the box themselves.
    var em = $('rm-f-contact_email');
    if (em) em.dataset.startedEmpty = em.value.trim() ? '' : '1';
    if (r && !r.owner_name) toast('This repeater needs an owner name before it can be saved.', 'warn');
    $('rm-maint').hidden = !r;
    if (r) loadMaint(r);
    history.replaceState(null, '', r ? '#edit-' + r.id : '#new');
    window.scrollTo(0, $('rm-p-editor').getBoundingClientRect().top + window.pageYOffset - 90);
  }

  // ── "Use my profile" for a repeater's owner/contact info ─────
  var FOLLOW = ['owner_name', 'owner_callsign', 'contact_email', 'contact_phone', 'contact_discord'];
  function profileValues(u) {
    return { owner_name: u.name || '', owner_callsign: (u.callsign || '').toUpperCase(), contact_email: u.email || '', contact_phone: u.phone || '', contact_discord: u.discord || '' };
  }
  function followSetup(r) {
    var grid = document.querySelector('#rm-g-contact .rm-grid');
    if (!grid) return;
    var linked = r ? (r.contact_from || '') : '';
    var other = linked && linked !== me.id;
    var otherName = other && r.expand && r.expand.contact_from ? (r.expand.contact_from.name || r.expand.contact_from.email) : '';
    var startOn = r ? !!linked : !isAdmin;   // new repeaters you add follow your profile
    var box = document.createElement('div');
    box.className = 'rm-follow rm-wide-field';
    box.innerHTML = '<label class="rm-check"><input type="checkbox" id="rm-follow"' + (startOn ? ' checked' : '') + '> ' +
      (other ? 'Uses ' + esc(otherName || 'another manager') + '’s profile' : 'Use my profile for this repeater’s owner &amp; contact info') + '</label>' +
      '<small class="rm-hint">' + (other ? 'Untick to edit these details here instead.'
        : 'Name, callsign, email, phone and Discord come from <a href="#account" data-goto-account>My Account</a> and update when you change it there. Untick if this repeater needs different details. The ticks for what shows publicly stay per repeater.') + '</small>';
    box.dataset.linked = linked;
    grid.parentNode.insertBefore(box, grid);
    followApply(startOn && !other, startOn);
  }
  function followApply(fillFromMe, locked) {
    var form = $('rm-editor');
    if (fillFromMe) {
      var v = profileValues(me);
      FOLLOW.forEach(function (k) {
        var el = form.elements[k];
        if (el && el.value !== v[k]) { el.value = v[k]; el.dispatchEvent(new Event('input', { bubbles: true })); }
      });
    }
    FOLLOW.forEach(function (k) { var el = form.elements[k]; if (el) { el.readOnly = !!locked; el.classList.toggle('rm-locked', !!locked); } });
  }
  $('rm-editor-fields').addEventListener('change', function (e) {
    if (e.target.id !== 'rm-follow') return;
    var linked = e.target.closest('.rm-follow').dataset.linked;
    var other = linked && linked !== me.id;
    followApply(e.target.checked && !other, e.target.checked);
  });
  $('rm-editor-fields').addEventListener('click', function (e) {
    if (e.target.closest('[data-goto-account]')) { e.preventDefault(); showPanel('account', true); }
  });
  // what to send for contact_from: only when the tick changed
  function followData(data) {
    var cb = $('rm-follow');
    if (!cb) return;
    var linked = cb.closest('.rm-follow').dataset.linked;
    if (cb.checked && !linked) data.contact_from = me.id;
    else if (!cb.checked && linked) data.contact_from = '';
  }

  $('rm-editor-fields').addEventListener('input', function (e) {
    if (e.target.id !== 'rm-f-contact_email' || !e.target.dataset.startedEmpty) return;
    var box = $('rm-editor').show_email;
    if (box && !box.dataset.touched) box.checked = !!e.target.value.trim();
  });
  $('rm-editor-fields').addEventListener('change', function (e) {
    if (e.target.name === 'show_email') e.target.dataset.touched = '1';
    if (e.target.id !== 'rm-f-meshfind') return;
    var v = e.target.value;
    var tail = (v.match(/([0-9a-f]{8})$/) || [])[1];
    var n = tail && liveNodes.find(function (x) { return x.public_key.slice(0, 8) === tail && v.indexOf(x.name || 'Unnamed') === 0; });
    if (!n) return;
    var form = $('rm-editor');
    form.public_key.value = n.public_key;
    if (!form.prefix_3byte.value) form.prefix_3byte.value = n.public_key.slice(0, 6).toUpperCase();
    if (!form.path_hash_bytes.value && n.hash_size) form.path_hash_bytes.value = String(n.hash_size);
    if (!form.name.value) form.name.value = n.name || '';
    toast('Filled in the public key for “' + (n.name || n.public_key.slice(0, 8)) + '”.');
  });

  function collect(form) {
    var data = {};
    GROUPS.forEach(function (g) {
      g.fields.forEach(function (f) {
        if (f.type === 'meshfind') return;
        var el = form.elements[f.k];
        var v = el ? el.value.trim() : '';
        if (f.upper) v = v.toUpperCase();
        if (f.k === 'public_key') v = v.toLowerCase();
        if (f.k === 'install_date') v = fromInputDate(v);
        if (f.k === 'path_hash_bytes') v = v ? Number(v) : 0;
        data[f.k] = v;
        if (f.show) data[f.show] = !!form.elements[f.show].checked;
      });
    });
    if (isAdmin) {
      data.managers = Array.prototype.filter.call(form.querySelectorAll('input[name=managers]'), function (c) { return c.checked; })
        .map(function (c) { return c.value; });
    }
    return data;
  }

  $('rm-editor').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = this;
    var data = collect(form);
    if (!data.name) { toast('Give the repeater a name.', 'bad'); form.name.focus(); return; }
    if (!data.owner_name) { toast('The owner name is required.', 'bad'); form.owner_name.focus(); return; }
    if (data.public_key && !/^[0-9a-f]{64}$/.test(data.public_key)) { toast('The public key should be 64 characters, 0–9 and a–f.', 'bad'); form.public_key.focus(); return; }
    if (!data.prefix_3byte && data.public_key) data.prefix_3byte = data.public_key.slice(0, 6).toUpperCase();
    if (!editing && !isAdmin) data.managers = [me.id];
    if (!editing) data.source = 'manual';
    followData(data);
    busy(form, true);
    var req = editing
      ? pb.collection('repeaters').update(editing.id, data, { expand: 'managers,contact_from' })
      : pb.collection('repeaters').create(data, { expand: 'managers,contact_from' });
    req.then(function (rec) {
      var i = repeaters.findIndex(function (x) { return x.id === rec.id; });
      if (i >= 0) repeaters[i] = rec; else repeaters.push(rec);
      repeaters.sort(function (a, b) { return a.name.localeCompare(b.name); });
      toast(editing ? 'Saved “' + rec.name + '”.' : 'Added “' + rec.name + '”.');
      renderRepeaters();
      openEditor(rec);
    }).catch(function (err) {
      if (editing && err.status === 404) return goneFromList(editing);
      toast(errText(err), 'bad', true);
    }).then(function () { busy(form, false); });
  });

  // The repeater was deleted (e.g. in another tab) or the user lost access:
  // say so plainly and reload the list instead of a vague permission error.
  function goneFromList(r) {
    toast('“' + r.name + '” isn’t in your list anymore. It was already deleted' +
      (isAdmin ? '' : ', or you’re no longer one of its managers') + '. The list has been refreshed.', 'warn', true);
    editing = null;
    showPanel('repeaters', true);
    return loadAll();
  }

  $('rm-editor-back').addEventListener('click', function () { showPanel('repeaters', true); renderRepeaters(); });
  $('rm-delete').addEventListener('click', function () {
    var btn = this, r = editing;
    if (!r) return;
    confirmClick(btn, 'Delete repeater', function () {
      pb.collection('repeaters').delete(r.id).then(function () {
        repeaters = repeaters.filter(function (x) { return x.id !== r.id; });
        toast('Deleted “' + r.name + '”.');
        showPanel('repeaters', true); renderRepeaters();
      }).catch(function (err) {
        if (err.status === 404) return goneFromList(r);
        toast(errText(err), 'bad');
      });
    });
  });

  // ── maintenance log ──────────────────────────────────────────
  function loadMaint(r) {
    $('rm-maint-list').innerHTML = '<li class="rd-muted">Loading…</li>';
    $('rm-maint-form').date.value = today();
    pb.collection('maintenance').getFullList({ filter: pb.filter('repeater = {:id}', { id: r.id }), sort: '-date' }).then(function (items) {
      if (editing !== r) return;
      $('rm-maint-list').innerHTML = items.map(function (m) {
        return '<li><span class="rd-log-date">' + esc(fmtDate(m.date)) + '</span><span>' + esc(m.notes) +
          (m.author ? ' <span class="rd-muted">— ' + esc(m.author) + '</span>' : '') +
          ' <button type="button" class="rm-link rm-x" data-del-maint="' + esc(m.id) + '">Remove</button></span></li>';
      }).join('') || '<li class="rd-muted">No entries yet.</li>';
    }).catch(function (err) { $('rm-maint-list').innerHTML = '<li class="rd-muted">' + esc(errText(err)) + '</li>'; });
  }
  $('rm-maint-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this, r = editing;
    if (!r || !f.notes.value.trim() || !f.date.value) { toast('Add a date and what was done.', 'bad'); return; }
    busy(f, true);
    pb.collection('maintenance').create({ repeater: r.id, date: fromInputDate(f.date.value), notes: f.notes.value.trim(), author: me.name || '' })
      .then(function () { f.notes.value = ''; toast('Entry added.'); loadMaint(r); })
      .catch(function (err) { toast(errText(err), 'bad'); })
      .then(function () { busy(f, false); });
  });
  $('rm-maint-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del-maint]');
    if (!b) return;
    confirmClick(b, 'Remove', function () {
      pb.collection('maintenance').delete(b.getAttribute('data-del-maint'))
        .then(function () { loadMaint(editing); })
        .catch(function (err) { toast(errText(err), 'bad'); });
    });
  });

  // ── people (admins) ──────────────────────────────────────────
  function repsFor(uid) { return repeaters.filter(function (r) { return (r.managers || []).indexOf(uid) >= 0; }); }
  function renderPeople() {
    if (!isAdmin) return;
    $('rm-people-body').innerHTML = people.map(function (u) {
      var reps = repsFor(u.id);
      var self = u.id === me.id;
      return '<tr><td><strong>' + esc(u.name || '—') + '</strong>' + (u.callsign ? ' <span class="rd-mono">' + esc(u.callsign) + '</span>' : '') +
        (self ? ' <span class="rd-muted">(you)</span>' : '') +
        '<div class="rm-sub rm-show-sm">' + esc(u.email) + '</div>' +
        (!u.verified ? '<div class="rm-sub"><span class="rd-pill warn">Hasn’t signed in yet</span></div>' : '') + '</td>' +
        '<td class="rm-hide-sm">' + esc(u.email) + '</td>' +
        '<td><span class="rd-pill ' + (u.role === 'admin' ? 'ok' : 'info') + '">' + (u.role === 'admin' ? 'Admin' : 'User') + '</span></td>' +
        '<td class="rm-hide-sm">' + (reps.length ? esc(reps.map(function (r) { return r.name; }).join(', ')) : '<span class="rd-muted">—</span>') + '</td>' +
        '<td class="rm-right rm-nowrap"><button type="button" class="btn btn-secondary rm-sm" data-person="' + esc(u.id) + '">Edit</button>' +
        (!u.verified ? ' <button type="button" class="rm-link" data-invite="' + esc(u.id) + '">Resend invite</button>' : '') +
        (!self ? ' <button type="button" class="rm-link rm-x" data-remove="' + esc(u.id) + '">Remove</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="rd-muted">No people yet.</td></tr>';
  }

  function personRepsHtml(selected) {
    var q = ($('rm-person-rep-q').value || '').toLowerCase();
    return repeaters.map(function (r) {
      var hide = q && r.name.toLowerCase().indexOf(q) < 0;
      return '<label class="rm-check"' + (hide ? ' hidden' : '') + '><input type="checkbox" name="reps" value="' + esc(r.id) + '"' +
        (selected.indexOf(r.id) >= 0 ? ' checked' : '') + '> ' + esc(r.name) +
        (!r.owner_name ? ' <span class="rd-muted">(no owner)</span>' : '') + '</label>';
    }).join('') || '<span class="rd-muted">No repeaters yet.</span>';
  }
  function openPersonForm(u) {
    editingPerson = u || null;
    var f = $('rm-person-form');
    f.hidden = false;
    f.reset();
    $('rm-person-rep-q').value = '';
    $('rm-person-title').textContent = u ? 'Edit ' + (u.name || u.email) : 'Add a person';
    $('rm-person-submit').textContent = u ? 'Save' : 'Add person';
    $('rm-invite-wrap').hidden = !!u;
    f.name.value = u ? u.name || '' : '';
    f.email.value = u ? u.email || '' : '';
    f.email.disabled = !!u;
    f.callsign.value = u ? u.callsign || '' : '';
    f.role.value = u && u.role === 'admin' ? 'admin' : 'user';
    f.role.disabled = !!(u && u.id === me.id);
    $('rm-person-reps').innerHTML = personRepsHtml(u ? repsFor(u.id).map(function (r) { return r.id; }) : []);
    f.name.focus();
  }
  $('rm-person-rep-q').addEventListener('input', function () {
    var q = this.value.toLowerCase();
    $('rm-person-reps').querySelectorAll('label').forEach(function (l) { l.hidden = q && l.textContent.toLowerCase().indexOf(q) < 0; });
  });
  $('rm-add-person').addEventListener('click', function () { openPersonForm(null); });
  $('rm-person-cancel').addEventListener('click', function () { $('rm-person-form').hidden = true; editingPerson = null; });

  // add/remove a manager on each repeater whose checkbox changed
  function syncRepeaters(user, wanted) {
    var jobs = [];
    repeaters.forEach(function (r) {
      var has = (r.managers || []).indexOf(user.id) >= 0, want = wanted.indexOf(r.id) >= 0;
      if (has === want) return;
      var body = want ? { 'managers+': user.id } : { 'managers-': user.id };
      if (want && !r.owner_name) { body.owner_name = user.name; if (user.callsign && !r.owner_callsign) body.owner_callsign = user.callsign; }
      jobs.push(pb.collection('repeaters').update(r.id, body, { expand: 'managers' }).then(function (rec) {
        var i = repeaters.findIndex(function (x) { return x.id === rec.id; }); repeaters[i] = rec;
      }));
    });
    return Promise.all(jobs);
  }

  $('rm-person-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    var name = f.name.value.trim(), email = f.email.value.trim(), callsign = f.callsign.value.trim().toUpperCase(), role = f.role.value;
    var wanted = Array.prototype.filter.call(f.querySelectorAll('input[name=reps]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
    if (!name) { toast('Enter their name.', 'bad'); return; }
    if (!editingPerson && !/^\S+@\S+\.\S+$/.test(email)) { toast('Enter a valid email.', 'bad'); return; }
    busy(f, true);
    var job;
    if (editingPerson) {
      var body = { name: name, callsign: callsign };
      if (editingPerson.id !== me.id) body.role = role;
      job = pb.collection('users').update(editingPerson.id, body);
    } else {
      var pw = randomPassword();
      job = pb.collection('users').create({ name: name, email: email, callsign: callsign, role: role, emailVisibility: false, password: pw, passwordConfirm: pw });
    }
    var invite = !editingPerson && f.invite.checked;
    job.then(function (user) {
      var i = people.findIndex(function (x) { return x.id === user.id; });
      if (i >= 0) people[i] = user; else people.push(user);
      people.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      return syncRepeaters(user, wanted).then(function () {
        if (invite) return pb.collection('users').requestPasswordReset(user.email).then(function () { return 'invited'; }, function () { return 'invite-failed'; });
      }).then(function (inv) {
        f.hidden = true;
        toast((editingPerson ? 'Saved ' : 'Added ') + user.name + '.' +
          (inv === 'invited' ? ' An invite is on its way to ' + user.email + '.' : inv === 'invite-failed' ? ' The invite email couldn’t be sent; they can still sign in with a code.' : ''));
        editingPerson = null;
        renderAll();
      });
    }).catch(function (err) { toast(errText(err), 'bad', true); })
      .then(function () { busy(f, false); });
  });

  $('rm-people-body').addEventListener('click', function (e) {
    var edit = e.target.closest('[data-person]'), inv = e.target.closest('[data-invite]'), rm = e.target.closest('[data-remove]');
    if (edit) openPersonForm(people.find(function (u) { return u.id === edit.getAttribute('data-person'); }));
    if (inv) {
      var u = people.find(function (x) { return x.id === inv.getAttribute('data-invite'); });
      pb.collection('users').requestPasswordReset(u.email).then(function () { toast('Invite sent to ' + u.email + '. Its link lets them choose a password.'); })
        .catch(function (err) { toast(errText(err), 'bad'); });
    }
    if (rm) {
      var who = people.find(function (x) { return x.id === rm.getAttribute('data-remove'); });
      confirmClick(rm, 'Remove', function () {
        pb.collection('users').delete(who.id).then(function () {
          people = people.filter(function (x) { return x.id !== who.id; });
          repeaters.forEach(function (r) { r.managers = (r.managers || []).filter(function (id) { return id !== who.id; }); });
          toast('Removed ' + (who.name || who.email) + '. Their repeaters stay in the directory.');
          loadAll();
        }).catch(function (err) { toast(errText(err), 'bad'); });
      });
    }
  });

  // ── prefixes (users: their own reservations; admins: all) ─────
  // A prefix is whole bytes (4 or 6 hex characters). MeshCore throws away keys
  // whose first byte is 00 or FF ("reserved id hashes"), so those never occur.
  function prefixProblem(code) {
    if (!/^[0-9A-F]+$/.test(code)) return 'Use only 0–9 and A–F.';
    if (code.length !== 4 && code.length !== 6) return 'A prefix is exactly 4 characters (2 bytes) or 6 characters (3 bytes), like B3A1 or B3A1C2.';
    if (/^(00|FF)/.test(code)) return 'Prefixes can’t start with 00 or FF. MeshCore reserves those.';
    return '';
  }
  function renderPrefixes() {
    $('rm-prefix-title').textContent = isAdmin ? 'Reserved Prefixes' : 'My Reserved Prefixes';
    $('rm-prefix-sub').textContent = 'A prefix is 4 characters (2 bytes) or 6 characters (3 bytes), 0–9 and A–F, and can’t start with 00 or FF. ' +
      (isAdmin ? 'Anyone can reserve up to 5 from the public Prefixes page. Admins have no limit and can replace old 1-byte reservations, which are marked; reserve them again with 2 bytes, then remove the old one.'
        : 'Reserve one before you generate your repeater’s key, then generate a key that starts with it. You can hold up to 5.');
    var cols = isAdmin ? 5 : 4;
    $('rm-prefix-body').innerHTML = prefixes.map(function (p) {
      var who = [p.reserved_by_name, p.reserved_by_callsign, p.reserved_by_email].filter(Boolean).map(esc).join(' · ');
      return '<tr data-prefix-row="' + esc(p.id) + '"><td><span class="rd-mono">' + esc(p.code) + '</span>' + (p.code.length === 2 ? ' <span class="rd-pill warn">1-byte</span>' : prefixProblem(String(p.code).toUpperCase()) ? ' <span class="rd-pill bad" title="Not a valid prefix. Remove it and reserve a 4- or 6-character one.">Invalid</span>' : '') + '</td>' +
        '<td><span class="rm-prefix-label">' + esc(p.label) + '</span></td>' +
        (isAdmin ? '<td class="rd-muted">' + (who || '—') + '</td>' : '') +
        '<td class="rd-muted rm-since rm-hide-sm">' + esc(fmtDate(p.created)) + '</td>' +
        '<td class="rm-right"><button type="button" class="rm-link" data-rename-prefix="' + esc(p.id) + '">Rename</button> ' +
        '<button type="button" class="rm-link rm-x" data-del-prefix="' + esc(p.id) + '">' + (isAdmin ? 'Remove' : 'Release') + '</button></td></tr>';
    }).join('') || '<tr><td colspan="' + cols + '" class="rd-muted">' + (isAdmin ? 'No reservations yet.' : 'You haven’t reserved a prefix yet. Reserve one above, or from the public Prefixes page.') + '</td></tr>';
  }
  $('rm-prefix-form').code.addEventListener('input', function () {
    var code = this.value.trim().toUpperCase();
    $('rm-prefix-hint').textContent = code.length >= 4 || /[^0-9A-Fa-f]/.test(code) || /^(00|FF)/.test(code) ? prefixProblem(code) : '';
  });
  $('rm-prefix-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this, code = f.code.value.trim().toUpperCase(), label = f.label.value.trim();
    var bad = prefixProblem(code);
    if (bad) { toast(bad, 'bad'); f.code.focus(); return; }
    if (!label) { toast('Say what the prefix is for, like the repeater’s name or location.', 'bad'); f.label.focus(); return; }
    var data = { code: code, label: label };
    if (isAdmin) {
      var email = f.email.value.trim();
      if (email) { data.reserved_by_email = email; var u = people.find(function (x) { return (x.email || '').toLowerCase() === email.toLowerCase(); }); if (u) { data.user = u.id; data.reserved_by_name = u.name; data.reserved_by_callsign = u.callsign || ''; } }
    } else {
      data.reserved_by_name = me.name || me.email; data.reserved_by_email = me.email; data.reserved_by_callsign = me.callsign || '';
    }
    busy(f, true);
    pb.collection('prefixes').create(data).then(function (p) {
      prefixes.push(p); prefixes.sort(function (a, b) { return a.code.localeCompare(b.code); });
      f.reset(); $('rm-prefix-hint').textContent = ''; renderPrefixes();
      toast('Reserved ' + code + '.' + (isAdmin ? '' : ' A confirmation email is on its way.'));
    }).catch(function (err) {
      toast(err && err.status === 429 ? 'Too many reservations in a short time. Please wait a few minutes.' : errText(err), 'bad');
    }).then(function () { busy(f, false); });
  });
  $('rm-prefix-body').addEventListener('click', function (e) {
    var ren = e.target.closest('[data-rename-prefix]');
    if (ren) {
      var p = prefixes.find(function (x) { return x.id === ren.getAttribute('data-rename-prefix'); });
      var cell = ren.closest('tr').querySelector('.rm-prefix-label');
      if (!p || cell.querySelector('input')) return;
      cell.innerHTML = '<input class="rm-inline" maxlength="120" value="' + esc(p.label) + '" aria-label="What it’s for">';
      var inp = cell.querySelector('input');
      inp.focus(); inp.select();
      var done = false;
      var finish = function (save) {
        if (done) return; done = true;
        var v = inp.value.trim();
        if (!save || !v || v === p.label) { renderPrefixes(); return; }
        pb.collection('prefixes').update(p.id, { label: v }).then(function (rec) {
          Object.assign(p, rec); renderPrefixes(); toast('Renamed ' + p.code + '.');
        }).catch(function (err) { renderPrefixes(); toast(errText(err), 'bad'); });
      };
      inp.addEventListener('keydown', function (k) { if (k.key === 'Enter') { k.preventDefault(); finish(true); } else if (k.key === 'Escape') finish(false); });
      inp.addEventListener('blur', function () { finish(true); });
      return;
    }
    var b = e.target.closest('[data-del-prefix]');
    if (!b) return;
    var label = b.textContent;
    confirmClick(b, label, function () {
      var id = b.getAttribute('data-del-prefix');
      pb.collection('prefixes').delete(id).then(function () {
        var gone = prefixes.find(function (p) { return p.id === id; });
        prefixes = prefixes.filter(function (p) { return p.id !== id; }); renderPrefixes();
        if (gone) toast((isAdmin ? 'Removed ' : 'Released ') + gone.code + '.');
      }).catch(function (err) { toast(errText(err), 'bad'); });
    });
  });

  // ── account ──────────────────────────────────────────────────
  $('rm-account-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this, name = f.name.value.trim();
    if (!name) { toast('Your name is required.', 'bad'); return; }
    busy(f, true);
    pb.collection('users').update(me.id, { name: name, callsign: f.callsign.value.trim().toUpperCase(), phone: f.phone.value.trim(), discord: f.discord.value.trim() }).then(function (u) {
      me = u; $('rm-me-name').textContent = u.name;
      var linked = repeaters.filter(function (r) { return r.contact_from === me.id; }).length;
      toast('Saved.' + (linked ? ' Updated the contact info on ' + linked + (linked === 1 ? ' repeater that uses' : ' repeaters that use') + ' your profile.' : ''));
      if (linked) return loadAll();
    }).catch(function (err) { toast(errText(err), 'bad'); }).then(function () { busy(f, false); });
  });
  $('rm-set-password').addEventListener('click', function () {
    pb.collection('users').requestPasswordReset(me.email).then(function () {
      toast('We emailed ' + me.email + ' a link to set your password.');
    }).catch(function (err) { toast(errText(err), 'bad'); });
  });

  // email inside a PocketBase token (verify / reset links carry it)
  function tokenEmail(tok) {
    try { return JSON.parse(atob(tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || ''; } catch (_) { return ''; }
  }
  // ── links from emails: #verify=TOKEN (old invites) and #reset=TOKEN (invite / set password) ──
  var link = location.hash.match(/^#(verify|reset)=([A-Za-z0-9._-]+)$/);
  if (link) history.replaceState(null, '', location.pathname);
  if (link && link[1] === 'verify') {
    pb.collection('users').confirmVerification(link[2]).then(function () {
      var addr = tokenEmail(link[2]);
      toast('Your email is confirmed. Sign in below with an emailed code' + (addr ? ', or set a password:' : '.'), 'ok', true);
      if (addr) {
        var t = $('rm-toast'), b = document.createElement('button');
        b.type = 'button'; b.className = 'rm-link'; b.textContent = 'Email me a link to set a password';
        b.addEventListener('click', function () {
          b.disabled = true;
          pb.collection('users').requestPasswordReset(addr).then(function () { toast('Sent. Check ' + addr + ' for “Set your password”.', 'ok', true); })
            .catch(function (err) { b.disabled = false; toast(errText(err), 'bad'); });
        });
        t.appendChild(document.createTextNode(' ')); t.appendChild(b);
      }
      var pf = $('rm-pass-form'), cf = $('rm-code-form');
      if (addr) { if (cf && cf.email) cf.email.value = addr; if (pf && pf.email) pf.email.value = addr; }
    }).catch(function () {
      toast('That confirmation link has expired or was already used. You can still sign in below with an emailed code.', 'warn', true);
    });
  }
  $('rm-reset-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    if (f.password.value.length < 8) { toast('Use at least 8 characters.', 'bad'); return; }
    if (f.password.value !== f.confirm.value) { toast('The two passwords don’t match.', 'bad'); return; }
    busy(f, true);
    var pw = f.password.value, addr = tokenEmail(f.dataset.token);
    pb.collection('users').confirmPasswordReset(f.dataset.token, pw, f.confirm.value).then(function () {
      f.reset();
      $('rm-reset').hidden = true;
      // sign straight in with the new password
      return (addr ? pb.collection('users').authWithPassword(addr, pw) : Promise.reject()).then(function () {
        toast('Password saved. You’re signed in.');
        signedIn();
      }, function () {
        toast('Password saved. Sign in with it below.');
        document.querySelector('.rm-seg button[data-method=password]').click();
        pb.authStore.clear();
        signedOut();
      });
    }).catch(function (err) {
      toast(err.status === 400 ? 'That link has expired or was already used. Ask for a new one from “Forgot your password”.' : errText(err), 'bad', true);
    }).then(function () { busy(f, false); });
  });


  // Observer ownership lives in PocketBase, independent of the live analyzer.
  var managedObservers=[], observerClaims=[];
  function updateClaimCount(){
    var n=claims.filter(function(c){return c.status==='pending';}).length+observerClaims.filter(function(c){return c.status==='pending';}).length;
    $('rm-claims-count').textContent=n||'';
  }
  function loadObservers(){
    $('rm-obs-title').textContent=isAdmin?'All Managed Observers':'My Observers';
    $('rm-obs-msg').textContent='Loading observers…';
    return pb.collection('managed_observers').getFullList({sort:'observer_name'}).then(function(records){
      managedObservers=records;
      if(isAdmin)return pb.collection('users').getFullList({sort:'name'}).then(function(p){people=p;});
    }).then(function(){
      $('rm-obs-msg').textContent='';
      renderObservers();
    }).catch(function(err){
      $('rm-obs-msg').textContent='Observer management is not available: '+errText(err);
      $('rm-obs-list').innerHTML='';
    });
  }
  function renderObservers(){
    $('rm-obs-list').innerHTML=managedObservers.map(function(o){
      function field(key,label,max){return '<label class="rm-field"><span>'+label+'</span><input name="'+key+'" maxlength="'+max+'" value="'+esc(o[key]||'')+'"></label>';}
      var link=ANALYZER+'/#/observers/'+encodeURIComponent(o.observer_id);
      var assigned=o.managers||[];
      var options=isAdmin?'<fieldset class="rm-field"><legend>Assigned managers</legend><div class="rm-checklist">'+people.map(function(p){
        return '<label class="rm-check"><input type="checkbox" name="managers" value="'+esc(p.id)+'" '+(assigned.indexOf(p.id)>=0?'checked':'')+'> '+esc(p.name||p.email)+'</label>';
      }).join('')+'</div><p class="rm-hint">Only admins can add or remove managers.</p></fieldset>':'';
      return '<form class="rm-card rm-form" data-observer-edit="'+esc(o.id)+'"><h3>'+esc(o.observer_name)+'</h3><p class="rd-muted">'+esc(o.region||'Unknown region')+' · <a href="'+esc(link)+'" target="_blank" rel="noopener">Open in analyzer ↗</a></p>'+
        '<p class="rd-muted">The fields below are public. Do not enter private contact details or precise private locations.</p><div class="rm-grid">'+field('display_name','Directory display name',100)+field('area','General area',100)+field('hardware','Hardware',200)+field('public_owner','Public owner name / callsign (optional)',100)+'</div>'+
        '<label class="rm-field"><span>Public notes</span><textarea name="notes" maxlength="2000" rows="3">'+esc(o.notes||'')+'</textarea></label>'+options+
        '<div class="rm-actions rm-actions-end"><button type="submit" class="btn btn-primary">Save observer</button></div></form>';
    }).join('')||'<p class="rd-muted">No observers assigned yet. <a href="/repeaters/#observers">Claim an observer</a>.</p>';
  }
  $('rm-obs-list').addEventListener('submit',function(e){
    var form=e.target.closest('[data-observer-edit]');if(!form)return;e.preventDefault();
    var body={};['display_name','area','hardware','public_owner','notes'].forEach(function(k){body[k]=form.elements[k].value.trim();});
    if(isAdmin)body.managers=Array.from(form.querySelectorAll('input[name=managers]:checked')).map(function(x){return x.value;});
    busy(form,true);
    pb.collection('managed_observers').update(form.getAttribute('data-observer-edit'),body).then(function(o){
      var i=managedObservers.findIndex(function(x){return x.id===o.id;});if(i>=0)managedObservers[i]=o;
      toast('Observer saved.');
    }).catch(function(err){toast(errText(err),'bad');}).then(function(){busy(form,false);});
  });
  function loadObserverClaims(){
    if(!isAdmin)return Promise.resolve();
    return pb.collection('observer_claims').getList(1,200,{sort:'-created'}).then(function(r){
      observerClaims=r.items;$('rm-obs-claims-msg').textContent='';renderObserverClaims();updateClaimCount();
    }).catch(function(err){$('rm-obs-claims-msg').textContent='Observer claims unavailable: '+errText(err);});
  }
  function renderObserverClaims(){
    $('rm-obs-claims-body').innerHTML=observerClaims.filter(function(c){return c.status==='pending';}).map(function(c){
      return '<tr><td><strong><a href="'+esc(ANALYZER+'/#/observers/'+encodeURIComponent(c.observer_id))+'" target="_blank" rel="noopener">'+esc(c.observer_name||c.observer_id)+'</a></strong><div class="rm-sub">'+esc(c.region)+'</div></td>'+
        '<td>'+esc(c.name)+' '+esc(c.callsign)+'<div class="rm-sub">'+esc(c.email)+'</div><div class="rm-sub rm-show-sm">'+esc(c.note)+'</div></td>'+
        '<td class="rm-hide-sm">'+esc(c.note||'—')+'</td><td class="rm-right rm-nowrap"><button type="button" class="btn btn-primary rm-sm" data-obs-approve="'+esc(c.id)+'">Approve</button> <button type="button" class="rm-link rm-x" data-obs-decline="'+esc(c.id)+'">Decline</button></td></tr>';
    }).join('')||'<tr><td colspan="4" class="rd-muted">No observer claims waiting.</td></tr>';
    $('rm-obs-claims-done').innerHTML=observerClaims.filter(function(c){return c.status!=='pending';}).slice(0,15).map(function(c){
      return '<li><span class="rd-pill '+(c.status==='approved'?'ok':'off')+'">'+(c.status==='approved'?'Approved':'Declined')+'</span> '+esc(c.name)+' → '+esc(c.observer_name||c.observer_id)+'</li>';
    }).join('')||'<li class="rd-muted">Nothing yet.</li>';
  }
  $('rm-obs-claims-body').addEventListener('click',function(e){
    var yes=e.target.closest('[data-obs-approve]'), no=e.target.closest('[data-obs-decline]'), btn=yes||no;
    if(!btn||!isAdmin)return;
    var id=btn.getAttribute(yes?'data-obs-approve':'data-obs-decline');
    confirmClick(btn,yes?'Approve':'Decline',function(){
      btn.disabled=true;
      var job=yes?pb.send('/api/directory/observer-claims/'+encodeURIComponent(id)+'/approve',{method:'POST'}):pb.collection('observer_claims').update(id,{status:'declined',handled_by:me.id});
      job.then(function(r){
        toast(yes?'Observer claim approved'+(r.emailed?'; email sent.':'; email could not be sent. Contact the claimant.'):'Observer claim declined.',yes&&!r.emailed?'warn':'ok',yes&&!r.emailed);
        return Promise.all([loadObserverClaims(),loadObservers()]);
      }).catch(function(err){btn.disabled=false;toast(errText(err),'bad');});
    });
  });

  // ── start ────────────────────────────────────────────────────
  if (link && link[1] === 'reset') {
    $('rm-reset-form').dataset.token = link[2];
    var who = tokenEmail(link[2]);
    if (who) { $('rm-reset-for').textContent = ' as ' + who; $('rm-reset-user').value = who; }
    $('rm-loading').hidden = true;
    $('rm-reset').hidden = false;
  } else if (pb.authStore.isValid && pb.authStore.record && pb.authStore.record.collectionName === 'users') {
    pb.collection('users').authRefresh().then(signedIn).catch(function () { pb.authStore.clear(); signedOut(); });
  } else {
    pb.authStore.clear();
    signedOut();
  }
})();
