import { WebContents } from 'electron';

export async function injectNewChat(webContents: WebContents) {
    const code = `
    (function() {
      // Try to find the "New chat" button
      // Note: Selectors are based on observation and may change.
      // Strategy 1: Look for aria-label "New chat" or similar text
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
      const newChatBtn = buttons.find(b => 
        b.textContent?.includes('New chat') || 
        b.getAttribute('aria-label')?.includes('New chat') ||
        b.getAttribute('data-test-id') === 'new-chat-button' // Hypothetical
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
