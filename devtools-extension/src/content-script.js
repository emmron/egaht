// Eghact DevTools Content Script
// Agent 3 v2.0 - The bridge that connects runtime to DevTools

(function() {
    'use strict';
    
    console.log('[Eghact Content Script] Initializing bridge...');
    
    // Inject the runtime hook into the page
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/bridge/runtime-hook.js');
    script.onload = function() {
        console.log('[Eghact Content Script] Runtime hook injected successfully');
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    
    // Track connection state
    let devtoolsPort = null;
    let isConnected = false;
    
    // Listen for messages from the page (runtime hook)
    window.addEventListener('message', (event) => {
        // Only accept messages from the same origin
        if (event.source !== window) return;
        
        if (event.data && event.data.source === 'eghact-runtime') {
            handleRuntimeMessage(event.data);
        }
    });
    
    // Handle messages from runtime
    function handleRuntimeMessage(message) {
        console.log('[Eghact Content Script] Runtime message:', message.type);
        
        // Forward to background script
        chrome.runtime.sendMessage({
            source: 'content-script',
            tabId: chrome.devtools?.inspectedWindow?.tabId,
            ...message
        });
    }
    
    // Listen for messages from background script (DevTools)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.source === 'devtools-panel') {
            handleDevToolsMessage(message);
        }
    });
    
    // Handle messages from DevTools
    function handleDevToolsMessage(message) {
        console.log('[Eghact Content Script] DevTools message:', message.type);
        
        // Forward to page
        window.postMessage({
            source: 'eghact-devtools',
            ...message
        }, '*');
    }
    
    // Establish connection with DevTools
    function establishDevToolsConnection() {
        // Send initial connection message
        chrome.runtime.sendMessage({
            source: 'content-script',
            type: 'init',
            hasEghact: !!window.__EGHACT_DEVTOOLS__
        });
        
        // Check for Eghact runtime
        if (window.__EGHACT_DEVTOOLS__) {
            console.log('[Eghact Content Script] Eghact runtime detected!');
            isConnected = true;
            
            // Request initial component tree
            window.postMessage({
                source: 'eghact-devtools',
                type: 'get-tree'
            }, '*');
            
            // Request initial performance metrics
            window.postMessage({
                source: 'eghact-devtools',
                type: 'get-performance'
            }, '*');
        } else {
            console.log('[Eghact Content Script] No Eghact runtime detected');
            isConnected = false;
        }
    }
    
    // Set up periodic checks for Eghact runtime
    let checkInterval = setInterval(() => {
        if (window.__EGHACT_DEVTOOLS__ && !isConnected) {
            console.log('[Eghact Content Script] Eghact runtime appeared!');
            isConnected = true;
            establishDevToolsConnection();
        } else if (!window.__EGHACT_DEVTOOLS__ && isConnected) {
            console.log('[Eghact Content Script] Eghact runtime disappeared');
            isConnected = false;
            chrome.runtime.sendMessage({
                source: 'content-script',
                type: 'disconnected'
            });
        }
    }, 1000);
    
    // Initial connection attempt
    setTimeout(establishDevToolsConnection, 100);
    
    // Clean up on page unload
    window.addEventListener('unload', () => {
        clearInterval(checkInterval);
        chrome.runtime.sendMessage({
            source: 'content-script',
            type: 'unload'
        });
    });
    
    console.log('[Eghact Content Script] Bridge ready - Agent 3 v2.0 delivering!');
})();