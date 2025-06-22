// Eghact Testing Framework - Main Entry Point
import { render, cleanup, fireEvent, waitFor, screen } from './eghact-test-utils.js';
import { createMockComponent, mockProps, mockEvents } from './mocking.js';
import { setupVisualTesting, takeSnapshot } from './visual-regression.js';
import '@testing-library/jest-dom';

// Re-export everything for convenience
export {
  // Core testing utilities
  render,
  cleanup,
  fireEvent,
  waitFor,
  screen,
  
  // Mocking utilities
  createMockComponent,
  mockProps,
  mockEvents,
  
  // Visual regression
  setupVisualTesting,
  takeSnapshot,
  
  // Query utilities from testing-library
  getByRole,
  getByLabelText,
  getByPlaceholderText,
  getByText,
  getByDisplayValue,
  getByAltText,
  getByTitle,
  getByTestId,
  queryByRole,
  queryByLabelText,
  queryByPlaceholderText,
  queryByText,
  queryByDisplayValue,
  queryByAltText,
  queryByTitle,
  queryByTestId,
  findByRole,
  findByLabelText,
  findByPlaceholderText,
  findByText,
  findByDisplayValue,
  findByAltText,
  findByTitle,
  findByTestId
} from '@testing-library/dom';

// Custom matchers for Eghact components
export { toHaveEghactProp, toHaveSignal, toBeReactive } from './matchers.js';

// Test environment setup
export { setupEghactEnvironment, teardownEghactEnvironment } from './environment.js';

// Component testing helpers
export { mount, shallow, debug } from './component-helpers.js';

// Default export for easy importing
export default {
  render,
  cleanup,
  fireEvent,
  waitFor,
  screen,
  createMockComponent,
  mockProps,
  mockEvents,
  setupVisualTesting,
  takeSnapshot
};