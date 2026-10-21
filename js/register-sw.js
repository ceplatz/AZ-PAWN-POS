// Registers the service worker and shows a small "update available" bar when a new version is ready.
if ('serviceWorker' in navigator) {
  addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            const bar = document.createElement('div');
            bar.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);background:#182a3c;border:1px solid #f5b52e;color:#fdf3d6;padding:10px 16px;border-radius:12px;z-index:50;font:14px system-ui';
            bar.innerHTML = 'A new version is ready. <button style="margin-left:10px;background:#f5b52e;border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer">Reload</button>';
            bar.querySelector('button').onclick = () => location.reload(); document.body.appendChild(bar);
          }
        });
      });
    } catch { /* not supported or blocked: the app works without it */ }
  });
}
