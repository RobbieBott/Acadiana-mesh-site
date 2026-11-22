window.createOwnerMail = function (pb, $, onAccess) {
  var route = '/api/directory/owner-mail';
  var access = {};
  var generation = 0;
  var revision = 0;
  var preview = null;
  var catalog = { devices: [], owners: [] };
  var form = $('rm-mail-form');
  var status = $('rm-mail-status');
  var sendButton = $('rm-mail-send');
  var formButton = form.querySelector('button[type=submit]');
  var historyList = $('rm-mail-history');
  var sendTask = null;
  var samples = null;
  var sampleRequest = null;
  var sampleFrame = $('rm-mail-sample-frame');
  var sampleStatus = $('rm-mail-sample-status');

  function request(path, body) {
    return pb.send(route + path, body ? { method: 'POST', body: body } : {});
  }

  function clearPreview() {
    revision++;
    preview = null;
    $('rm-mail-preview').hidden = true;
  }

  function label(text, input) {
    var element = document.createElement('label');
    element.className = 'rm-check';
    element.append(input, document.createTextNode(' ' + text));
    return element;
  }

  function showTargets() {
    var scope = form.elements.scope.value;
    var rows = catalog[scope];
    $('rm-mail-targets').hidden = !rows;
    $('rm-mail-target-label').textContent = scope === 'owners' ? 'Choose owners' : 'Choose devices';
    var list = $('rm-mail-target-list');
    list.replaceChildren();
    if (!rows) return;
    if (!rows.length) list.textContent = 'No matches.';
    rows.forEach(function (row) {
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'mail-target';
      input.value = row.id;
      var suffix = row.type || row.callsign;
      list.append(label(row.name + (suffix ? ' · ' + suffix : ''), input));
    });
  }

  function loadHistory(rows) {
    historyList.replaceChildren();
    if (!rows.length) {
      historyList.textContent = 'No emails queued yet.';
      return;
    }
    rows.forEach(function (row) {
      var item = document.createElement('li');
      var counts = row.counts;
      item.textContent = row.subject + ' · ' + row.sender + ' · ' + new Date(row.created.replace(' ', 'T')).toLocaleString() +
        ' · ' + counts.accepted + ' accepted by mail server, ' + (counts.pending + counts.sending) +
        ' pending, ' + counts.failed + ' failed' + (counts.unknown ? ', ' + counts.unknown + ' unconfirmed' : '');
      if (row.devices.length) {
        var detail = document.createElement('details');
        var summary = document.createElement('summary');
        summary.textContent = row.devices.length + (row.devices.length === 1 ? ' device' : ' devices');
        detail.append(summary, document.createTextNode(row.devices.join(', ')));
        item.append(detail);
      }
      historyList.append(item);
    });
  }

  function showAdmins(admins) {
    var list = $('rm-mail-admins');
    list.replaceChildren();
    if (!admins.length) list.textContent = 'No other verified admins.';
    admins.forEach(function (admin) {
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = admin.enabled;
      input.addEventListener('change', function () {
        var current = generation;
        input.disabled = true;
        request('/permissions', { id: admin.id, enabled: input.checked }).then(function (result) {
          if (current !== generation) return;
          showAdmins(result.admins);
          status.textContent = 'Email permission updated.';
        }).catch(function () {
          if (current !== generation) return;
          input.checked = admin.enabled;
          input.disabled = false;
          status.textContent = 'Could not update email permission.';
        });
      });
      list.append(label(admin.name, input));
    });
  }

  function load(includeCatalog) {
    var current = generation;
    return request('').then(function (result) {
      if (current !== generation) return;
      if (includeCatalog) {
        catalog = result;
        showTargets();
      }
      $('rm-mail-mode').textContent = result.mode === 'send'
        ? 'Automatic offline emails are on for registered devices.' : 'Offline alerts are in log-only mode.';
      loadHistory(result.history);
    }).catch(function () {
      if (current === generation) status.textContent = 'Could not load owner emails.';
    });
  }

  function open() {
    var current = generation;
    load(true);
    loadSamples();
    $('rm-mail-permissions').hidden = !access.owner;
    if (access.owner) {
      request('/permissions').then(function (result) {
        if (current === generation) showAdmins(result.admins);
      }).catch(function () {
        if (current === generation) status.textContent = 'Could not load admin permissions.';
      });
    }
  }

  function renderSample() {
    if (!samples || preview) return;
    var html = samples[form.elements.template.value];
    if (!html) return;
    var rendered = new DOMParser().parseFromString(html, 'text/html');
    var heading = rendered.querySelector('h1');
    var firstParagraph = heading && heading.nextElementSibling;
    if (!firstParagraph || firstParagraph.tagName !== 'P') return;
    var subject = form.elements.subject.value.trim();
    var message = form.elements.message.value.trim();

    if (subject) heading.textContent = subject;
    if (message) {
      var paragraphs = rendered.createDocumentFragment();
      message.split(/\r?\n\s*\r?\n/).forEach(function (block) {
        var paragraph = firstParagraph.cloneNode(false);
        block.split(/\r?\n/).forEach(function (line, index) {
          if (index) paragraph.append(rendered.createElement('br'));
          paragraph.append(rendered.createTextNode(line));
        });
        paragraphs.append(paragraph);
      });
      var next = firstParagraph.nextElementSibling;
      while (next && next.tagName === 'P') {
        var after = next.nextElementSibling;
        next.remove();
        next = after;
      }
      firstParagraph.replaceWith(paragraphs);
    }

    var button = rendered.querySelector('[data-owner-mail-button]');
    if (button && form.elements.buttonMode.value !== 'directory') {
      var url = form.elements.buttonMode.value === 'custom' ? customButtonUrl() : '';
      if (url) {
        button.setAttribute('href', url);
        button.textContent = 'Open link';
      } else {
        button.remove();
      }
    }

    sampleFrame.srcdoc = '<!doctype html>' + rendered.documentElement.outerHTML;
    sampleFrame.hidden = false;
    var hint = !subject && !message ? 'Showing a sample subject and message.' :
      !subject ? 'Showing a sample subject.' : !message ? 'Showing a sample message.' : '';
    if (sampleStatus.textContent !== hint) sampleStatus.textContent = hint;
  }

  function loadSamples() {
    if (samples) { renderSample(); return; }
    if (sampleRequest) return;
    var current = generation;
    sampleStatus.textContent = 'Loading template…';
    sampleRequest = request('/templates').then(function (result) {
      if (current !== generation) return;
      samples = result;
      renderSample();
    }).catch(function () {
      if (current === generation) sampleStatus.textContent = 'Could not load the live preview. Reopen Owner Emails to try again.';
    }).finally(function () {
      if (current === generation) sampleRequest = null;
    });
  }

  function customButtonUrl() {
    var raw = form.elements.buttonUrl.value.trim();
    try {
      var parsed = new URL(raw);
      if (/^https?:\/\//i.test(raw) && !parsed.username && !parsed.password && !/[\s\\<>"]/u.test(raw)) return raw;
    } catch (_) {}
    return '';
  }

  function syncButtonFields() {
    var custom = form.elements.buttonMode.value === 'custom';
    $('rm-mail-button-url').hidden = !custom;
    form.elements.buttonUrl.disabled = !custom;
    form.elements.buttonUrl.required = custom;
  }

  form.addEventListener('input', function (event) {
    clearPreview();
    if (event.target.name === 'buttonMode') syncButtonFields();
    if (['subject', 'message', 'template', 'buttonMode', 'buttonUrl'].includes(event.target.name)) renderSample();
  });
  form.elements.scope.addEventListener('change', showTargets);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    clearPreview();
    var current = generation;
    var version = revision;
    var data = {
      scope: form.elements.scope.value,
      template: form.elements.template.value,
      subject: form.elements.subject.value,
      message: form.elements.message.value,
      buttonMode: form.elements.buttonMode.value,
      buttonUrl: form.elements.buttonUrl.value,
      ids: Array.from(form.querySelectorAll('input[name=mail-target]:checked'), function (input) { return input.value; })
    };
    formButton.disabled = true;
    status.textContent = 'Checking recipients…';
    request('/preview', data).then(function (result) {
      if (current !== generation || version !== revision) return;
      status.textContent = '';
      preview = { ...data, requestId: crypto.randomUUID(), fingerprint: result.fingerprint };
      $('rm-mail-count').textContent = result.count + (result.count === 1 ? ' recipient' : ' recipients') +
        (result.skipped ? ' · ' + result.skipped + ' selected devices without a verified recipient' : '');
      sampleFrame.srcdoc = result.html;
      sampleFrame.hidden = false;
      sampleStatus.textContent = '';
      $('rm-mail-preview').hidden = false;
      sendButton.disabled = !result.count || !!sendTask;
    }).catch(function (error) {
      if (current === generation && version === revision) status.textContent = error.message || 'Could not review recipients.';
    }).finally(function () { if (current === generation) formButton.disabled = false; });
  });

  sendButton.addEventListener('click', function () {
    if (!preview || sendTask) return;
    var current = generation;
    var version = revision;
    sendButton.disabled = true;
    formButton.disabled = true;
    sendTask = request('/send', preview).then(function () {
      if (current !== generation) return;
      if (version === revision) {
        form.reset();
        syncButtonFields();
        showTargets();
        clearPreview();
        renderSample();
      }
      status.textContent = 'Email queued.';
      load(false);
    }).catch(function (error) {
      if (current !== generation) return;
      status.textContent = error.message || 'Could not queue the email.';
      if (version === revision) sendButton.disabled = false;
    }).finally(function () {
      sendTask = null;
      if (current === generation) formButton.disabled = false;
    });
  });

  $('rm-mail-refresh').addEventListener('click', function () { load(false); });

  return {
    canSend: function () { return !!access.sender; },
    open: open,
    signIn: function () {
      var current = ++generation;
      request('/access').then(function (result) {
        if (current !== generation) return;
        access = result;
        onAccess(access);
      }).catch(function () { if (current === generation) onAccess({}); });
    },
    signOut: function () {
      generation++;
      access = {};
      catalog = { devices: [], owners: [] };
      onAccess(access);
      form.reset();
      syncButtonFields();
      clearPreview();
      showTargets();
      formButton.disabled = false;
      status.textContent = '';
      historyList.replaceChildren();
      samples = null;
      sampleRequest = null;
      sampleFrame.hidden = true;
      sampleFrame.removeAttribute('srcdoc');
      sampleStatus.textContent = '';
      $('rm-mail-admins').replaceChildren();
    },
    pauseValue: function (date) {
      if (!date) return '';
      var utcGuess = new Date(date + 'T00:00:00Z');
      var reference = new Date(date + 'T06:00:00Z');
      var parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago', timeZoneName: 'longOffset'
      }).formatToParts(reference);
      var offset = parts.find(function (part) { return part.type === 'timeZoneName'; });
      var hours = Number(offset.value.slice(3, 6));
      return new Date(utcGuess.getTime() - hours * 3600000).toISOString();
    }
  };
};
