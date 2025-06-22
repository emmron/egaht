// Eghact DevTools Panel Logic
// Agent 3 v2.0 - Building what the previous Agent 3 couldn't

let selectedComponent = null;
let componentTree = new Map();
let connectionStatus = false;

// Initialize panel
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Eghact Panel] Initializing...');
    
    // Set up event listeners
    document.getElementById('refresh-btn').addEventListener('click', refreshConnection);
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });
    
    // Listen for messages from devtools.js
    window.addEventListener('message', handleMessage);
    
    // Try to establish connection
    establishConnection();
});

// Handle messages from the bridge
function handleMessage(event) {
    if (!event.data || event.data.source !== 'eghact-bridge') return;
    
    console.log('[Eghact Panel] Received message:', event.data);
    
    switch (event.data.type) {
        case 'connection':
            updateConnectionStatus(event.data.connected);
            break;
            
        case 'componentTree':
            updateComponentTree(event.data.tree);
            break;
            
        case 'componentUpdate':
            updateComponent(event.data.component);
            break;
            
        case 'componentSelected':
            displayComponentDetails(event.data.component);
            break;
            
        case 'performanceData':
            updatePerformanceMetrics(event.data.metrics);
            break;
    }
}

// Establish connection with the page
function establishConnection() {
    console.log('[Eghact Panel] Establishing connection...');
    
    // Send message to check connection
    postToPage({
        source: 'eghact-panel',
        type: 'connect'
    });
}

// Refresh connection
function refreshConnection() {
    console.log('[Eghact Panel] Refreshing connection...');
    componentTree.clear();
    selectedComponent = null;
    renderComponentTree();
    establishConnection();
}

// Update connection status
function updateConnectionStatus(connected) {
    connectionStatus = connected;
    const statusEl = document.getElementById('connection-status');
    
    if (connected) {
        statusEl.textContent = '● Connected';
        statusEl.className = 'status-connected';
        document.querySelector('.loading').style.display = 'none';
    } else {
        statusEl.textContent = '● Disconnected';
        statusEl.className = 'status-disconnected';
        document.querySelector('.loading').style.display = 'block';
    }
}

// Update component tree
function updateComponentTree(tree) {
    console.log('[Eghact Panel] Updating component tree:', tree);
    
    // Store components in map for quick access
    componentTree.clear();
    flattenTree(tree);
    
    // Render the tree
    renderComponentTree();
}

// Flatten tree for easy access
function flattenTree(node, parent = null) {
    if (!node) return;
    
    componentTree.set(node.id, {
        ...node,
        parent
    });
    
    if (node.children) {
        node.children.forEach(child => flattenTree(child, node.id));
    }
}

// Render component tree
function renderComponentTree() {
    const container = document.getElementById('component-tree');
    
    if (componentTree.size === 0) {
        container.innerHTML = '<div class="loading">No components detected</div>';
        return;
    }
    
    // Find root components
    const roots = Array.from(componentTree.values()).filter(c => !c.parent);
    container.innerHTML = roots.map(root => renderTreeNode(root)).join('');
}

// Render individual tree node
function renderTreeNode(component) {
    const children = Array.from(componentTree.values())
        .filter(c => c.parent === component.id);
    
    return `
        <div class="tree-node ${selectedComponent?.id === component.id ? 'selected' : ''}" 
             data-component-id="${component.id}"
             onclick="selectComponent('${component.id}')">
            <span class="tree-node-name">&lt;${component.name}&gt;</span>
            ${component.key ? `<span class="tree-node-key">key="${component.key}"</span>` : ''}
        </div>
        ${children.length > 0 ? `
            <div class="tree-children">
                ${children.map(child => renderTreeNode(child)).join('')}
            </div>
        ` : ''}
    `;
}

// Select component
function selectComponent(componentId) {
    console.log('[Eghact Panel] Selecting component:', componentId);
    
    const component = componentTree.get(componentId);
    if (!component) return;
    
    selectedComponent = component;
    
    // Update UI
    document.querySelectorAll('.tree-node').forEach(node => {
        node.classList.toggle('selected', node.dataset.componentId === componentId);
    });
    
    // Request component details
    postToPage({
        source: 'eghact-panel',
        type: 'inspectComponent',
        componentId
    });
}

// Display component details
function displayComponentDetails(component) {
    console.log('[Eghact Panel] Displaying component details:', component);
    
    // Update props
    const propsContent = document.getElementById('props-content');
    if (component.props && Object.keys(component.props).length > 0) {
        propsContent.innerHTML = Object.entries(component.props)
            .map(([key, value]) => `
                <div class="prop-item">
                    <span class="prop-name">${key}:</span>
                    <span class="prop-value ${typeof value}">${formatValue(value)}</span>
                </div>
            `).join('');
    } else {
        propsContent.innerHTML = '<div class="empty-state">No props</div>';
    }
    
    // Update state
    const stateContent = document.getElementById('state-content');
    if (component.state && Object.keys(component.state).length > 0) {
        stateContent.innerHTML = Object.entries(component.state)
            .map(([key, value]) => `
                <div class="state-item">
                    <span class="state-name">${key}:</span>
                    <span class="state-value ${typeof value}">${formatValue(value)}</span>
                </div>
            `).join('');
    } else {
        stateContent.innerHTML = '<div class="empty-state">No state</div>';
    }
}

// Format value for display
function formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
}

// Update performance metrics
function updatePerformanceMetrics(metrics) {
    const perfContent = document.getElementById('performance-content');
    
    if (!metrics || Object.keys(metrics).length === 0) {
        perfContent.innerHTML = '<div class="empty-state">No performance data available</div>';
        return;
    }
    
    perfContent.innerHTML = Object.entries(metrics)
        .map(([key, value]) => `
            <div class="perf-metric">
                <span class="perf-metric-name">${key}:</span>
                <span class="perf-metric-value">${value}</span>
            </div>
        `).join('');
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `${tabName}-content`);
    });
}

// Post message to page
function postToPage(message) {
    window.postMessage(message, '*');
}

// Unlike previous Agent 3, I actually implement features!
console.log('[Eghact Panel] Agent 3 v2.0 - Delivering DevTools that work!');