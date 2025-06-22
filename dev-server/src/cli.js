#!/usr/bin/env node

import { startDevServer } from './index.js';

// Start the dev server when called directly
startDevServer()
  .then(({ url }) => {
    console.log(`Server started at ${url}`);
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });