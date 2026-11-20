import { WebContents } from 'electron';

export async function injectNewChat(webContents: WebContents) {
    const code = `
    (function() {
      // Try to find the "New chat" button
      // Strategy 1: Look for aria-label "New chat" or similar text
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
      const newChatBtn = buttons.find(b => 
        b.textContent?.includes('New chat') || 
        b.getAttribute('aria-label')?.includes('New chat') ||
        b.getAttribute('data-test-id') === 'new-chat-button'
      );

      if (newChatBtn) {
        newChatBtn.click();
        return 'clicked';
      }

      // Strategy 2: Navigate to the main app URL which usually starts a new chat
      window.location.href = 'https://gemini.google.com/app';
      return 'navigated';
    })();
  `;

    try {
        const result = await webContents.executeJavaScript(code);
        console.log('New chat injection result:', result);
    } catch (error) {
        console.error('Failed to inject new chat script:', error);
    }
}

const GEMINI_UI_CLEANUP_CSS = `
[data-gw-hidden="true"],
[data-test-id*="get-app"],
[data-test-id*="download-app"],
[data-test-id*="app-download"],
[aria-label="Get app" i],
[aria-label="Get the app" i],
[aria-label="Get Gemini app" i],
[aria-label="Download app" i],
get-app-button,
app-download-banner,
mobile-app-download-banner {
    display: none !important;
}
`;

const GEMINI_HIDE_GET_APP_SCRIPT = `
(function() {
  if (window.__gwGetAppObserverInstalled) {
    window.__gwHideGetApp && window.__gwHideGetApp();
    return;
  }
  window.__gwGetAppObserverInstalled = true;

  const TEXT_PATTERN = /^(?:get(?:\\s+the)?(?:\\s+gemini)?\\s+app|download(?:\\s+the)?(?:\\s+gemini)?\\s+app)$/i;
  const HREF_PATTERN = /(?:play\\.google\\.com\\/store\\/apps\\/details\\?id=com\\.google\\.android\\.apps\\.bard|apps\\.apple\\.com\\/.*gemini|gemini\\.google\\.com\\/(?:app\\/)?download)/i;

  function normalizeText(str) {
    return (str || '').replace(/\\s+/g, ' ').trim();
  }

  function matchesGetApp(el) {
    if (!el || el.nodeType !== 1) return false;
    const text = normalizeText(el.innerText || el.textContent);
    if (text && text.length <= 36 && TEXT_PATTERN.test(text)) {
      return true;
    }

    const attrs = [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('mattooltip'),
      el.getAttribute('data-tooltip'),
      el.getAttribute('data-test-id'),
    ];
    for (const val of attrs) {
      const norm = normalizeText(val);
      if (norm && (TEXT_PATTERN.test(norm) || /get[-_\\s]?app|app[-_\\s]?download/i.test(norm))) {
        return true;
      }
    }

    const href = el.getAttribute('href');
    if (href && HREF_PATTERN.test(href)) {
      return true;
    }

    return false;
  }

  function hideElementSafely(el) {
    if (!el || el.getAttribute('data-gw-hidden') === 'true') return;
    const rect = el.getBoundingClientRect();
    // Safety guard: never hide large layout containers
    if (rect.height > 120 || rect.width > 420) return;

    // If wrapped in a tiny dedicated Angular host element with no other buttons/links, hide that wrapper too
    let target = el;
    const parent = el.parentElement;
    if (parent && parent.tagName.includes('-')) {
      const pRect = parent.getBoundingClientRect();
      const interactiveCount = parent.querySelectorAll('button, a[href], [role="button"]').length;
      if (interactiveCount === 1 && pRect.height <= 90 && pRect.width <= 360) {
        target = parent;
      }
    }

    target.setAttribute('data-gw-hidden', 'true');
  }

  function scan() {
    const candidates = document.querySelectorAll(
      'button, a, [role="button"], [data-test-id*="app"], [aria-label*="app" i]'
    );
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (el.getAttribute('data-gw-hidden') === 'true') continue;
      if (matchesGetApp(el)) {
        hideElementSafely(el);
      }
    }
  }

  window.__gwHideGetApp = scan;
  scan();

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-label', 'class'],
    });
  }
})();
`;

export function attachGeminiUiCleanup(webContents: WebContents) {
    const applyCleanup = () => {
        if (webContents.isDestroyed()) return;
        const url = webContents.getURL();
        if (!url || !url.startsWith('https://gemini.google.com')) return;

        webContents.insertCSS(GEMINI_UI_CLEANUP_CSS).catch(() => {});
        webContents.executeJavaScript(GEMINI_HIDE_GET_APP_SCRIPT, true).catch(() => {});
    };

    webContents.on('dom-ready', applyCleanup);
    webContents.on('did-finish-load', applyCleanup);
    webContents.on('did-navigate-in-page', applyCleanup);
}
