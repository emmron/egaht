// Eghact DevTools Popup Script
// Agent 3 v2.0 - Making the extension actually useful

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status-text');
  const openButton = document.getElementById('open-devtools');
  
  // Check if current tab has Eghact
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab) {
    try {
      // Try to detect Eghact on the page
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => !!window.__EGHACT_DEVTOOLS__
      });
      
      const hasEghact = result[0]?.result;
      
      if (hasEghact) {
        statusEl.textContent = '✓ Eghact detected';
        statusEl.className = 'connected';
      } else {
        statusEl.textContent = '✗ Eghact not detected';
        statusEl.className = 'disconnected';
      }
    } catch (error) {
      statusEl.textContent = '⚠️ Cannot access this page';
      statusEl.className = 'disconnected';
    }
  }
  
  // Open DevTools button
  openButton.addEventListener('click', () => {
    // Send message to open DevTools
    chrome.runtime.sendMessage({ action: 'openDevTools' });
    window.close();
  });
});