// Service Worker that appends CloudFront signing params to asset requests.
// This intercepts ALL fetch requests (including from Web Workers) within scope.

let cloudfrontParams = '';

self.addEventListener('install', () => {
  console.log('[SW] Installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'set-cloudfront-params') {
    cloudfrontParams = event.data.params;
    console.log('[SW] Params set, length:', cloudfrontParams.length);
    if (event.ports[0]) {
      event.ports[0].postMessage('ok');
    }
  }
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('assets.pennsieve')) {
    if (cloudfrontParams) {
      const separator = url.includes('?') ? '&' : '?';
      const signedUrl = url + separator + cloudfrontParams;
      console.log('[SW] Signing:', url.split('/').slice(-3).join('/'));
      event.respondWith(fetch(signedUrl));
    } else {
      console.warn('[SW] No params yet for:', url);
    }
  }
});
