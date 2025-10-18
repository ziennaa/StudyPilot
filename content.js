(function injectButton() {
  if (document.getElementById('__studypilot_btn')) return;

  const btn = document.createElement('button');
  btn.id = '__studypilot_btn';
  btn.textContent = 'StudyPilot ▶︎';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '16px',
    right: '16px',
    zIndex: '2147483647',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,.08)',
    background: '#ffd166',
    color: '#111',
    cursor: 'pointer'
  });

  // Safe send: works even if the extension was just reloaded
  function openPanelSafe() {
    // if the extension context is gone (after reload), this will be falsey
    if (!chrome?.runtime?.id) return;
    try {
      const p = chrome.runtime.sendMessage({ kind: 'OPEN_PANEL' });
      // avoid unhandled promise rejection from context invalidation
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) { /* ignore */ }
  }

  btn.addEventListener('click', openPanelSafe);

  // Re-attach if some SPA wipes the body
  const mo = new MutationObserver(() => {
    if (!document.getElementById('__studypilot_btn')) {
      document.body.appendChild(btn);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  document.body.appendChild(btn);
})();
