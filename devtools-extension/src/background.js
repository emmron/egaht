// Eghact DevTools Background Service Worker
// Agent 3 v2.0 - Managing the communication highway

// Store connections to DevTools panels
const connections = new Map();

// Store component data per tab
const tabData = new Map();

console.log('[Eghact Background] Service worker initialized');

// Listen for connections from DevTools panels
chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'eghact-devtools') return;
    
    const tabId = port.sender?.tab?.id || port.sender?.url?.match(/tabId=(\d+)/)?.[1];
    if (!tabId) {
        console.error('[Eghact Background] Could not determine tab ID');
        return;
    }
    
    console.log(`[Eghact Background] DevTools connected for tab ${tabId}`);
    
    // Store connection
    connections.set(parseInt(tabId), port);
    
    // Send cached data if available
    if (tabData.has(parseInt(tabId))) {
        port.postMessage({
            type: 'cached-data',
            data: tabData.get(parseInt(tabId))
        });
    }
    
    // Handle disconnect
    port.onDisconnect.addListener(() => {
        console.log(`[Eghact Background] DevTools disconnected for tab ${tabId}`);
        connections.delete(parseInt(tabId));
    });
    
    // Handle messages from DevTools
    port.onMessage.addListener((message) => {
        handleDevToolsMessage(message, parseInt(tabId));
    });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.source === 'content-script') {
        handleContentScriptMessage(message, sender.tab?.id);
    }
});

// Handle messages from content scripts
function handleContentScriptMessage(message, tabId) {
    if (!tabId) return;
    
    console.log(`[Eghact Background] Content script message from tab ${tabId}:`, message.type);
    
    // Store data for this tab
    if (!tabData.has(tabId)) {
        tabData.set(tabId, {
            connected: false,
            componentTree: [],
            performance: {}
        });
    }
    
    const data = tabData.get(tabId);
    
    switch (message.type) {
        case 'init':
            data.connected = message.hasEghact;
            break;
            
        case 'devtools-update':
            data.componentTree = message.tree || [];
            if (message.updates) {
                // Process updates
                message.updates.forEach(update => {
                    console.log(`[Eghact Background] Component ${update.type}:`, update.data);
                });
            }
            break;
            
        case 'component-tree':
            data.componentTree = message.tree || [];
            break;
            
        case 'component-details':
            // Forward specific component details
            break;
            
        case 'performance-metrics':
            data.performance = message.metrics || {};
            break;
            
        case 'disconnected':
            data.connected = false;
            data.componentTree = [];
            break;
    }
    
    // Forward to DevTools if connected
    const port = connections.get(tabId);
    if (port) {
        try {
            port.postMessage({
                source: 'background',
                ...message,
                tabData: data
            });
        } catch (e) {
            console.error('[Eghact Background] Failed to send message to DevTools:', e);
            connections.delete(tabId);
        }
    }
}

// Handle messages from DevTools panels
function handleDevToolsMessage(message, tabId) {
    console.log(`[Eghact Background] DevTools message for tab ${tabId}:`, message.type);
    
    // Forward to content script
    chrome.tabs.sendMessage(tabId, {
        source: 'devtools-panel',
        ...message
    }).catch(err => {
        console.error('[Eghact Background] Failed to send message to content script:', err);
    });
}

// Clean up data when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    console.log(`[Eghact Background] Tab ${tabId} closed, cleaning up`);
    connections.delete(tabId);
    tabData.delete(tabId);
});

// Set up extension icon
chrome.action.onClicked.addListener((tab) => {
    // Open DevTools when icon is clicked
    chrome.windows.create({
        url: chrome.runtime.getURL('src/devtools/devtools.html'),
        type: 'popup',
        width: 800,
        height: 600
    });
});

console.log('[Eghact Background] Agent 3 v2.0 - Communication highway operational!');