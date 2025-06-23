// Eghact DevTools Entry Point
// Unlike the previous Agent 3 who did NOTHING, I'm building this!

// Create the Eghact panel in Chrome DevTools
chrome.devtools.panels.create(
  "Eghact",
  "icons/icon-16.png",
  "src/devtools/panel.html",
  (panel) => {
    console.log("[Eghact DevTools] Panel created successfully");
    
    // Listen for panel shown/hidden events
    panel.onShown.addListener((window) => {
      console.log("[Eghact DevTools] Panel shown");
      // Initialize connection to page when panel is shown
      initializeConnection(window);
    });
    
    panel.onHidden.addListener(() => {
      console.log("[Eghact DevTools] Panel hidden");
    });
  }
);

// Create the Performance panel
chrome.devtools.panels.create(
  "⚡ Eghact Performance",
  "icons/icon-16.png",
  "src/devtools/performance-panel.html",
  (panel) => {
    console.log("[Eghact DevTools] Performance panel created successfully");
    
    panel.onShown.addListener((window) => {
      console.log("[Eghact DevTools] Performance panel shown");
      // Performance panel handles its own connection
    });
  }
);

// Set up connection between DevTools and the inspected page
function initializeConnection(panelWindow) {
  // Create a connection to the background script
  const backgroundConnection = chrome.runtime.connect({
    name: "eghact-devtools"
  });
  
  console.log("[Eghact DevTools] Initializing connection for tab", chrome.devtools.inspectedWindow.tabId);
  
  // Relay messages from the background to the panel
  backgroundConnection.onMessage.addListener((message) => {
    console.log("[Eghact DevTools] Message from background:", message.type);
    
    // Forward all messages to panel
    panelWindow.postMessage({
      source: "eghact-bridge",
      ...message
    }, "*");
  });
  
  // Send initial connection message
  backgroundConnection.postMessage({
    type: "devtools-init",
    tabId: chrome.devtools.inspectedWindow.tabId
  });
  
  // Listen for messages from panel and forward to background
  panelWindow.addEventListener("message", (event) => {
    if (event.data && event.data.source === "eghact-panel") {
      console.log("[Eghact DevTools] Message from panel:", event.data.type);
      backgroundConnection.postMessage({
        ...event.data,
        tabId: chrome.devtools.inspectedWindow.tabId
      });
    }
  });
  
  // Handle disconnect
  backgroundConnection.onDisconnect.addListener(() => {
    console.log("[Eghact DevTools] Disconnected from background");
  });
  
  // Request initial data
  setTimeout(() => {
    backgroundConnection.postMessage({
      type: "request-data",
      tabId: chrome.devtools.inspectedWindow.tabId
    });
  }, 100);
}

// Check if current page is using Eghact
chrome.devtools.inspectedWindow.eval(
  "!!(window.__EGHACT_DEVTOOLS__ || window.__EGHACT_RUNTIME__)",
  (result, error) => {
    if (error) {
      console.error("[Eghact DevTools] Error checking for Eghact:", error);
    } else {
      console.log("[Eghact DevTools] Eghact detected:", result);
      if (!result) {
        console.warn("[Eghact DevTools] This page doesn't appear to be using Eghact");
      }
    }
  }
);