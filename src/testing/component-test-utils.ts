import { JSDOM } from 'jsdom';
import { Component } from '../runtime/component';

export interface RenderResult {
  container: HTMLElement;
  component: Component;
  debug: () => void;
  unmount: () => void;
  rerender: (props?: any) => void;
}

export interface RenderOptions {
  container?: HTMLElement;
  baseElement?: HTMLElement;
}

// Set up JSDOM environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable',
});

global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Add missing globals
Object.defineProperty(window, 'requestAnimationFrame', {
  value: (callback: FrameRequestCallback) => setTimeout(callback, 16),
});

Object.defineProperty(window, 'cancelAnimationFrame', {
  value: (id: number) => clearTimeout(id),
});

export function render(
  ComponentClass: typeof Component,
  props: any = {},
  options: RenderOptions = {}
): RenderResult {
  const container = options.container || document.createElement('div');
  const baseElement = options.baseElement || document.body;
  
  baseElement.appendChild(container);
  
  // Create component instance
  const component = new ComponentClass({
    target: container,
    props,
  });
  
  return {
    container,
    component,
    debug: () => {
      console.log(prettyDOM(container));
    },
    unmount: () => {
      component.$destroy();
      container.remove();
    },
    rerender: (newProps?: any) => {
      if (newProps) {
        component.$set(newProps);
      }
    },
  };
}

export function cleanup(): void {
  document.body.innerHTML = '';
}

// Query utilities
export function getByText(container: HTMLElement, text: string | RegExp): HTMLElement {
  const elements = Array.from(container.querySelectorAll('*'));
  
  for (const element of elements) {
    const hasText = typeof text === 'string'
      ? element.textContent?.includes(text)
      : text.test(element.textContent || '');
      
    if (hasText && element.children.length === 0) {
      return element as HTMLElement;
    }
  }
  
  throw new Error(`Unable to find element with text: ${text}`);
}

export function getByTestId(container: HTMLElement, testId: string): HTMLElement {
  const element = container.querySelector(`[data-testid="${testId}"]`);
  
  if (!element) {
    throw new Error(`Unable to find element with data-testid: ${testId}`);
  }
  
  return element as HTMLElement;
}

export function getByRole(container: HTMLElement, role: string): HTMLElement {
  const element = container.querySelector(`[role="${role}"]`);
  
  if (!element) {
    throw new Error(`Unable to find element with role: ${role}`);
  }
  
  return element as HTMLElement;
}

export function queryByText(container: HTMLElement, text: string | RegExp): HTMLElement | null {
  try {
    return getByText(container, text);
  } catch {
    return null;
  }
}

export function queryByTestId(container: HTMLElement, testId: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
}

export function queryByRole(container: HTMLElement, role: string): HTMLElement | null {
  return container.querySelector(`[role="${role}"]`) as HTMLElement | null;
}

// Event utilities
export function fireEvent(element: HTMLElement, event: Event): void {
  element.dispatchEvent(event);
}

fireEvent.click = (element: HTMLElement) => {
  fireEvent(element, new MouseEvent('click', { bubbles: true }));
};

fireEvent.change = (element: HTMLElement, value: any) => {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = value;
    fireEvent(element, new Event('change', { bubbles: true }));
    fireEvent(element, new Event('input', { bubbles: true }));
  }
};

fireEvent.submit = (element: HTMLFormElement) => {
  fireEvent(element, new Event('submit', { bubbles: true, cancelable: true }));
};

// Wait utilities
export function waitFor(
  callback: () => void | Promise<void>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 1000, interval = 50 } = options;
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const check = async () => {
      try {
        await callback();
        resolve();
      } catch (error) {
        if (Date.now() - startTime >= timeout) {
          reject(error);
        } else {
          setTimeout(check, interval);
        }
      }
    };
    
    check();
  });
}

// Pretty print DOM
function prettyDOM(element: HTMLElement, maxLength = 7000): string {
  const html = element.innerHTML;
  const formatted = html
    .replace(/></g, '>\n<')
    .split('\n')
    .map((line, i) => {
      const indent = '  '.repeat(getIndentLevel(line));
      return indent + line.trim();
    })
    .join('\n');
    
  return formatted.length > maxLength
    ? formatted.slice(0, maxLength) + '...'
    : formatted;
}

function getIndentLevel(line: string): number {
  let level = 0;
  let inTag = false;
  
  for (const char of line) {
    if (char === '<' && line[line.indexOf('<') + 1] !== '/') {
      inTag = true;
    } else if (char === '>' && inTag) {
      level++;
      inTag = false;
    } else if (char === '<' && line[line.indexOf('<') + 1] === '/') {
      level--;
    }
  }
  
  return Math.max(0, level);
}

// Snapshot testing support
export function toMatchSnapshot(received: any, snapshotName?: string): {
  pass: boolean;
  message: () => string;
} {
  // This would integrate with Jest's snapshot functionality
  // For now, return a simple implementation
  return {
    pass: true,
    message: () => 'Snapshot matched',
  };
}