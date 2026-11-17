/* Tabbed pages (Wiki, Get Connected): pill tabs that show one .wiki-panel at a time.
   Links like /page/#panel-id or /page/#heading-inside-a-panel open the right tab.
   Fires a "tab:shown" event (detail = panel id) whenever a tab is shown. */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.wiki-tabs [data-tab]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.wiki-panel'));
  if (!tabs.length) return;
  document.documentElement.classList.add('wiki-js');

  function panelFor(hash) {
    var id = (hash || '').replace(/^#/, '');
    if (!id) return null;
    var el = document.getElementById(id);
    if (!el) return null;
    return el.classList.contains('wiki-panel') ? el : el.closest('.wiki-panel');
  }

  function show(panel, target, push) {
    panels.forEach(function (p) { p.hidden = (p !== panel); });
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tab') === panel.id;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    document.dispatchEvent(new CustomEvent('tab:shown', { detail: panel.id }));
    if (push) history.replaceState(null, '', '#' + (target || panel.id));
    if (target && target !== panel.id) {
      var el = document.getElementById(target);
      if (el) el.scrollIntoView();
    } else if (push) {
      var nav = document.querySelector('.wiki-tabs');
      var y = nav.getBoundingClientRect().top + window.pageYOffset - 80;
      if (window.pageYOffset > y) window.scrollTo(0, y);
    }
  }

  function route() {
    var id = location.hash.replace(/^#/, '');
    var panel = panelFor(location.hash) || panels[0];
    show(panel, id && document.getElementById(id) ? id : null, false);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    var i = href.indexOf('#');
    if (i < 0) return;
    var path = href.slice(0, i);
    if (path && path.replace(/\/$/, '') !== location.pathname.replace(/\/$/, '')) return;
    var id = href.slice(i + 1);
    var panel = panelFor('#' + id);
    if (!panel) return;
    e.preventDefault();
    show(panel, id, true);
  });
  window.addEventListener('hashchange', route);
  route();

  // Copy buttons on command and code blocks inside tabs
  document.querySelectorAll('.wiki-panel pre').forEach(function (pre) {
    if (!pre.querySelector('code') || pre.querySelector('.wiki-copy')) return;
    pre.classList.add('has-copy');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wiki-copy';
    btn.textContent = 'Copy';
    btn.addEventListener('click', function () {
      var text = pre.querySelector('code').innerText;
      var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () {});
    });
    pre.appendChild(btn);
  });
})();
