// Act compatibility layer for Eghact testing
// Ensures all state updates and effects are flushed synchronously

let actScope = null;
let actQueue = [];

export function act(callback) {
  // If already in act scope, just execute
  if (actScope) {
    return callback();
  }

  // Start new act scope
  const prevActScope = actScope;
  actScope = {
    batchedUpdates: [],
    effects: []
  };

  let result;
  let error;
  
  try {
    // Execute callback
    result = callback();
    
    // Handle promises
    if (result && typeof result.then === 'function') {
      return result.then(
        resolvedValue => {
          flushActScope();
          actScope = prevActScope;
          return resolvedValue;
        },
        rejectedValue => {
          flushActScope();
          actScope = prevActScope;
          throw rejectedValue;
        }
      );
    }
    
    // Flush synchronously for non-promises
    flushActScope();
  } catch (e) {
    error = e;
  } finally {
    actScope = prevActScope;
  }
  
  if (error) {
    throw error;
  }
  
  return result;
}

function flushActScope() {
  if (!actScope) return;
  
  // Flush all batched updates
  while (actScope.batchedUpdates.length > 0) {
    const update = actScope.batchedUpdates.shift();
    update();
  }
  
  // Flush all effects
  while (actScope.effects.length > 0) {
    const effect = actScope.effects.shift();
    effect();
  }
  
  // Process any microtasks
  if (typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      Promise.resolve().then(() => {
        resolve();
      });
    });
  }
}

// Hook for Eghact runtime to register updates
export function scheduleUpdate(updateFn) {
  if (actScope) {
    actScope.batchedUpdates.push(updateFn);
  } else {
    // Outside act, execute immediately
    updateFn();
  }
}

// Hook for Eghact runtime to register effects
export function scheduleEffect(effectFn) {
  if (actScope) {
    actScope.effects.push(effectFn);
  } else {
    // Outside act, execute immediately
    effectFn();
  }
}

// Check if we're in an act scope
export function isInActScope() {
  return actScope !== null;
}

// Export for runtime integration
if (typeof window !== 'undefined') {
  window.__EGHACT_ACT__ = {
    act,
    scheduleUpdate,
    scheduleEffect,
    isInActScope
  };
}