// Eghact DevTools Runtime Hook
// Agent 3 v2.0 - Building the bridge that connects everything

(function() {
    'use strict';
    
    // Check if DevTools hook already exists
    if (window.__EGHACT_DEVTOOLS__) {
        console.warn('[Eghact DevTools] Hook already installed');
        return;
    }
    
    // Component registry for DevTools
    const componentRegistry = new Map();
    let componentIdCounter = 0;
    let updateQueue = [];
    let updateTimer = null;
    
    // Create the DevTools hook
    window.__EGHACT_DEVTOOLS__ = {
        version: '1.0.0',
        components: componentRegistry,
        
        // Called when a component is mounted
        notifyMount(component) {
            const id = `eghact-${componentIdCounter++}`;
            const componentInfo = {
                id,
                name: component.constructor.name || 'Unknown',
                props: component.props || {},
                state: component.state || {},
                parent: component.parent?.id || null,
                children: [],
                mountTime: performance.now(),
                updateCount: 0
            };
            
            componentRegistry.set(id, componentInfo);
            component.__devtools_id = id;
            
            // Update parent's children array
            if (component.parent && component.parent.__devtools_id) {
                const parent = componentRegistry.get(component.parent.__devtools_id);
                if (parent) {
                    parent.children.push(id);
                }
            }
            
            queueUpdate('mount', componentInfo);
            console.log(`[Eghact DevTools] Component mounted: ${componentInfo.name} (${id})`);
        },
        
        // Called when a component updates
        notifyUpdate(component) {
            const id = component.__devtools_id;
            if (!id) return;
            
            const componentInfo = componentRegistry.get(id);
            if (!componentInfo) return;
            
            // Update component info
            componentInfo.props = component.props || {};
            componentInfo.state = component.state || {};
            componentInfo.updateCount++;
            componentInfo.lastUpdateTime = performance.now();
            
            queueUpdate('update', componentInfo);
            console.log(`[Eghact DevTools] Component updated: ${componentInfo.name} (${id})`);
        },
        
        // Called when a component unmounts
        notifyUnmount(component) {
            const id = component.__devtools_id;
            if (!id) return;
            
            const componentInfo = componentRegistry.get(id);
            if (!componentInfo) return;
            
            // Remove from parent's children
            if (componentInfo.parent) {
                const parent = componentRegistry.get(componentInfo.parent);
                if (parent) {
                    parent.children = parent.children.filter(childId => childId !== id);
                }
            }
            
            // Remove component and all its children
            removeComponentAndChildren(id);
            
            queueUpdate('unmount', { id });
            console.log(`[Eghact DevTools] Component unmounted: ${componentInfo.name} (${id})`);
        },
        
        // Get component tree for DevTools
        getComponentTree() {
            const roots = [];
            
            componentRegistry.forEach((component, id) => {
                if (!component.parent) {
                    roots.push(buildTreeNode(id));
                }
            });
            
            return roots;
        },
        
        // Get component details
        inspectComponent(componentId) {
            const component = componentRegistry.get(componentId);
            if (!component) return null;
            
            return {
                ...component,
                renderTime: component.lastUpdateTime - component.mountTime,
                children: component.children.map(childId => 
                    componentRegistry.get(childId)?.name || 'Unknown'
                )
            };
        },
        
        // Performance metrics
        getPerformanceMetrics() {
            let totalComponents = componentRegistry.size;
            let totalUpdates = 0;
            let avgRenderTime = 0;
            let renderTimes = [];
            
            componentRegistry.forEach(component => {
                totalUpdates += component.updateCount;
                if (component.lastUpdateTime) {
                    renderTimes.push(component.lastUpdateTime - component.mountTime);
                }
            });
            
            if (renderTimes.length > 0) {
                avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
            }
            
            return {
                'Total Components': totalComponents,
                'Total Updates': totalUpdates,
                'Avg Render Time': `${avgRenderTime.toFixed(2)}ms`,
                'Memory (Approx)': `${(performance.memory?.usedJSHeapSize / 1048576).toFixed(2)}MB` || 'N/A'
            };
        }
    };
    
    // Helper function to build tree node
    function buildTreeNode(componentId) {
        const component = componentRegistry.get(componentId);
        if (!component) return null;
        
        return {
            id: componentId,
            name: component.name,
            props: component.props,
            state: component.state,
            children: component.children.map(childId => buildTreeNode(childId)).filter(Boolean)
        };
    }
    
    // Helper function to remove component and children
    function removeComponentAndChildren(componentId) {
        const component = componentRegistry.get(componentId);
        if (!component) return;
        
        // Recursively remove children
        component.children.forEach(childId => {
            removeComponentAndChildren(childId);
        });
        
        componentRegistry.delete(componentId);
    }
    
    // Queue updates to batch them
    function queueUpdate(type, data) {
        updateQueue.push({ type, data, timestamp: Date.now() });
        
        if (updateTimer) {
            clearTimeout(updateTimer);
        }
        
        updateTimer = setTimeout(flushUpdateQueue, 50);
    }
    
    // Flush update queue to DevTools
    function flushUpdateQueue() {
        if (updateQueue.length === 0) return;
        
        // Send to content script
        window.postMessage({
            source: 'eghact-runtime',
            type: 'devtools-update',
            updates: updateQueue,
            tree: window.__EGHACT_DEVTOOLS__.getComponentTree()
        }, '*');
        
        updateQueue = [];
        updateTimer = null;
    }
    
    // Listen for DevTools messages
    window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'eghact-devtools') {
            handleDevToolsMessage(event.data);
        }
    });
    
    // Handle messages from DevTools
    function handleDevToolsMessage(message) {
        switch (message.type) {
            case 'inspect':
                const details = window.__EGHACT_DEVTOOLS__.inspectComponent(message.componentId);
                window.postMessage({
                    source: 'eghact-runtime',
                    type: 'component-details',
                    component: details
                }, '*');
                break;
                
            case 'get-tree':
                window.postMessage({
                    source: 'eghact-runtime',
                    type: 'component-tree',
                    tree: window.__EGHACT_DEVTOOLS__.getComponentTree()
                }, '*');
                break;
                
            case 'get-performance':
                window.postMessage({
                    source: 'eghact-runtime',
                    type: 'performance-metrics',
                    metrics: window.__EGHACT_DEVTOOLS__.getPerformanceMetrics()
                }, '*');
                break;
        }
    }
    
    console.log('[Eghact DevTools] Runtime hook installed successfully!');
    console.log('[Eghact DevTools] Agent 3 v2.0 - Unlike my predecessor, I deliver!');
})();