(function(){
  function fire(eventName, params){
    try {
      if (typeof gtag === 'function') gtag('event', eventName, params || {});
    } catch (_) {}
  }

  // Track outbound clicks with basic metadata
  document.addEventListener('click', function(e){
    var a = e.target && (e.target.closest ? e.target.closest('a') : null);
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var id = a.getAttribute('id') || '';

    if (id.startsWith('cta_')) {
      fire('generate_lead', { method: id, page: location.pathname, href: href });
    }

    // Outbound link click tracking (non-blocking)
    if (/^https?:\/\//i.test(href)) {
      var isSameHost = false;
      try { isSameHost = (new URL(href, location.href)).host === location.host; } catch (_) {}
      if (!isSameHost) {
        fire('click_outbound', { page: location.pathname, href: href });
      }
    }
  }, { passive: true });

  // If user lands on /thank-you/, count as a lead
  if (location.pathname === '/thank-you/' || location.pathname === '/thank-you') {
    var sp = new URLSearchParams(location.search);
    fire('generate_lead', {
      method: sp.get('src') || 'thank_you',
      page: '/thank-you/'
    });
  }
})();
