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
  var repeaters = [], people = [], prefixes = [], liveNodes = [];
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
  function statusLabel(s) { return s === 'Built Waiting For Install' ? 'Waiting for install' : s; }
  function statusClass(s) { return { 'Online': 'ok', 'Offline': 'bad', 'Maintenance': 'warn', 'Retired': 'off' }[s] || 'info'; }
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
    var email = f.email.value.trim();
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
    pb.collection('users').authWithPassword(f.email.value.trim(), f.password.value).then(function () {
      f.password.value = ''; signedIn();
    }).catch(function (err) {
      toast(err.status === 400 ? 'Email or password is wrong. You can also sign in with an emailed code.' : errText(err), 'bad');
    }).then(function () { busy(f, false); });
  });
  $('rm-forgot').addEventListener('click', function () {
    var email = $('rm-pass-form').email.value.trim();
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
  var PANELS = ['repeaters', 'people', 'prefixes', 'account'];
  function showPanel(name, push) {
    if (PANELS.indexOf(name) < 0 || ((name === 'people' || name === 'prefixes') && !isAdmin)) name = 'repeaters';
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
    document.querySelectorAll('#rm-tabs [data-admin]').forEach(function (a) { a.hidden = !isAdmin; });
    $('rm-me-name').textContent = me.name || me.email;
    $('rm-me-role').textContent = isAdmin ? 'Admin' : 'User';
    $('rm-rep-title').textContent = isAdmin ? 'All Repeaters' : 'My Repeaters';
    var af = $('rm-account-form');
    af.name.value = me.name || ''; af.callsign.value = me.callsign || ''; af.email.value = me.email || '';
    var start = location.hash.replace('#', '');
    showPanel(start || 'repeaters', false);
    loadAll().then(function () {
      var m = location.hash.match(/^#edit-([a-z0-9]+)$/);
      if (m) { var r = repeaters.find(function (x) { return x.id === m[1]; }); if (r) openEditor(r); }
    });
    loadLive();
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
      pb.collection('repeaters').getFullList({ sort: 'name', expand: 'managers' }).then(function (l) { repeaters = l; }),
      pb.collection('prefixes').getFullList({ sort: 'code' }).then(function (l) { prefixes = l; })
    ];
    if (isAdmin) jobs.push(pb.collection('users').getFullList({ sort: 'name' }).then(function (l) { people = l; }));
    return Promise.all(jobs).then(renderAll).catch(function (err) { toast(errText(err), 'bad', true); });
  }
  function renderAll() { renderRepeaters(); renderPeople(); renderPrefixes(); }

  function loadLive() {
    fetch(ANALYZER + '/api/nodes?limit=2000').then(function (r) { return r.json(); }).then(function (d) {
      liveNodes = (d.nodes || []).filter(function (n) { return n.role === 'repeater'; });
      liveNodes.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      $('rm-nodes').innerHTML = liveNodes.map(function (n) {
        return '<option value="' + esc((n.name || 'Unnamed') + ' — ' + n.public_key.slice(0, 8)) + '"></option>';
      }).join('');
    }).catch(function () {});
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
        '<td><span class="rd-pill ' + statusClass(r.status) + '">' + esc(statusLabel(r.status)) + '</span></td>' +
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

  // ── repeater editor ──────────────────────────────────────────
  var STATUSES = ['Online', 'Offline', 'Built Waiting For Install', 'Maintenance', 'Retired'];
  var YESNO = [['', '—'], ['Yes', 'Yes'], ['No', 'No']];
  var GROUPS = [
    { title: 'Basics', fields: [
      { k: 'name', label: 'Repeater name', req: true, max: 100 },
      { k: 'status', label: 'Status', req: true, type: 'select', opts: STATUSES.map(function (s) { return [s, statusLabel(s)]; }) },
      { k: 'area', label: 'General area', help: 'A town or area, like “NE of Rayne”. Don’t enter a street address.' },
      { k: 'install_date', label: 'Install date', type: 'date' },
      { k: 'antenna_height', label: 'Antenna height', ph: "40'" }
    ] },
    { title: 'On the mesh', fields: [
      { k: 'meshfind', label: 'Find it on the mesh', type: 'meshfind', wide: true, help: 'Start typing the repeater’s name as the mesh hears it to fill in the public key.' },
      { k: 'public_key', label: 'Public key', wide: true, mono: true, max: 64, help: '64 characters, 0–9 and a–f.' },
      { k: 'prefix', label: 'Reserved prefix (1 byte)', mono: true, max: 8, upper: true },
      { k: 'prefix_2byte', label: 'Reserved prefix (2 byte)', mono: true, max: 8, upper: true },
      { k: 'prefix_3byte', label: 'Reserved prefix (3 byte)', mono: true, max: 8, upper: true, help: 'Left blank, it’s filled from the public key when you save.' },
      { k: 'prefix_compliant', label: 'Prefix compliant', type: 'select', opts: YESNO },
      { k: 'path_hash_bytes', label: 'Path hash size', type: 'select', opts: [['', '—'], ['1', '1-byte (mode 0)'], ['2', '2-byte (mode 1)'], ['3', '3-byte (mode 2)']] }
    ] },
    { title: 'Owner & contact', id: 'contact', note: 'The owner’s name always shows publicly. Tick “Show publicly” for each contact detail you want on the public directory; admins can always see them.', fields: [
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
    var show = f.show ? '<label class="rm-check rm-show"><input type="checkbox" name="' + f.show + '"' + (r && r[f.show] ? ' checked' : '') + '> Show publicly</label>' : '';
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
    var defaults = r || { status: 'Online', owner_name: me.name || '', owner_callsign: me.callsign || '', contact_email: me.email || '' };
    $('rm-editor-fields').innerHTML = GROUPS.map(function (g) {
      return '<fieldset class="rm-group"' + (g.id ? ' id="rm-g-' + g.id + '"' : '') + '><legend>' + esc(g.title) + '</legend>' +
        (g.note ? '<p class="rm-hint rm-note">' + esc(g.note) + '</p>' : '') +
        '<div class="rm-grid">' + g.fields.map(function (f) { return fieldHtml(f, defaults); }).join('') + '</div></fieldset>';
    }).join('') + managersHtml(r);
    if (r && !r.owner_name) toast('This repeater needs an owner name before it can be saved.', 'warn');
    $('rm-maint').hidden = !r;
    if (r) loadMaint(r);
    history.replaceState(null, '', r ? '#edit-' + r.id : '#new');
    window.scrollTo(0, $('rm-p-editor').getBoundingClientRect().top + window.pageYOffset - 90);
  }

  $('rm-editor-fields').addEventListener('change', function (e) {
    if (e.target.id !== 'rm-f-meshfind') return;
    var v = e.target.value;
    var tail = (v.match(/([0-9a-f]{8})$/) || [])[1];
    var n = tail && liveNodes.find(function (x) { return x.public_key.slice(0, 8) === tail && v.indexOf(x.name || 'Unnamed') === 0; });
    if (!n) return;
    var form = $('rm-editor');
    form.public_key.value = n.public_key;
    if (!form.prefix.value) form.prefix.value = n.public_key.slice(0, 2).toUpperCase();
    if (!form.prefix_2byte.value && n.hash_size >= 2) form.prefix_2byte.value = n.public_key.slice(0, 4).toUpperCase();
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
    busy(form, true);
    var req = editing
      ? pb.collection('repeaters').update(editing.id, data, { expand: 'managers' })
      : pb.collection('repeaters').create(data, { expand: 'managers' });
    req.then(function (rec) {
      var i = repeaters.findIndex(function (x) { return x.id === rec.id; });
      if (i >= 0) repeaters[i] = rec; else repeaters.push(rec);
      repeaters.sort(function (a, b) { return a.name.localeCompare(b.name); });
      toast(editing ? 'Saved “' + rec.name + '”.' : 'Added “' + rec.name + '”.');
      renderRepeaters();
      openEditor(rec);
    }).catch(function (err) { toast(errText(err), 'bad', true); })
      .then(function () { busy(form, false); });
  });

  $('rm-editor-back').addEventListener('click', function () { showPanel('repeaters', true); renderRepeaters(); });
  $('rm-delete').addEventListener('click', function () {
    var btn = this, r = editing;
    if (!r) return;
    confirmClick(btn, 'Delete repeater', function () {
      pb.collection('repeaters').delete(r.id).then(function () {
        repeaters = repeaters.filter(function (x) { return x.id !== r.id; });
        toast('Deleted “' + r.name + '”.');
        showPanel('repeaters', true); renderRepeaters();
      }).catch(function (err) { toast(errText(err), 'bad'); });
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
        if (invite) return pb.collection('users').requestVerification(user.email).then(function () { return 'invited'; }, function () { return 'invite-failed'; });
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
      pb.collection('users').requestVerification(u.email).then(function () { toast('Invite sent to ' + u.email + '.'); })
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

  // ── prefixes (admins) ────────────────────────────────────────
  function renderPrefixes() {
    if (!isAdmin) return;
    $('rm-prefix-body').innerHTML = prefixes.map(function (p) {
      return '<tr><td class="rd-mono">' + esc(p.code) + '</td><td>' + esc(p.label) + '</td>' +
        '<td class="rm-right"><button type="button" class="rm-link rm-x" data-del-prefix="' + esc(p.id) + '">Remove</button></td></tr>';
    }).join('') || '<tr><td colspan="3" class="rd-muted">No reservations yet.</td></tr>';
  }
  $('rm-prefix-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this, code = f.code.value.trim().toUpperCase();
    if (!/^[0-9A-F]{2,6}$/.test(code)) { toast('Prefixes are 2–6 characters, 0–9 and A–F.', 'bad'); return; }
    busy(f, true);
    pb.collection('prefixes').create({ code: code, label: f.label.value.trim() }).then(function (p) {
      prefixes.push(p); prefixes.sort(function (a, b) { return a.code.localeCompare(b.code); });
      f.reset(); renderPrefixes(); toast('Reserved ' + code + '.');
    }).catch(function (err) { toast(errText(err), 'bad'); }).then(function () { busy(f, false); });
  });
  $('rm-prefix-body').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del-prefix]');
    if (!b) return;
    confirmClick(b, 'Remove', function () {
      var id = b.getAttribute('data-del-prefix');
      pb.collection('prefixes').delete(id).then(function () {
        prefixes = prefixes.filter(function (p) { return p.id !== id; }); renderPrefixes();
      }).catch(function (err) { toast(errText(err), 'bad'); });
    });
  });

  // ── account ──────────────────────────────────────────────────
  $('rm-account-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = this, name = f.name.value.trim();
    if (!name) { toast('Your name is required.', 'bad'); return; }
    busy(f, true);
    pb.collection('users').update(me.id, { name: name, callsign: f.callsign.value.trim().toUpperCase() }).then(function (u) {
      me = u; $('rm-me-name').textContent = u.name; toast('Saved.');
    }).catch(function (err) { toast(errText(err), 'bad'); }).then(function () { busy(f, false); });
  });
  $('rm-set-password').addEventListener('click', function () {
    pb.collection('users').requestPasswordReset(me.email).then(function () {
      toast('We emailed ' + me.email + ' a link to set your password.');
    }).catch(function (err) { toast(errText(err), 'bad'); });
  });

  // ── start ────────────────────────────────────────────────────
  if (pb.authStore.isValid && pb.authStore.record && pb.authStore.record.collectionName === 'users') {
    pb.collection('users').authRefresh().then(signedIn).catch(function () { pb.authStore.clear(); signedOut(); });
  } else {
    pb.authStore.clear();
    signedOut();
  }
})();
