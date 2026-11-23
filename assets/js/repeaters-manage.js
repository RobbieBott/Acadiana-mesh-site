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
  var repeaterBackPanel = 'repeaters';
  var observerBackPanel = 'observers';
  var myDeviceLoads = { repeaters: 'loading', observers: 'loading' };

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

  var isSiteOwner = false;
  var permissionRevision = 0;
  var staff = new Set();
  var permissionDefinitions = {};
  var claimRepeaterNames = new Map();
  function can() { return Array.from(arguments).some(function (key) { return staff.has(key); }); }
  function peoplePanel() { return can('read_people','edit_people','invite_users','assign_repeaters','assign_observers') || isSiteOwner; }
  function repeaterClaims() { return can('read_repeater_claims','approve_repeater_claims'); }
  function observerClaimAccess() { return can('read_observer_claims','approve_observer_claims'); }
  function allRepeaters() { return can('read_repeaters','edit_repeaters','assign_repeaters','manage_maintenance'); }
  function allObservers() { return can('read_observers','edit_observers','assign_observers'); }
  function manages(record) { return (record.managers || []).includes(me.id); }
  function canEditRepeater(record) { return !record || can('edit_repeaters') || manages(record); }
  function canEditObserver(record) { return can('edit_observers') || manages(record); }
  var ownerMail = window.createOwnerMail(pb, $, function (access) {
    isSiteOwner = !!access.owner;
    staff = new Set(access.staff || []);
    $('rm-mail-tab').hidden = !access.sender;
    $('rm-permissions-tab').hidden = !isSiteOwner;
    document.querySelector('#rm-tabs [data-panel=people]').hidden = !peoplePanel();
    document.querySelector('#rm-tabs [data-panel=claims]').hidden = !repeaterClaims() && !observerClaimAccess();
    document.querySelectorAll('[data-admin-only]').forEach(function (element) { element.hidden = !can('read_prefixes','manage_prefixes'); });
    $('rm-me-role').textContent = isSiteOwner ? 'Site Owner' : isAdmin ? 'Admin' : 'User';
    $('rm-rep-title').textContent = allRepeaters() ? 'All Repeaters' : 'My Repeaters';
    $('rm-sync').hidden = !can('sync_corescope');
    $('rm-add-person').hidden = !can('invite_users');
    $('rm-repeater-claims').hidden = !repeaterClaims();
    $('rm-observer-claims').hidden = !observerClaimAccess();
    root.classList.toggle('rm-is-admin', allRepeaters());
    if (!pb.authStore.isValid) return;
    var destination = location.hash.slice(1);
    showPanel(destination || 'my-devices', false);
    loadAll().then(function () {
      var match = location.hash.match(/^#edit-([a-z0-9]+)$/);
      if (match) {
        var record = repeaters.find(function (item) { return item.id === match[1]; });
        if (record) openEditor(record);
      }
    });
    loadObservers();
    if (observerClaimAccess()) loadObserverClaims();
  });

  // ── layout / tabs ────────────────────────────────────────────
  var PANELS = ['my-devices', 'repeaters', 'observers', 'claims', 'people', 'prefixes', 'owner-mail', 'permissions', 'account'];
  function showPanel(name, push) {
    if (PANELS.indexOf(name) < 0 || (name === 'permissions' && !isSiteOwner) || (name === 'owner-mail' && !ownerMail.canSend()) || (name === 'people' && !peoplePanel()) || (name === 'claims' && !repeaterClaims() && !observerClaimAccess())) name = 'repeaters';
    PANELS.forEach(function (p) { $('rm-p-' + p).hidden = p !== name; });
    $('rm-p-editor').hidden = true;
    document.querySelectorAll('#rm-tabs [data-panel]').forEach(function (a) {
      var on = a.getAttribute('data-panel') === name;
      a.classList.toggle('active', on);
      a.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (name === 'my-devices') renderMyDevices();
    if (name === 'observers') closeObserverEditor();
    if (name === 'owner-mail') ownerMail.open();
    if (name === 'permissions') loadPermissions();
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
    repeaters = [];
    managedObservers = [];
    liveObservers = [];
    myDeviceLoads = { repeaters: 'loading', observers: 'loading' };
    renderMyDevices();
    $('rm-obs-q').value = '';
    $('rm-obs-list').replaceChildren();
    closeObserverEditor();
    peopleObserverStatus = 'Loading…';
    $('rm-signin').hidden = true;
    $('rm-app').hidden = false;
    $('rm-tabs').hidden = false;
    $('rm-loading').hidden = true;
    $('rm-me-name').textContent = me.name || me.email;
    var af = $('rm-account-form');
    af.name.value = me.name || ''; af.callsign.value = me.callsign || ''; af.email.value = me.email || '';
    af.phone.value = me.phone || ''; af.discord.value = me.discord || '';
    ownerMail.signIn();
    loadLive();
  }

  function signedOut() {
    observerLoadVersion++;
    ownerMail.signOut();
    permissionRevision++;
    $('rm-permissions-body').replaceChildren();
    $('rm-loading').hidden = true;
    $('rm-signin').hidden = false;
    $('rm-app').hidden = true;
    $('rm-tabs').hidden = true;
  }

  // ── data ─────────────────────────────────────────────────────
  function loadAll() {
    var privateRecords = pb.collection('repeaters').getFullList({ sort: 'name', expand: 'managers,contact_from' });
    var peopleReady = loadPeople();
    var editableRecords = Promise.all([privateRecords, peopleReady]).then(function (results) {
      repeaters = results[0];
      myDeviceLoads.repeaters = 'ready';
      renderMyDevices();
    }, function (error) {
      myDeviceLoads.repeaters = 'error';
      renderMyDevices();
      throw error;
    });
    var readPublic = repeaterClaims() || can('manage_maintenance');
    var publicRecords = readPublic ? pb.collection('repeaters_public').getFullList({ sort: 'name', fields: 'id,name,owner_name,status,area' }) : Promise.resolve([]);
    var jobs = [
      Promise.all([editableRecords, publicRecords]).then(function (lists) {
        var publicList = lists[1];
        claimRepeaterNames = new Map(publicList.map(function (r) { return [r.id, r]; }));
        if (can('manage_maintenance')) {
          var privateIds = new Set(repeaters.map(function (r) { return r.id; }));
          repeaters = repeaters.concat(publicList.filter(function (r) { return !privateIds.has(r.id); }));
        }
      }),
      pb.collection('prefixes').getFullList({ sort: 'code' }).then(function (l) { prefixes = l; }),
      peopleReady
    ];
    if (repeaterClaims()) jobs.push(loadClaims());
    return Promise.all(jobs).then(renderAll).catch(function (err) { toast(errText(err), 'bad', true); });
  }
  function loadPeople() {
    if (can('read_people','edit_people')) {
      return pb.collection('users').getFullList({ sort: 'name', requestKey: null }).then(function (l) { people = l; });
    }
    if (can('assign_repeaters','assign_observers')) {
      return pb.send('/api/directory/assignment-people', { requestKey: null }).then(function (r) { people = r.people; });
    }
    people = [];
    return Promise.resolve();
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
    if (!repeaterClaims()) return;
    var pending = claims.filter(function (c) { return c.status === 'pending'; });
    updateClaimCount();
    $('rm-claims-body').innerHTML = pending.map(function (c) {
      var rep = (c.expand && c.expand.repeater) || claimRepeaterNames.get(c.repeater) || {};
      return '<tr><td><strong>' + esc(rep.name || '—') + '</strong>' + (rep.owner_name ? '<div class="rm-sub">Owner: ' + esc(rep.owner_name) + '</div>' : '<div class="rm-sub">No owner yet</div>') + '</td>' +
        '<td>' + esc(c.name) + (c.callsign ? ' <span class="rd-mono">' + esc(c.callsign.toUpperCase()) + '</span>' : '') + '<div class="rm-sub">' + esc(c.email) + '</div>' +
        (c.note ? '<div class="rm-sub rm-show-sm">“' + esc(c.note) + '”</div>' : '') + '</td>' +
        '<td class="rm-hide-sm">' + (c.note ? esc(c.note) : '<span class="rd-muted">—</span>') + '</td>' +
        '<td class="rm-hide-sm rd-muted">' + esc(ago(c.created)) + '</td>' +
        '<td class="rm-right rm-nowrap">' + (can('approve_repeater_claims') ? '<button type="button" class="btn btn-primary rm-sm" data-approve="' + esc(c.id) + '">Approve</button> ' +
        '<button type="button" class="rm-link rm-x" data-decline="' + esc(c.id) + '">Decline</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" class="rd-muted">No claims waiting.</td></tr>';
    var done = claims.filter(function (c) { return c.status !== 'pending'; }).slice(0, 15);
    $('rm-claims-done').innerHTML = done.map(function (c) {
      var rep = (c.expand && c.expand.repeater) || claimRepeaterNames.get(c.repeater) || {}, by = (c.expand && c.expand.handled_by) || {};
      return '<li><span class="rd-pill ' + (c.status === 'approved' ? 'ok' : 'off') + '">' + (c.status === 'approved' ? 'Approved' : 'Declined') + '</span> ' +
        esc(c.name) + ' → ' + esc(rep.name || '—') + ' <span class="rd-muted">' + (by.name ? 'by ' + esc(by.name) + ', ' : '') + esc(ago(c.updated)) + '</span></li>';
    }).join('') || '<li class="rd-muted">Nothing yet.</li>';
  }
  $('rm-claims-body').addEventListener('click', function (e) {
    var ok = e.target.closest('[data-approve]'), no = e.target.closest('[data-decline]');
    if (!can('approve_repeater_claims')) return;
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

  function renderMyDevices() {
    var myRepeaters = myDeviceLoads.repeaters === 'ready' ? repeaters.filter(manages) : [];
    var myObservers = myDeviceLoads.observers === 'ready' ? managedObservers.filter(manages) : [];
    var devices = myRepeaters.map(function (record) {
      return { id: record.id, name: record.name, type: 'Repeater' };
    }).concat(myObservers.map(function (record) {
      return { id: record.id, name: record.display_name || record.observer_name || record.observer_id, type: 'Observer' };
    }));
    devices.sort(function (a, b) { return a.name.localeCompare(b.name) || a.type.localeCompare(b.type); });

    var status = $('rm-my-devices-status');
    var failed = Object.keys(myDeviceLoads).filter(function (type) { return myDeviceLoads[type] === 'error'; });
    if (failed.length) status.textContent = 'Could not load your ' + failed.join(' or ') + '. Reload the page to try again.';
    else if (Object.values(myDeviceLoads).includes('loading')) status.textContent = 'Loading your devices…';
    else status.textContent = devices.length ? '' : 'No repeaters or observers are assigned to your account yet.';
    status.hidden = !status.textContent;

    $('rm-my-devices-table').hidden = !devices.length;
    $('rm-my-devices-list').innerHTML = devices.map(function (device) {
      return '<tr><td>' + esc(device.name) + '</td><td>' + device.type + '</td>' +
        '<td class="rm-right"><button type="button" class="btn btn-secondary rm-sm" data-device-id="' + esc(device.id) +
        '" data-device-type="' + device.type + '" aria-label="Edit ' + esc(device.name) + '">Edit</button></td></tr>';
    }).join('');
  }

  $('rm-my-devices-list').addEventListener('click', function (event) {
    var button = event.target.closest('[data-device-id]');
    if (!button) return;
    var isRepeater = button.dataset.deviceType === 'Repeater';
    var records = isRepeater ? repeaters : managedObservers;
    var record = records.find(function (item) { return item.id === button.dataset.deviceId; });
    if (!record || !manages(record)) return;
    if (isRepeater) {
      openEditor(record, 'my-devices');
    } else {
      showPanel('observers', false);
      openObserverEditor(record, 'my-devices');
    }
  });

  // ── repeaters list ───────────────────────────────────────────
  function managerNames(r) {
    var list = (r.expand && r.expand.managers) || [];
    return list.map(function (u) { return u.name || u.email; });
  }
  function renderRepeaters() {
    renderMyDevices();
    var q = ($('rm-rep-q').value || '').toLowerCase();
    var rows = repeaters.filter(function (r) {
      return !q || [r.name, r.area, r.owner_name, r.owner_callsign, r.prefix, r.prefix_2byte, r.prefix_3byte].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    $('rm-rep-sub').textContent = allRepeaters()
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
        '<td class="rm-right"><button type="button" class="btn btn-secondary rm-sm" data-edit="' + esc(r.id) + '">' + (canEditRepeater(r) || can('assign_repeaters') ? 'Edit' : 'View') + '</button></td></tr>';
    }).join('') || '<tr><td colspan="6" class="rd-muted">' +
      (repeaters.length ? 'No repeaters match.' : (allRepeaters() ? 'No repeaters yet.' : 'No repeaters are assigned to you yet. Add one, or ask an admin to link your existing repeater to your account.')) +
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
      { k: 'offline_pause_until', label: 'Pause offline alerts until', type: 'date', help: 'Alerts resume at the start of this date in Central time.' },
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
    if (f.k === 'install_date' || f.k === 'offline_pause_until') v = toInputDate(v);
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
    if (!can('assign_repeaters')) return '';
    var ids = (r && r.managers) || [];
    return '<fieldset class="rm-group"><legend>Managers</legend><p class="rm-hint rm-note">People assigned to edit this repeater.</p>' +
      '<div class="rm-checklist">' + (people.map(function (u) {
        return '<label class="rm-check"><input type="checkbox" name="managers" value="' + esc(u.id) + '"' + (ids.indexOf(u.id) >= 0 ? ' checked' : '') + '> ' +
          esc(u.name || u.email) + (u.role === 'admin' ? ' <span class="rd-muted">(admin)</span>' : '') + '</label>';
      }).join('') || '<span class="rd-muted">No people yet. Add them on the People tab.</span>') + '</div></fieldset>';
  }

  function openEditor(r, backPanel) {
    editing = r || null;
    repeaterBackPanel = backPanel || 'repeaters';
    $('rm-editor-back').textContent = repeaterBackPanel === 'my-devices' ? '← Back to My Devices' : '← Back to repeaters';
    PANELS.forEach(function (p) { $('rm-p-' + p).hidden = true; });
    $('rm-p-editor').hidden = false;
    $('rm-editor-title').textContent = r ? r.name : 'Add a repeater';
    var view = $('rm-editor-view');
    view.hidden = !r;
    if (r) view.href = '/repeaters/#r-' + r.id;
    $('rm-delete').hidden = !(r && isSiteOwner);
    var defaults = r || { status: 'Online', owner_name: me.name || '', owner_callsign: me.callsign || '', contact_email: me.email || '', show_email: !!me.email };
    $('rm-editor-fields').innerHTML = GROUPS.map(function (g) {
      return '<fieldset class="rm-group"' + (g.id ? ' id="rm-g-' + g.id + '"' : '') + '><legend>' + esc(g.title) + '</legend>' +
        (g.note ? '<p class="rm-hint rm-note">' + esc(g.note) + '</p>' : '') +
        '<div class="rm-grid">' + g.fields.map(function (f) { return fieldHtml(f, defaults); }).join('') + '</div></fieldset>';
    }).join('') + managersHtml(r);
    followSetup(r);
    var editable = canEditRepeater(r);
    $('rm-editor-fields').querySelectorAll('input,select,textarea,button').forEach(function (field) {
      if (!editable && field.name !== 'managers') field.disabled = true;
    });
    $('rm-editor').querySelectorAll('button[type=submit]').forEach(function (button) {
      button.hidden = !editable && !can('assign_repeaters');
    });
    $('rm-maint-form').hidden = !r || (!can('manage_maintenance') && !manages(r));
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
    var startOn = r ? !!linked : !can('assign_repeaters');   // new repeaters you add follow your profile
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
        if (f.k === 'offline_pause_until') v = ownerMail.pauseValue(v);
        if (f.k === 'path_hash_bytes') v = v ? Number(v) : 0;
        data[f.k] = v;
        if (f.show) data[f.show] = !!form.elements[f.show].checked;
      });
    });
    if (can('assign_repeaters')) {
      data.managers = Array.prototype.filter.call(form.querySelectorAll('input[name=managers]'), function (c) { return c.checked; })
        .map(function (c) { return c.value; });
    }
    return data;
  }

  $('rm-editor').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = this;
    var editable = canEditRepeater(editing);
    var data = editable ? collect(form) : { managers: Array.from(form.querySelectorAll('input[name=managers]:checked'), function (c) { return c.value; }) };
    if (!editable && !can('assign_repeaters')) return;
    if (editable) {
      if (!data.name) { toast('Give the repeater a name.', 'bad'); form.name.focus(); return; }
      if (!data.owner_name) { toast('The owner name is required.', 'bad'); form.owner_name.focus(); return; }
      if (data.public_key && !/^[0-9a-f]{64}$/.test(data.public_key)) { toast('The public key must be 64 hex characters.', 'bad'); form.public_key.focus(); return; }
      if (!data.prefix_3byte && data.public_key) data.prefix_3byte = data.public_key.slice(0, 6).toUpperCase();
      if (!editing && !can('assign_repeaters')) data.managers = [me.id];
      if (!editing) data.source = 'manual';
      followData(data);
    }
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
      openEditor(rec, repeaterBackPanel);
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
    if (repeaterBackPanel === 'my-devices') repeaters = repeaters.filter(function (item) { return item.id !== r.id; });
    showPanel(repeaterBackPanel, true);
    return loadAll();
  }

  $('rm-editor-back').addEventListener('click', function () { showPanel(repeaterBackPanel, true); renderRepeaters(); });
  $('rm-delete').addEventListener('click', function () {
    var btn = this, r = editing;
    if (!r) return;
    confirmClick(btn, 'Delete repeater', function () {
      pb.collection('repeaters').delete(r.id).then(function () {
        repeaters = repeaters.filter(function (x) { return x.id !== r.id; });
        toast('Deleted “' + r.name + '”.');
        showPanel(repeaterBackPanel, true); renderRepeaters();
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
          (can('manage_maintenance') || manages(r) ? ' <button type="button" class="rm-link rm-x" data-del-maint="' + esc(m.id) + '">Remove</button>' : '') + '</span></li>';
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
    if (!b || !editing || (!can('manage_maintenance') && !manages(editing))) return;
    confirmClick(b, 'Remove', function () {
      pb.collection('maintenance').delete(b.getAttribute('data-del-maint'))
        .then(function () { loadMaint(editing); })
        .catch(function (err) { toast(errText(err), 'bad'); });
    });
  });

  // ── people (admins) ──────────────────────────────────────────
  function repsFor(uid) { return repeaters.filter(function (r) { return (r.managers || []).indexOf(uid) >= 0; }); }
  function renderPeople() {
    if (!peoplePanel()) return;
    $('rm-people-body').innerHTML = people.map(function (u) {
      var reps = repsFor(u.id);
      var observerNames = managedObservers.filter(function (observer) {
        return (observer.managers || []).includes(u.id);
      }).map(function (observer) {
        return observer.display_name || observer.observer_name;
      }).filter(Boolean).sort(function (a, b) { return a.localeCompare(b); }).join(', ');
      var observerSummary = observerNames || peopleObserverStatus;
      var self = u.id === me.id;
      return '<tr><td><strong>' + esc(u.name || '—') + '</strong>' + (u.callsign ? ' <span class="rd-mono">' + esc(u.callsign) + '</span>' : '') +
        (self ? ' <span class="rd-muted">(you)</span>' : '') +
        '<div class="rm-sub rm-show-sm">' + esc(u.email) + '</div>' +
        (observerSummary ? '<div class="rm-sub rm-show-sm">Observers · ' + esc(observerSummary) + '</div>' : '') +
        (u.verified === false ? '<div class="rm-sub"><span class="rd-pill warn">Hasn’t signed in yet</span></div>' : '') + '</td>' +
        '<td class="rm-hide-sm">' + esc(u.email) + '</td>' +
        '<td>' + (u.role ? '<span class="rd-pill ' + (u.role === 'admin' ? 'ok' : 'info') + '">' + (u.role === 'admin' ? 'Admin' : 'User') + '</span>' : '—') + '</td>' +
        '<td class="rm-hide-sm">' + (reps.length ? esc(reps.map(function (r) { return r.name; }).join(', ')) : '<span class="rd-muted">—</span>') + '</td>' +
        '<td class="rm-hide-sm">' + (observerNames ? esc(observerNames) : '<span class="rd-muted">' + esc(peopleObserverStatus || '—') + '</span>') + '</td>' +
        '<td class="rm-right rm-nowrap">' + (can('edit_people','assign_repeaters','assign_observers') ? '<button type="button" class="btn btn-secondary rm-sm" data-person="' + esc(u.id) + '">Edit</button>' : '') +
        (u.verified === false && can('invite_users') ? ' <button type="button" class="rm-link" data-invite="' + esc(u.id) + '">Resend invite</button>' : '') +
        (isSiteOwner && !self ? ' <button type="button" class="rm-link rm-x" data-remove="' + esc(u.id) + '">Remove</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="rd-muted">No people yet.</td></tr>';
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
  var personObserverVersion = 0;
  var personObserverSelection = null;
  var pendingPersonInvite = false;

  function loadPersonObservers(userId) {
    var version = ++personObserverVersion;
    var field = $('rm-person-obs-field');
    var list = $('rm-person-observers');
    var status = $('rm-person-obs-status');
    field.disabled = true;
    list.replaceChildren();
    status.textContent = 'Loading observers…';
    personObserverSelection = null;
    var live = fetchLiveObservers();
    Promise.all([pb.collection('managed_observers').getFullList({sort:'observer_name'}), live]).then(function (result) {
      if (version !== personObserverVersion) return;
      var directory = result[0], feed = result[1];
      var observers = new Map();
      (feed || []).forEach(function (o) {
        if (o && o.id) observers.set(String(o.id), { name: o.name || String(o.id), region: o.iata });
      });
      var selected = new Set();
      directory.forEach(function (o) {
        observers.set(o.observer_id, { name: o.display_name || o.observer_name, region: o.region });
        if (userId && (o.managers || []).includes(userId)) selected.add(o.observer_id);
      });
      personObserverSelection = selected;
      list.innerHTML = Array.from(observers).sort(function (a, b) {
        return String(a[1].name).localeCompare(String(b[1].name));
      }).map(function (entry) {
        var id = entry[0], observer = entry[1];
        return '<label class="rm-check"><input type="checkbox" name="observers" value="' + esc(id) + '"' +
          (selected.has(id) ? ' checked' : '') + '> ' + esc(observer.name) +
          (observer.region ? ' <span class="rd-muted">(' + esc(observer.region) + ')</span>' : '') + '</label>';
      }).join('') || '<span class="rd-muted">No observers yet.</span>';
      status.textContent = feed ? '' : 'Analyzer unavailable. Showing observers already in the directory.';
      field.disabled = false;
    }).catch(function (error) {
      if (version === personObserverVersion) status.textContent = 'Could not load observer assignments. ' + errText(error);
    });
  }

  function openPersonForm(u) {
    editingPerson = u || null;
    pendingPersonInvite = false;
    var f = $('rm-person-form');
    f.hidden = false;
    f.reset();
    $('rm-person-rep-q').value = '';
    $('rm-person-obs-q').value = '';
    $('rm-person-title').textContent = u ? 'Edit ' + (u.name || u.email) : 'Add a person';
    $('rm-person-submit').textContent = u ? 'Save' : 'Add person';
    $('rm-invite-wrap').hidden = !!u;
    f.name.value = u ? u.name || '' : '';
    f.email.value = u ? u.email || '' : '';
    f.email.disabled = !!(u && (!isSiteOwner || u.id === me.id));
    $('rm-person-email-hint').hidden = !u || f.email.disabled;
    delete $('rm-person-submit').dataset.confirmEmail;
    f.callsign.value = u ? u.callsign || '' : '';
    f.name.disabled = f.callsign.disabled = !!u && !can('edit_people');
    $('rm-person-rep-field').hidden = !can('assign_repeaters');
    $('rm-person-obs-field').hidden = !can('assign_observers');
    $('rm-person-reps').innerHTML = personRepsHtml(u ? repsFor(u.id).map(function (r) { return r.id; }) : []);
    if (can('assign_observers')) loadPersonObservers(u && u.id);
    else personObserverSelection = null;
    if (!f.name.disabled) f.name.focus();
  }
  $('rm-person-obs-q').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    $('rm-person-observers').querySelectorAll('label').forEach(function (label) {
      label.hidden = !label.textContent.toLowerCase().includes(q);
    });
  });
  $('rm-person-rep-q').addEventListener('input', function () {
    var q = this.value.toLowerCase();
    $('rm-person-reps').querySelectorAll('label').forEach(function (l) { l.hidden = q && l.textContent.toLowerCase().indexOf(q) < 0; });
  });
  $('rm-add-person').addEventListener('click', function () { openPersonForm(null); });
  $('rm-person-cancel').addEventListener('click', function () { $('rm-person-form').hidden = true; editingPerson = null; personObserverVersion++; });

  // add/remove a manager on each repeater whose checkbox changed
  function syncRepeaters(user, wanted) {
    if (!can('assign_repeaters')) return Promise.resolve();
    var jobs = [];
    repeaters.forEach(function (r) {
      var has = (r.managers || []).indexOf(user.id) >= 0, want = wanted.indexOf(r.id) >= 0;
      if (has === want) return;
      var body = want ? { 'managers+': user.id } : { 'managers-': user.id };
      jobs.push(pb.collection('repeaters').update(r.id, body, { expand: 'managers' }).then(function (rec) {
        var i = repeaters.findIndex(function (x) { return x.id === rec.id; }); repeaters[i] = rec;
      }));
    });
    return Promise.all(jobs);
  }

  $('rm-person-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this;
    var name = f.name.value.trim(), email = f.email.value.trim(), callsign = f.callsign.value.trim().toUpperCase();
    var wanted = Array.prototype.filter.call(f.querySelectorAll('input[name=reps]'), function (c) { return c.checked; }).map(function (c) { return c.value; });
    var observerChanges;
    if (personObserverSelection) {
      var checked = new Set(Array.from(f.querySelectorAll('input[name=observers]:checked'), function (input) { return input.value; }));
      observerChanges = {
        add: Array.from(checked).filter(function (id) { return !personObserverSelection.has(id); }),
        remove: Array.from(personObserverSelection).filter(function (id) { return !checked.has(id); })
      };
    }
    if (!editingPerson && !can('invite_users')) return;
    if (!f.name.disabled && !name) { toast('Enter their name.', 'bad'); return; }
    var changeEmail = editingPerson && !f.email.disabled && email.toLowerCase() !== (editingPerson.email || '').toLowerCase();
    if ((!editingPerson || changeEmail) && !/^\S+@\S+\.\S+$/.test(email)) { toast('Enter a valid email.', 'bad'); return; }
    var button = $('rm-person-submit');
    if (changeEmail && button.dataset.confirmEmail !== email) {
      button.dataset.confirmEmail = email;
      toast('Click Save again to confirm the sign-in email change.', 'warn', true);
      return;
    }
    delete button.dataset.confirmEmail;
    busy(f, true);
    var job;
    if (editingPerson) {
      var body = { name: name, callsign: callsign };
      var person = editingPerson;
      job = can('edit_people') && ((person.name || '') !== name || (person.callsign || '') !== callsign)
        ? pb.collection('users').update(person.id, body) : Promise.resolve(person);
      if (changeEmail) job = job.then(function () {
        return pb.send('/api/directory/permissions/' + encodeURIComponent(person.id) + '/email', {
          method: 'PATCH', body: { email: email, previousEmail: person.email }
        }).then(function () { return pb.collection('users').getOne(person.id); });
      });
    } else {
      var pw = randomPassword();
      job = pb.collection('users').create({ name: name, email: email, callsign: callsign, role: 'user', emailVisibility: false, password: pw, passwordConfirm: pw });
    }
    var isNew = !editingPerson;
    var invite = pendingPersonInvite || (isNew && f.invite.checked);
    job.then(function (user) {
      if (isNew) {
        editingPerson = user;
        pendingPersonInvite = invite;
        f.email.disabled = true;
        $('rm-invite-wrap').hidden = true;
        $('rm-person-title').textContent = 'Edit ' + user.name;
        $('rm-person-submit').textContent = 'Save';
      }
      var i = people.findIndex(function (x) { return x.id === user.id; });
      if (i >= 0) people[i] = user; else people.push(user);
      people.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      return syncRepeaters(user, wanted).then(function () {
        if (observerChanges && (observerChanges.add.length || observerChanges.remove.length)) {
          return pb.send('/api/directory/people/' + encodeURIComponent(user.id) + '/observers', {
            method: 'POST', body: observerChanges
          }).then(loadObservers);
        }
      }).then(function () {
        if (invite) return pb.collection('users').requestPasswordReset(user.email).then(function () { return 'invited'; }, function () { return 'invite-failed'; });
      }).then(function (inv) {
        f.hidden = true;
        toast((isNew ? 'Added ' : 'Saved ') + user.name + '.' +
          (inv === 'invited' ? ' An invite is on its way to ' + user.email + '.' : inv === 'invite-failed' ? ' The invite email couldn’t be sent; they can still sign in with a code.' : ''));
        editingPerson = null;
        pendingPersonInvite = false;
        personObserverVersion++;
        renderAll();
      });
    }).catch(function (err) { toast(errText(err), 'bad', true); })
      .then(function () { busy(f, false); });
  });

  $('rm-people-body').addEventListener('click', function (e) {
    var edit = e.target.closest('[data-person]'), inv = e.target.closest('[data-invite]'), rm = e.target.closest('[data-remove]');
    if (edit) openPersonForm(people.find(function (u) { return u.id === edit.getAttribute('data-person'); }));
    if (inv && can('invite_users')) {
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

  function permissionSelect(key, label, overrides, owner) {
    var value = Object.prototype.hasOwnProperty.call(overrides, key) ? String(overrides[key]) : 'inherit';
    return '<label class="rm-field"><span>' + esc(label) + '</span><select data-capability="' + esc(key) + '"' +
      (owner ? ' disabled' : '') + '>' +
      [['inherit','Role default'],['true','Grant'],['false','Block']].map(function (option) {
        return '<option value="' + option[0] + '"' + (value === option[0] ? ' selected' : '') + '>' + option[1] + '</option>';
      }).join('') + '</select></label>';
  }
  function permissionRow(account) {
    var caption = esc(account.name);
    var role = account.owner ? '<span class="rd-pill ok">Site Owner</span>' :
      '<select name="role" aria-label="Role for ' + caption + '"><option value="user">User</option><option value="admin"' +
      (account.role === 'admin' ? ' selected' : '') + '>Admin</option></select>';
    var checkbox = '<input type="checkbox" name="enabled" aria-label="Owner Emails for ' + caption + '"' +
      (account.enabled ? ' checked' : '') + ((account.owner || (!account.verified && !account.enabled)) ? ' disabled' : '') + '>';
    var overrides = account.overrides || {};
    var choices = Object.keys(permissionDefinitions).map(function (key) {
      return permissionSelect(key, permissionDefinitions[key], overrides, account.owner);
    }).join('');
    return '<tr data-permission-account="' + esc(account.id) + '" data-role="' + esc(account.role) + '" data-enabled="' + account.enabled +
      '" data-overrides="' + esc(JSON.stringify(overrides)) + '">' +
      '<td><strong>' + caption + '</strong><div class="rm-sub">' + esc(account.email) + '</div>' +
      (account.verified ? '' : '<div class="rm-sub rd-muted">Email verification pending</div>') + '</td>' +
      '<td>' + role + '</td><td>' + checkbox + '</td><td>' +
      (account.owner ? 'All staff permissions' : '<details><summary>Staff permissions <span class="rd-muted" data-effective-staff>' +
        account.staff.length + ' allowed</span></summary><div class="rm-permission-options">' + choices + '</div></details>') + '</td><td>' +
      (account.owner ? '' : '<button type="button" class="btn btn-secondary rm-sm" data-permission-save disabled>Save</button>') + '</td></tr>';
  }
  function permissionInput(row) {
    var overrides = {};
    var controls = Array.from(row.querySelectorAll('[data-capability]'));
    controls.forEach(function (field) {
      if (field.value !== 'inherit') overrides[field.dataset.capability] = field.value === 'true';
    });
    return { role: row.querySelector('[name=role]').value, enabled: row.querySelector('[name=enabled]').checked, overrides: overrides };
  }
  function sameOverrides(a, b) {
    return Object.keys(permissionDefinitions).every(function (key) { return a[key] === b[key]; });
  }
  function loadPermissions() {
    var version = ++permissionRevision;
    $('rm-permissions-status').textContent = 'Loading permissions…';
    pb.send('/api/directory/permissions').then(function (result) {
      if (version !== permissionRevision) return;
      permissionDefinitions = result.capabilities;
      $('rm-permissions-body').innerHTML = result.accounts.map(permissionRow).join('');
      $('rm-permissions-status').textContent = '';
    }).catch(function (error) {
      if (version === permissionRevision) $('rm-permissions-status').textContent = errText(error);
    });
  }
  $('rm-permissions-refresh').addEventListener('click', loadPermissions);
  $('rm-permissions-body').addEventListener('change', function (event) {
    var row = event.target.closest('[data-permission-account]');
    var button = row && row.querySelector('[data-permission-save]');
    if (!button) return;
    var input = permissionInput(row);
    button.disabled = input.role === row.dataset.role && input.enabled === (row.dataset.enabled === 'true') &&
      sameOverrides(input.overrides, JSON.parse(row.dataset.overrides));
    row.querySelector('[data-effective-staff]').textContent = Object.keys(permissionDefinitions).filter(function (key) {
      return input.overrides[key] === true || (input.overrides[key] === undefined && input.role === 'admin');
    }).length + ' allowed';
  });
  $('rm-permissions-body').addEventListener('click', function (event) {
    var button = event.target.closest('[data-permission-save]');
    if (!button || button.disabled || !isSiteOwner) return;
    var row = button.closest('[data-permission-account]');
    var id = row.dataset.permissionAccount;
    var version = permissionRevision;
    var previous = { role: row.dataset.role, enabled: row.dataset.enabled === 'true', overrides: JSON.parse(row.dataset.overrides) };
    var next = permissionInput(row);
    var input = { id: id, previousRole: previous.role, previousEnabled: previous.enabled, previousOverrides: previous.overrides };
    if (next.role !== previous.role) input.role = next.role;
    if (next.enabled !== previous.enabled) input.enabled = next.enabled;
    if (!sameOverrides(next.overrides, previous.overrides)) input.overrides = next.overrides;
    var controls = Array.from(row.querySelectorAll('select,input,button')).filter(function (field) { return !field.disabled; });
    controls.forEach(function (field) { field.disabled = true; });
    pb.send('/api/directory/permissions', { method: 'PATCH', body: input }).then(function (result) {
      if (version !== permissionRevision) return;
      var account = result.accounts.find(function (item) { return item.id === id; });
      if (!account) { loadPermissions(); return; }
      var wasOpen = row.querySelector("details").open;
      row.outerHTML = permissionRow(account);
      if (wasOpen) $("rm-permissions-body").querySelector('[data-permission-account="' + id + '"] details').open = true;
      $('rm-permissions-status').textContent = 'Saved permissions for ' + account.name + '.';
      return loadAll();
    }).catch(function (error) {
      if (version !== permissionRevision) return;
      controls.forEach(function (field) { field.disabled = false; });
      $('rm-permissions-status').textContent = errText(error);
    });
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
    var manageAll = can('manage_prefixes');
    var viewAll = can('read_prefixes','manage_prefixes');
    $('rm-prefix-title').textContent = viewAll ? 'Reserved Prefixes' : 'My Reserved Prefixes';
    $('rm-prefix-sub').textContent = 'A prefix is 4 characters (2 bytes) or 6 characters (3 bytes), 0–9 and A–F, and can’t start with 00 or FF. ' +
      (manageAll ? 'Anyone can reserve up to 5 from the public Prefixes page. Admins have no limit and can replace old 1-byte reservations, which are marked; reserve them again with 2 bytes, then remove the old one.'
        : 'Reserve one before you generate your repeater’s key, then generate a key that starts with it. You can hold up to 5.');
    var cols = viewAll ? 5 : 4;
    $('rm-prefix-body').innerHTML = prefixes.map(function (p) {
      var own = p.user === me.id || String(p.reserved_by_email || '').toLowerCase() === me.email.toLowerCase();
      var who = [p.reserved_by_name, p.reserved_by_callsign, p.reserved_by_email].filter(Boolean).map(esc).join(' · ');
      return '<tr data-prefix-row="' + esc(p.id) + '"><td><span class="rd-mono">' + esc(p.code) + '</span>' + (p.code.length === 2 ? ' <span class="rd-pill warn">1-byte</span>' : prefixProblem(String(p.code).toUpperCase()) ? ' <span class="rd-pill bad" title="Not a valid prefix. Remove it and reserve a 4- or 6-character one.">Invalid</span>' : '') + '</td>' +
        '<td><span class="rm-prefix-label">' + esc(p.label) + '</span></td>' +
        (viewAll ? '<td class="rd-muted">' + (who || '—') + '</td>' : '') +
        '<td class="rd-muted rm-since rm-hide-sm">' + esc(fmtDate(p.created)) + '</td>' +
        '<td class="rm-right">' + (own || manageAll ? '<button type="button" class="rm-link" data-rename-prefix="' + esc(p.id) + '">Rename</button> ' +
        '<button type="button" class="rm-link rm-x" data-del-prefix="' + esc(p.id) + '">' + (manageAll ? 'Remove' : 'Release') + '</button>' : '') + '</td></tr>';
    }).join('') || '<tr><td colspan="' + cols + '" class="rd-muted">' + (viewAll ? 'No reservations yet.' : 'You haven’t reserved a prefix yet. Reserve one above, or from the public Prefixes page.') + '</td></tr>';
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
    if (can('manage_prefixes')) {
      var email = f.email.value.trim();
      if (email) { data.reserved_by_email = email; var u = people.find(function (x) { return (x.email || '').toLowerCase() === email.toLowerCase(); }); if (u) { data.user = u.id; data.reserved_by_name = u.name; data.reserved_by_callsign = u.callsign || ''; } }
    } else {
      data.reserved_by_name = me.name || me.email; data.reserved_by_email = me.email; data.reserved_by_callsign = me.callsign || '';
    }
    busy(f, true);
    pb.collection('prefixes').create(data).then(function (p) {
      prefixes.push(p); prefixes.sort(function (a, b) { return a.code.localeCompare(b.code); });
      f.reset(); $('rm-prefix-hint').textContent = ''; renderPrefixes();
      toast('Reserved ' + code + '.' + (can('manage_prefixes') ? '' : ' A confirmation email is on its way.'));
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
        if (gone) toast((can('manage_prefixes') ? 'Removed ' : 'Released ') + gone.code + '.');
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
  var managedObservers = [], liveObservers = [], observerClaims = [], peopleObserverStatus = 'Loading…';
  var observerLoadVersion = 0;
  function fetchLiveObservers() {
    return fetch(ANALYZER + '/api/observers').then(function (response) {
      if (!response.ok) throw new Error('Analyzer unavailable');
      return response.json();
    }).then(function (body) {
      return Array.isArray(body.observers) ? body.observers : null;
    }).catch(function () { return null; });
  }
  function updateClaimCount(){
    var n=claims.filter(function(c){return c.status==='pending';}).length+observerClaims.filter(function(c){return c.status==='pending';}).length;
    $('rm-claims-count').textContent=n||'';
  }
  function loadObservers() {
    var version = ++observerLoadVersion;
    var all = allObservers();
    $('rm-obs-title').textContent = all ? 'All Observers' : 'My Observers';
    $('rm-obs-msg').textContent = 'Loading observers…';
    return Promise.all([
      pb.collection('managed_observers').getFullList({ sort: 'observer_name' }),
      all ? fetchLiveObservers() : Promise.resolve([])
    ]).then(function (result) {
      if (version !== observerLoadVersion) return;
      managedObservers = result[0];
      liveObservers = result[1] || [];
      peopleObserverStatus = '';
      return (can('assign_observers') ? loadPeople() : Promise.resolve()).then(function () {
        if (version !== observerLoadVersion) return;
        myDeviceLoads.observers = 'ready';
        $('rm-obs-msg').textContent = result[1] ? '' : 'Analyzer unavailable. Showing observers already in the directory.';
        renderObservers();
        renderPeople();
      });
    }).catch(function (error) {
      if (version !== observerLoadVersion) return;
      peopleObserverStatus = 'Unavailable';
      myDeviceLoads.observers = 'error';
      renderMyDevices();
      renderPeople();
      $('rm-obs-msg').textContent = 'Could not load observers. ' + errText(error);
    });
  }

  function renderObservers() {
    renderMyDevices();
    var catalog = new Map();
    liveObservers.forEach(function (item) {
      if (item && item.id != null && String(item.id)) {
        var id = String(item.id);
        catalog.set(id, { id: id, name: String(item.name || id), region: item.iata || '' });
      }
    });
    managedObservers.forEach(function (record) {
      var live = catalog.get(record.observer_id) || {};
      catalog.set(record.observer_id, {
        id: record.observer_id,
        name: record.display_name || record.observer_name || live.name || record.observer_id,
        region: live.region || record.region,
        record: record
      });
    });
    var query = $('rm-obs-q').value.trim().toLowerCase();
    var rows = Array.from(catalog.values()).filter(function (item) {
      return [item.name, item.region, item.id, item.record && item.record.public_owner].join(' ').toLowerCase().includes(query);
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    $('rm-obs-summary').textContent = allObservers()
      ? catalog.size + ' observers · ' + managedObservers.length + ' registered in the directory'
      : 'These are the observers assigned to you.';
    $('rm-obs-list').innerHTML = rows.map(function (item) {
      var record = item.record;
      var canOpen = record || can('edit_observers');
      var open = canOpen ? ' data-open-observer="' + esc(item.id) + '"' : '';
      var analyzer = ANALYZER + '/#/observers/' + encodeURIComponent(item.id);
      var name = canOpen ? '<button type="button" class="rm-rowlink"' + open + '>' + esc(item.name) + '</button>' : esc(item.name);
      var status = !record ? ['Unregistered', 'off'] : (record.managers || []).length ? ['Managed', 'ok'] : ['Needs manager', 'warn'];
      var action = canOpen
        ? '<button type="button" class="btn btn-secondary rm-sm"' + open + '>' +
          (!record || canEditObserver(record) || can('assign_observers') ? 'Edit' : 'View') + '</button>'
        : '<a class="rm-link" href="' + esc(analyzer) + '" target="_blank" rel="noopener">Open in analyzer ↗</a>';
      return '<tr><td>' + name + (item.region ? '<div class="rm-sub">' + esc(item.region) + '</div>' : '') + '</td>' +
        '<td><span class="rd-pill ' + status[1] + '">' + status[0] + '</span></td>' +
        '<td class="rm-hide-sm">' + esc(record && record.public_owner || '—') + '</td><td class="rm-right">' + action + '</td></tr>';
    }).join('') || '<tr><td colspan="4" class="rd-muted">' +
      (query ? 'No observers match.' : allObservers() ? 'No observers available.' : 'No observers are assigned to you yet.') + '</td></tr>';
  }

  function closeObserverEditor() {
    $('rm-obs-directory').hidden = false;
    $('rm-obs-editor').hidden = true;
    $('rm-obs-editor-form').replaceChildren();
  }

  $('rm-obs-q').addEventListener('input', renderObservers);
  $('rm-obs-back').addEventListener('click', function () {
    var form = $('rm-obs-editor-form').querySelector('[data-observer-edit]');
    var id = form && form.dataset.observerEdit;
    closeObserverEditor();
    if (observerBackPanel === 'my-devices') {
      showPanel('my-devices', true);
      return;
    }
    var button = Array.from($('rm-obs-list').querySelectorAll('[data-open-observer]')).find(function (entry) {
      return entry.dataset.openObserver === id;
    });
    if (button) button.focus();
  });
  $('rm-obs-list').addEventListener('click', function (event) {
    var button = event.target.closest('[data-open-observer]');
    if (!button) return;
    var id = button.dataset.openObserver;
    var record = managedObservers.find(function (item) { return item.observer_id === id; });
    if (record) {
      openObserverEditor(record);
      return;
    }
    if (!can('edit_observers')) return;
    var live = liveObservers.find(function (item) { return item && String(item.id) === id; });
    if (live) openObserverEditor({ observer_id: id, observer_name: live.name || id, region: live.iata });
  });

  var observerVisibility = { show_phone: 'Show phone publicly', show_discord: 'Show Discord publicly', show_email: 'Let people message the owner' };
  function observerProfile(form, resetVisibility) {
    var select = form.elements.contact_from;
    var assign = can('assign_observers');
    var linked = form.dataset.observerProfile || '';
    var selected = select.options.length ? select.value : linked;
    var assigned = assign
      ? Array.from(form.querySelectorAll('input[name=managers]:checked'), function (box) { return box.value; })
      : JSON.parse(form.dataset.observerManagers);
    var eligible = assigned.filter(function (id) { return assign || id === me.id || id === linked; });
    select.innerHTML = '<option value="">Enter owner name manually</option>' + eligible.map(function (id) {
      var person = id === me.id ? me : people.find(function (p) { return p.id === id; });
      return '<option value="' + esc(id) + '">' + esc(person ? person.name || person.email : 'Current owner profile') + '</option>';
    }).join('');
    select.value = eligible.includes(selected) ? selected : '';
    form.querySelector('[data-observer-manual-owner]').hidden = !!select.value;
    Object.keys(observerVisibility).forEach(function (key) {
      var box = form.elements[key];
      if (resetVisibility) box.checked = false;
      box.disabled = !select.value || (!assign && select.value !== me.id);
    });
  }

  function openObserverEditor(o, backPanel) {
    observerBackPanel = backPanel || 'observers';
    $('rm-obs-back').textContent = observerBackPanel === 'my-devices' ? '← Back to My Devices' : '← Back to observers';
    $('rm-obs-directory').hidden = true;
    $('rm-obs-editor').hidden = false;
    function field(key,label,max){return '<label class="rm-field"><span>'+label+'</span><input name="'+key+'" maxlength="'+max+'" value="'+esc(o[key]||'')+'"></label>';}
    var link=ANALYZER+'/#/observers/'+encodeURIComponent(o.observer_id);
    var assigned=o.managers||[];
    var options=can('assign_observers')?'<fieldset class="rm-group rm-form"><legend>Assigned managers</legend><div class="rm-checklist">'+people.map(function(p){
      return '<label class="rm-check"><input type="checkbox" name="managers" value="'+esc(p.id)+'" '+(assigned.indexOf(p.id)>=0?'checked':'')+'> '+esc(p.name||p.email)+'</label>';
    }).join('')+'</div><p class="rm-hint">Manager assignments update when you save.</p></fieldset>':'';
    var editable = canEditObserver(o);
    $('rm-obs-editor-form').innerHTML = '<form class="rm-card rm-form" data-observer-edit="' + esc(o.observer_id) + '"' +
      (o.id ? ' data-observer-record="' + esc(o.id) + '"' : '') +
      ' data-observer-profile="' + esc(o.contact_from || '') + '" data-observer-managers="' + esc(JSON.stringify(assigned)) + '"><h3>'+esc(o.observer_name)+'</h3><p class="rd-muted">'+esc(o.region||'Unknown region')+' · <a href="'+esc(link)+'" target="_blank" rel="noopener">Open in analyzer ↗</a></p>'+
      (o.id ? '' : '<p class="rd-muted">Saving creates a directory listing for this observer.</p>') +
      '<fieldset' + (editable ? '' : ' disabled') + ' class="rm-group rm-form"><legend>Listing details</legend><p class="rd-muted">The fields below are public. Do not enter private contact details or precise private locations.</p><div class="rm-grid">'+field('display_name','Directory display name',100)+field('area','General area',100)+field('hardware','Hardware',200)+'</div>'+
      '<label class="rm-field"><span>Public notes</span><textarea name="notes" maxlength="2000" rows="3">'+esc(o.notes||'')+'</textarea></label>'+
      '<label class="rm-field"><span>Pause offline alerts until</span><input type="date" name="offline_pause_until" value="'+esc((o.offline_pause_until||'').slice(0,10))+'"><small class="rm-hint">Alerts resume at the start of this date in Central time.</small></label></fieldset>'+options+
      '<fieldset' + (editable ? '' : ' disabled') + ' class="rm-group rm-form"><legend>Owner &amp; contact</legend>' +
      '<label class="rm-field"><span>Follow owner profile</span><select name="contact_from"></select></label>' +
      '<div data-observer-manual-owner>' + field('public_owner','Public owner name / callsign (optional)',100) + '</div>' +
      '<p class="rm-hint">Linked names and callsigns update from My Account. Phone and Discord appear when enabled. Email messages are relayed privately.</p>' +
      Object.keys(observerVisibility).map(function (key) {
        return '<label class="rm-check"><input type="checkbox" name="' + key + '"' + (o[key] ? ' checked' : '') + '> ' + observerVisibility[key] + '</label>';
      }).join('') + '</fieldset>' +
      '<div class="rm-actions rm-actions-end">' +
      (isSiteOwner && o.id ? '<button type="button" class="rm-danger" data-delete-observer="' + esc(o.id) + '">Delete observer</button>' : '') +
      (editable || can('assign_observers') ? '<button type="submit" class="btn btn-primary">Save observer</button>' : '') + '</div></form>';
    observerProfile($('rm-obs-editor-form').querySelector('form'), false);
    $('rm-obs-back').focus();
  }
  $('rm-obs-editor-form').addEventListener('change', function (event) {
    if (event.target.name !== 'contact_from' && event.target.name !== 'managers') return;
    var form = event.target.form;
    var changeProfile = event.target.name === 'contact_from' ||
      (!event.target.checked && event.target.value === form.elements.contact_from.value);
    observerProfile(form, changeProfile);
  });
  $('rm-obs-editor-form').addEventListener('click', function (event) {
    var button = event.target.closest('[data-delete-observer]');
    if (!button || !isSiteOwner) return;
    confirmClick(button, 'Delete observer', function () {
      pb.collection('managed_observers').delete(button.dataset.deleteObserver).then(function () {
        managedObservers = managedObservers.filter(function (item) { return item.id !== button.dataset.deleteObserver; });
        closeObserverEditor();
        if (observerBackPanel === 'my-devices') showPanel('my-devices', true);
        toast('Observer listing deleted.');
        return loadObservers();
      }).catch(function (error) { toast(errText(error), 'bad'); });
    });
  });
  $('rm-obs-editor-form').addEventListener('submit',function(e){
    var form=e.target.closest('[data-observer-edit]');if(!form)return;e.preventDefault();
    var id = form.dataset.observerRecord;
    var record = id && managedObservers.find(function (item) { return item.id === id; });
    if (id ? !record : !can('edit_observers')) return;
    var body = {};
    if (!id || canEditObserver(record)) {
      ['display_name','area','hardware','public_owner','notes'].forEach(function (key) { body[key] = form.elements[key].value.trim(); });
      body.offline_pause_until = ownerMail.pauseValue(form.elements.offline_pause_until.value);
      body.contact_from = form.elements.contact_from.value;
      Object.keys(observerVisibility).forEach(function (key) {
        if (!form.elements[key].disabled) body[key] = form.elements[key].checked;
      });
    }
    if (can('assign_observers')) body.managers = Array.from(form.querySelectorAll('input[name=managers]:checked'),function (input) { return input.value; });
    busy(form,true);
    var save = id ? pb.collection('managed_observers').update(id, body)
      : pb.send('/api/directory/observers', { method: 'POST', body: Object.assign({ observer_id: form.dataset.observerEdit }, body) });
    save.then(function (observer) {
      var index = managedObservers.findIndex(function (item) { return item.id === observer.id; });
      if (index < 0) managedObservers.push(observer);
      else managedObservers[index] = observer;
      renderObservers();
      renderPeople();
      if (!id && form.isConnected) {
        openObserverEditor(observer);
      }
      toast(id ? 'Observer saved.' : 'Observer registered.');
    }).catch(function(err){toast(errText(err),'bad');}).then(function(){busy(form,false);});
  });
  function loadObserverClaims(){
    if(!observerClaimAccess())return Promise.resolve();
    return pb.collection('observer_claims').getList(1,200,{sort:'-created'}).then(function(r){
      observerClaims=r.items;$('rm-obs-claims-msg').textContent='';renderObserverClaims();updateClaimCount();
    }).catch(function(err){$('rm-obs-claims-msg').textContent='Observer claims unavailable: '+errText(err);});
  }
  function renderObserverClaims(){
    $('rm-obs-claims-body').innerHTML=observerClaims.filter(function(c){return c.status==='pending';}).map(function(c){
      return '<tr><td><strong><a href="'+esc(ANALYZER+'/#/observers/'+encodeURIComponent(c.observer_id))+'" target="_blank" rel="noopener">'+esc(c.observer_name||c.observer_id)+'</a></strong><div class="rm-sub">'+esc(c.region)+'</div></td>'+
        '<td>'+esc(c.name)+' '+esc(c.callsign)+'<div class="rm-sub">'+esc(c.email)+'</div><div class="rm-sub rm-show-sm">'+esc(c.note)+'</div></td>'+
        '<td class="rm-hide-sm">'+esc(c.note||'—')+'</td><td class="rm-right rm-nowrap">' + (can('approve_observer_claims') ? '<button type="button" class="btn btn-primary rm-sm" data-obs-approve="'+esc(c.id)+'">Approve</button> <button type="button" class="rm-link rm-x" data-obs-decline="'+esc(c.id)+'">Decline</button>' : '') + '</td></tr>';
    }).join('')||'<tr><td colspan="4" class="rd-muted">No observer claims waiting.</td></tr>';
    $('rm-obs-claims-done').innerHTML=observerClaims.filter(function(c){return c.status!=='pending';}).slice(0,15).map(function(c){
      return '<li><span class="rd-pill '+(c.status==='approved'?'ok':'off')+'">'+(c.status==='approved'?'Approved':'Declined')+'</span> '+esc(c.name)+' → '+esc(c.observer_name||c.observer_id)+'</li>';
    }).join('')||'<li class="rd-muted">Nothing yet.</li>';
  }
  $('rm-obs-claims-body').addEventListener('click',function(e){
    var yes=e.target.closest('[data-obs-approve]'), no=e.target.closest('[data-obs-decline]'), btn=yes||no;
    if(!btn||!can('approve_observer_claims'))return;
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
