/* ============================================================
   Aki · native bridge
   Only active inside the Capacitor iOS app (window.Capacitor present).
   Listens for aki:// deep links opened by the Lock/Home-Screen widgets
   and routes them to the web app's window.aki API. No-ops in the PWA.
   ============================================================ */
(function () {
  'use strict';
  var Cap = window.Capacitor;
  if (!Cap || !Cap.Plugins || !Cap.Plugins.App) return;
  var App = Cap.Plugins.App;

  // accepts aki://start/<slug>, aki://open/<slug>, or https://…/?start=<slug>
  function route(rawUrl) {
    if (!rawUrl || !window.aki) return;
    try {
      var u = new URL(rawUrl);
      var slug = null, begin = true;
      if (u.protocol === 'aki:') {
        // host holds the action, pathname holds the slug → aki://start/vo2-max
        var parts = (u.host + u.pathname).split('/').filter(Boolean);
        begin = parts[0] !== 'open';
        slug = parts[1];
      } else {
        slug = u.searchParams.get('start') || u.searchParams.get('open');
        begin = !!u.searchParams.get('start');
      }
      if (slug) (begin ? window.aki.start : window.aki.open)(slug);
    } catch (_) { /* ignore malformed urls */ }
  }

  // app already running and brought to front by a widget tap
  App.addListener('appUrlOpen', function (data) { route(data && data.url); });

  // cold start: the url that launched the app
  if (App.getLaunchUrl) {
    App.getLaunchUrl().then(function (res) { route(res && res.url); }).catch(function () {});
  }
})();
