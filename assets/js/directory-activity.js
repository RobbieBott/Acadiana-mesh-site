/* Site Owner activity and automatic offline email controls. */
window.createDirectoryActivity = function (pb, $, isOwner) {
  var page = 1, version = 0, pending = false;
  var form = $('rm-activity-filter');
  var table = $('rm-activity-body');
  var mode = $('rm-activity-mode');
  var toggle = $('rm-activity-toggle');
  var status = $('rm-activity-status');
  var previous = $('rm-activity-prev'), next = $('rm-activity-next');
  var enabled;

  function describe(error) {
    return error && error.response && error.response.message || 'Could not complete that request. Please try again.';
  }

  function renderMode() {
    var known = typeof enabled === 'boolean';
    mode.textContent = known ? (enabled ? 'Status emails are on' : 'Status emails are in log-only mode') : '';
    mode.className = 'rd-pill ' + (enabled ? 'ok' : 'warn');
    mode.hidden = !known;
    toggle.disabled = pending || !known;
    toggle.textContent = enabled ? 'Switch to log only' : 'Enable status emails';
    $('rm-activity-preview').disabled = pending;
  }

  function row(event) {
    var tr = document.createElement('tr');
    var time = Date.parse(String(event.created).replace(' ', 'T'));
    var values = [Number.isFinite(time) ? new Date(time).toLocaleString() : '—',
      event.actor, event.action, event.target || event.targetId || '—', event.detail || '—'];
    values.forEach(function (value, index) {
      var td = document.createElement('td');
      td.textContent = value;
      if (index === 1 && event.actorId) td.title = event.actorId;
      if (index === 3 && event.targetId) td.title = event.targetId;
      tr.appendChild(td);
    });
    return tr;
  }

  function load(message) {
    if (!isOwner()) return Promise.resolve();
    var request = ++version;
    var query = new URLSearchParams({ page: String(page), category: form.elements.category.value, q: form.elements.q.value.trim() });
    previous.disabled = next.disabled = true;
    status.textContent = 'Loading activity…';
    $('rm-activity-table').setAttribute('aria-busy', 'true');
    return pb.send('/api/directory/activity?' + query.toString(), { requestKey: null }).then(function (result) {
      if (request !== version || !isOwner()) return;
      enabled = result.enabled;
      table.replaceChildren.apply(table, result.events.map(row));
      previous.disabled = page === 1;
      next.disabled = !result.more;
      $('rm-activity-page').textContent = 'Page ' + page;
      status.textContent = message || (result.events.length ? '' : 'No activity matches these filters.');
    }).catch(function (error) {
      if (request === version && isOwner()) status.textContent = describe(error);
    }).finally(function () {
      if (request !== version || !isOwner()) return;
      $('rm-activity-table').removeAttribute('aria-busy');
      renderMode();
    });
  }

  function change(action, options, message) {
    if (!isOwner() || pending) return;
    pending = true;
    renderMode();
    status.textContent = 'Working…';
    return pb.send('/api/directory/activity/' + action, options).then(function (result) {
      if (!isOwner()) return;
      form.elements.category.value = 'status';
      form.elements.q.value = '';
      page = 1;
      return load(message(result));
    }).catch(function (error) {
      if (isOwner()) status.textContent = describe(error);
    }).finally(function () {
      pending = false;
      renderMode();
    });
  }

  form.addEventListener('submit', function (event) { event.preventDefault(); page = 1; load(); });
  form.elements.category.addEventListener('change', function () { page = 1; load(); });
  previous.addEventListener('click', function () { if (page > 1) { page--; load(); } });
  next.addEventListener('click', function () { page++; load(); });
  $('rm-activity-preview').addEventListener('click', function () {
    change('preview-status', { method: 'POST' }, function (result) {
      return 'Preview complete. ' + result.count + (result.count === 1 ? ' listing is overdue.' : ' listings are overdue.');
    });
  });
  toggle.addEventListener('click', function () {
    if (typeof enabled !== 'boolean') return;
    change('status-emails', { method: 'PATCH', body: { enabled: !enabled, previous: enabled } }, function (result) {
      enabled = result.enabled;
      return enabled ? 'Status emails are enabled for future outages.' : 'Status emails are in log-only mode.';
    });
  });

  return {
    open: function () { load(); },
    reset: function () {
      version++;
      page = 1;
      enabled = undefined;
      pending = false;
      table.replaceChildren();
      $('rm-activity-table').removeAttribute('aria-busy');
      status.textContent = '';
      renderMode();
    }
  };
};
