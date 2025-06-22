# Component Testing Guide

## Overview

Eghact provides a comprehensive testing framework specifically designed for `.egh` components, offering unit testing, integration testing, and visual regression testing capabilities.

## Features

- **Component Mounting**: Render components in isolated test environments
- **Jest Integration**: Built on top of Jest with custom matchers
- **JSDOM Environment**: Simulated DOM for server-side testing
- **Event Simulation**: Trigger user interactions and test responses
- **Visual Regression**: Screenshot comparison testing with Playwright
- **Mocking Utilities**: Mock stores, APIs, and external dependencies
- **TypeScript Support**: Full type safety in test files

## Installation

```bash
# Install testing dependencies
npm install --save-dev @eghact/testing jest @types/jest
npm install --save-dev @playwright/test # For visual regression tests

# Add to package.json scripts
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:visual": "playwright test"
  }
}
```

## Configuration

### Jest Configuration

**jest.config.js:**
```javascript
module.exports = {
  preset: '@eghact/testing',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  transform: {
    '^.+\\.egh$': '@eghact/testing/transform',
    '^.+\\.ts$': 'ts-jest'
  },
  moduleFileExtensions: ['js', 'ts', 'egh'],
  testMatch: [
    '**/__tests__/**/*.(test|spec).(js|ts)',
    '**/*.(test|spec).(js|ts)'
  ]
};
```

### Test Setup

**src/test-setup.ts:**
```typescript
import '@eghact/testing/matchers';

// Global test configuration
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock fetch for API tests
global.fetch = jest.fn();
```

## Basic Component Testing

### Simple Component Test

**Button.egh:**
```typescript
<template>
  <button 
    class={`btn ${variant}`} 
    @click={handleClick}
    disabled={disabled}
  >
    <slot />
  </button>
</template>

<script lang="ts">
  export let variant: 'primary' | 'secondary' = 'primary';
  export let disabled: boolean = false;
  
  const dispatch = createEventDispatcher<{
    click: MouseEvent;
  }>();
  
  function handleClick(event: MouseEvent) {
    if (!disabled) {
      dispatch('click', event);
    }
  }
</script>
```

**Button.test.ts:**
```typescript
import { render, fireEvent, screen } from '@eghact/testing';
import Button from './Button.egh';

describe('Button', () => {
  test('renders with default props', () => {
    render(Button, { props: { children: 'Click me' } });
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Click me');
    expect(button).toHaveClass('btn', 'primary');
  });

  test('applies variant class correctly', () => {
    render(Button, { 
      props: { 
        variant: 'secondary',
        children: 'Secondary Button' 
      }
    });
    
    expect(screen.getByRole('button')).toHaveClass('btn', 'secondary');
  });

  test('handles click events', async () => {
    const handleClick = jest.fn();
    render(Button, {
      props: { children: 'Click me' },
      on: { click: handleClick }
    });
    
    await fireEvent.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'click'
      })
    );
  });

  test('does not trigger click when disabled', async () => {
    const handleClick = jest.fn();
    render(Button, {
      props: { 
        disabled: true,
        children: 'Disabled Button'
      },
      on: { click: handleClick }
    });
    
    await fireEvent.click(screen.getByRole('button'));
    
    expect(handleClick).not.toHaveBeenCalled();
  });
});
```

## Advanced Testing Patterns

### Testing with Stores

**Counter.egh:**
```typescript
<template>
  <div>
    <span data-testid="count">{$count}</span>
    <button @click={increment}>+</button>
    <button @click={decrement}>-</button>
  </div>
</template>

<script lang="ts">
  import { countStore } from './stores';
  
  const count = countStore;
  
  function increment() {
    count.update(n => n + 1);
  }
  
  function decrement() {
    count.update(n => n - 1);
  }
</script>
```

**Counter.test.ts:**
```typescript
import { render, fireEvent, screen } from '@eghact/testing';
import { countStore } from './stores';
import Counter from './Counter.egh';

describe('Counter', () => {
  beforeEach(() => {
    // Reset store before each test
    countStore.set(0);
  });

  test('displays current count', () => {
    countStore.set(5);
    render(Counter);
    
    expect(screen.getByTestId('count')).toHaveTextContent('5');
  });

  test('increments count on button click', async () => {
    render(Counter);
    
    await fireEvent.click(screen.getByText('+'));
    
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  test('decrements count on button click', async () => {
    countStore.set(5);
    render(Counter);
    
    await fireEvent.click(screen.getByText('-'));
    
    expect(screen.getByTestId('count')).toHaveTextContent('4');
  });
});
```

### Testing Async Components

**UserProfile.egh:**
```typescript
<template>
  {#if loading}
    <div data-testid="loading">Loading...</div>
  {:else if error}
    <div data-testid="error">{error.message}</div>
  {:else if user}
    <div data-testid="user-profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  {/if}
</template>

<script lang="ts">
  import { onMount } from '@eghact/runtime';
  
  export let userId: string;
  
  let user = null;
  let loading = true;
  let error = null;
  
  onMount(async () => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch user');
      user = await response.json();
    } catch (e) {
      error = e;
    } finally {
      loading = false;
    }
  });
</script>
```

**UserProfile.test.ts:**
```typescript
import { render, screen, waitFor } from '@eghact/testing';
import UserProfile from './UserProfile.egh';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('UserProfile', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('shows loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(UserProfile, { props: { userId: '123' } });
    
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  test('displays user data after successful fetch', async () => {
    const userData = { name: 'John Doe', email: 'john@example.com' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(userData)
    });
    
    render(UserProfile, { props: { userId: '123' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('user-profile')).toBeInTheDocument();
    });
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/users/123');
  });

  test('displays error message on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    render(UserProfile, { props: { userId: '123' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});
```

## Custom Matchers

Eghact testing provides custom Jest matchers for common assertions:

```typescript
// DOM matchers
expect(element).toBeInTheDocument();
expect(element).toHaveClass('active');
expect(element).toHaveAttribute('data-testid', 'button');
expect(element).toHaveTextContent('Hello World');

// Component-specific matchers
expect(component).toHaveProps({ title: 'Test', active: true });
expect(component).toHaveState({ count: 5, loading: false });
expect(component).toEmitEvent('click');

// Store matchers
expect(store).toHaveValue(42);
expect(store).toHaveBeenUpdated();
```

## Integration Testing

### Testing Component Interactions

**TodoList.test.ts:**
```typescript
import { render, fireEvent, screen, within } from '@eghact/testing';
import TodoList from './TodoList.egh';

describe('TodoList Integration', () => {
  test('complete todo workflow', async () => {
    render(TodoList);
    
    // Add a new todo
    const input = screen.getByPlaceholderText('Enter todo...');
    const addButton = screen.getByText('Add');
    
    await fireEvent.type(input, 'Buy groceries');
    await fireEvent.click(addButton);
    
    // Verify todo was added
    const todoItem = screen.getByText('Buy groceries');
    expect(todoItem).toBeInTheDocument();
    
    // Mark todo as complete
    const checkbox = screen.getByRole('checkbox');
    await fireEvent.click(checkbox);
    
    // Verify todo is marked complete
    expect(checkbox).toBeChecked();
    expect(todoItem).toHaveClass('completed');
    
    // Delete todo
    const deleteButton = screen.getByText('Delete');
    await fireEvent.click(deleteButton);
    
    // Verify todo is removed
    expect(todoItem).not.toBeInTheDocument();
  });
});
```

### Testing Router Navigation

```typescript
import { render, fireEvent, screen } from '@eghact/testing';
import { router } from '@eghact/router';
import App from './App.egh';

describe('Router Integration', () => {
  test('navigates between pages', async () => {
    render(App);
    
    // Start on home page
    expect(screen.getByText('Welcome to Home')).toBeInTheDocument();
    
    // Navigate to about page
    await fireEvent.click(screen.getByText('About'));
    
    expect(screen.getByText('About Us')).toBeInTheDocument();
    expect(router.currentRoute()).toBe('/about');
  });
});
```

## Visual Regression Testing

### Setup Playwright

**playwright.config.ts:**
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Visual Tests

**tests/visual/components.spec.ts:**
```typescript
import { test, expect } from '@playwright/test';

test.describe('Component Visual Tests', () => {
  test('Button variants', async ({ page }) => {
    await page.goto('/storybook/button');
    
    // Test different button variants
    const primaryButton = page.locator('[data-variant="primary"]');
    const secondaryButton = page.locator('[data-variant="secondary"]');
    
    await expect(primaryButton).toHaveScreenshot('button-primary.png');
    await expect(secondaryButton).toHaveScreenshot('button-secondary.png');
  });

  test('Form validation states', async ({ page }) => {
    await page.goto('/storybook/form');
    
    // Test error state
    await page.fill('[data-testid="email"]', 'invalid-email');
    await page.click('[data-testid="submit"]');
    
    await expect(page).toHaveScreenshot('form-validation-error.png');
  });
});
```

## Mocking and Utilities

### Mock API Responses

```typescript
import { createMockServer } from '@eghact/testing/mocks';

const mockServer = createMockServer();

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

test('handles API error', async () => {
  mockServer.use(
    rest.get('/api/users/:id', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ error: 'Server error' }));
    })
  );
  
  render(UserProfile, { props: { userId: '123' } });
  
  await waitFor(() => {
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });
});
```

### Mock Stores

```typescript
import { createMockStore } from '@eghact/testing/mocks';

test('component with mocked store', () => {
  const mockUserStore = createMockStore({
    name: 'Test User',
    email: 'test@example.com'
  });
  
  render(UserComponent, {
    context: new Map([['userStore', mockUserStore]])
  });
  
  expect(screen.getByText('Test User')).toBeInTheDocument();
});
```

## Performance Testing

### Component Render Performance

```typescript
import { renderBenchmark } from '@eghact/testing/performance';

test('component renders within performance budget', async () => {
  const result = await renderBenchmark(
    () => render(ComplexComponent, { 
      props: { items: generateLargeDataset(1000) }
    }),
    { iterations: 10 }
  );
  
  expect(result.averageTime).toBeLessThan(16); // 60fps budget
  expect(result.maxTime).toBeLessThan(50);
});
```

## Best Practices

### Test Organization

```
src/
  components/
    Button/
      Button.egh
      Button.test.ts
      Button.stories.ts
    UserProfile/
      UserProfile.egh
      UserProfile.test.ts
      UserProfile.integration.test.ts
  __tests__/
    integration/
    utils/
    setup.ts
```

### Testing Guidelines

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how it does it
2. **Use Descriptive Test Names**: Clearly describe what scenario is being tested
3. **Arrange-Act-Assert**: Structure tests with clear setup, action, and verification phases
4. **Mock External Dependencies**: Keep unit tests isolated and fast
5. **Test Edge Cases**: Include error states, empty data, and boundary conditions
6. **Keep Tests Simple**: One assertion per test when possible
7. **Use Data Test IDs**: Prefer `data-testid` over CSS selectors for element queries

### Common Patterns

```typescript
// Good: Testing behavior
test('shows error message when login fails', async () => {
  mockApi.post('/login').mockRejectedValue(new Error('Invalid credentials'));
  
  render(LoginForm);
  await fireEvent.click(screen.getByText('Login'));
  
  expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
});

// Avoid: Testing implementation details
test('sets error state to true', () => {
  const component = new LoginForm();
  component.handleLoginError();
  
  expect(component.state.error).toBe(true);
});
```

## Debugging Tests

### Test Debugging

```typescript
import { screen, debug } from '@eghact/testing';

test('debug test output', () => {
  render(MyComponent);
  
  // Print current DOM structure
  debug();
  
  // Print specific element
  debug(screen.getByTestId('my-element'));
  
  // Use queries to find elements
  screen.logTestingPlaygroundURL(); // Opens testing playground
});
```

### VS Code Integration

Add launch configuration for debugging:

**.vscode/launch.json:**
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Jest Tests",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache", "--watchAll=false"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```