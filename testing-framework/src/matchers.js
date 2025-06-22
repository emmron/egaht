// Custom Jest matchers for Eghact components
import { prettyFormat } from 'pretty-format';

/**
 * Check if a component has a specific prop
 */
export function toHaveEghactProp(component, propName, expectedValue) {
  const props = component.props || component._props || {};
  const hasProp = propName in props;
  const actualValue = props[propName];
  
  if (arguments.length === 2) {
    // Just checking if prop exists
    return {
      pass: hasProp,
      message: () => hasProp
        ? `Expected component not to have prop "${propName}"`
        : `Expected component to have prop "${propName}"`
    };
  } else {
    // Checking prop value
    const valuesMatch = this.equals(actualValue, expectedValue);
    
    return {
      pass: hasProp && valuesMatch,
      message: () => {
        if (!hasProp) {
          return `Expected component to have prop "${propName}" with value ${prettyFormat(expectedValue)}, but prop was not found`;
        }
        if (!valuesMatch) {
          return `Expected component prop "${propName}" to have value ${prettyFormat(expectedValue)}, but received ${prettyFormat(actualValue)}`;
        }
        return `Expected component not to have prop "${propName}" with value ${prettyFormat(expectedValue)}`;
      }
    };
  }
}

/**
 * Check if a component has a signal with specific value
 */
export function toHaveSignal(component, signalName, expectedValue) {
  const signals = component.signals || component._signals || {};
  const hasSignal = signalName in signals;
  
  if (!hasSignal) {
    return {
      pass: false,
      message: () => `Expected component to have signal "${signalName}", but it was not found`
    };
  }
  
  const signal = signals[signalName];
  const actualValue = typeof signal === 'object' && 'value' in signal
    ? signal.value
    : signal;
  
  if (arguments.length === 2) {
    // Just checking if signal exists
    return {
      pass: true,
      message: () => `Expected component not to have signal "${signalName}"`
    };
  } else {
    // Checking signal value
    const valuesMatch = this.equals(actualValue, expectedValue);
    
    return {
      pass: valuesMatch,
      message: () => valuesMatch
        ? `Expected component signal "${signalName}" not to have value ${prettyFormat(expectedValue)}`
        : `Expected component signal "${signalName}" to have value ${prettyFormat(expectedValue)}, but received ${prettyFormat(actualValue)}`
    };
  }
}

/**
 * Check if a value is reactive (has signal behavior)
 */
export function toBeReactive(received) {
  const isReactive = 
    received !== null &&
    typeof received === 'object' &&
    ('value' in received || 'subscribe' in received || '_isSignal' in received);
  
  return {
    pass: isReactive,
    message: () => isReactive
      ? `Expected value not to be reactive, but it has reactive properties`
      : `Expected value to be reactive (have signal behavior), but received ${prettyFormat(received)}`
  };
}

/**
 * Check if component is mounted
 */
export function toBeMounted(component) {
  const isMounted = 
    component._isMounted === true ||
    component.mounted === true ||
    (component._element && document.body.contains(component._element));
  
  return {
    pass: isMounted,
    message: () => isMounted
      ? `Expected component not to be mounted`
      : `Expected component to be mounted`
  };
}

/**
 * Check if component has specific lifecycle method
 */
export function toHaveLifecycleMethod(component, methodName) {
  const hasMethod = typeof component[methodName] === 'function';
  
  return {
    pass: hasMethod,
    message: () => hasMethod
      ? `Expected component not to have lifecycle method "${methodName}"`
      : `Expected component to have lifecycle method "${methodName}"`
  };
}

/**
 * Check if component emits specific event
 */
export function toEmitEvent(component, eventName, expectedDetail) {
  const events = component._emittedEvents || [];
  const matchingEvents = events.filter(e => e.type === eventName);
  
  if (matchingEvents.length === 0) {
    return {
      pass: false,
      message: () => `Expected component to emit "${eventName}" event, but it was not emitted`
    };
  }
  
  if (arguments.length === 2) {
    // Just checking if event was emitted
    return {
      pass: true,
      message: () => `Expected component not to emit "${eventName}" event`
    };
  } else {
    // Checking event detail
    const matchingDetail = matchingEvents.find(e => 
      this.equals(e.detail, expectedDetail)
    );
    
    return {
      pass: !!matchingDetail,
      message: () => matchingDetail
        ? `Expected component not to emit "${eventName}" event with detail ${prettyFormat(expectedDetail)}`
        : `Expected component to emit "${eventName}" event with detail ${prettyFormat(expectedDetail)}, but received ${prettyFormat(matchingEvents.map(e => e.detail))}`
    };
  }
}

/**
 * Check component render output
 */
export function toRenderElement(component, expectedElement) {
  const rendered = component.render ? component.render() : component;
  
  if (typeof expectedElement === 'string') {
    // Check if renders specific tag
    const tagName = rendered.tagName?.toLowerCase() || 
                   rendered.nodeName?.toLowerCase() ||
                   (typeof rendered === 'string' && rendered.match(/<(\w+)/)?.[1]);
    
    return {
      pass: tagName === expectedElement.toLowerCase(),
      message: () => tagName === expectedElement.toLowerCase()
        ? `Expected component not to render <${expectedElement}> element`
        : `Expected component to render <${expectedElement}> element, but rendered <${tagName}>`
    };
  } else {
    // Deep equality check
    const elementsMatch = this.equals(rendered, expectedElement);
    
    return {
      pass: elementsMatch,
      message: () => elementsMatch
        ? `Expected component not to render ${prettyFormat(expectedElement)}`
        : `Expected component to render ${prettyFormat(expectedElement)}, but rendered ${prettyFormat(rendered)}`
    };
  }
}

// Register matchers with Jest
if (typeof expect !== 'undefined' && expect.extend) {
  expect.extend({
    toHaveEghactProp,
    toHaveSignal,
    toBeReactive,
    toBeMounted,
    toHaveLifecycleMethod,
    toEmitEvent,
    toRenderElement
  });
}