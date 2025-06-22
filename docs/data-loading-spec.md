# Eghact Data Loading Specification

## Overview

Eghact provides a powerful data loading system that enables server-side rendering (SSR) and client-side hydration with automatic error handling and loading states.

## Load Function API

### Basic Usage

Route components can export a `load` function that fetches data before rendering:

```javascript
// src/routes/users/[id].egh
<template>
  <div class="user-profile">
    <h1>{user.name}</h1>
    <p>{user.email}</p>
    <div class="posts">
      {#each posts as post}
        <article>
          <h3>{post.title}</h3>
          <p>{post.content}</p>
        </article>
      {/each}
    </div>
  </div>
</template>

<script>
  export async function load({ params, fetch, url, route }) {
    const [userResponse, postsResponse] = await Promise.all([
      fetch(`/api/users/${params.id}`),
      fetch(`/api/users/${params.id}/posts`)
    ]);
    
    if (!userResponse.ok) {
      throw new Error(`User not found: ${userResponse.status}`);
    }
    
    const user = await userResponse.json();
    const posts = await postsResponse.json();
    
    return {
      user,
      posts
    };
  }
  
  // Data is automatically available as reactive variables
  $: console.log('User loaded:', user);
</script>
```

### Load Function Parameters

The `load` function receives a context object with:

- `params` - Route parameters (e.g., `{ id: '123' }` for `/users/[id]`)
- `url` - Current URL object with search params, hash, etc.
- `route` - Route metadata (pattern, name, etc.)
- `fetch` - Enhanced fetch function with automatic base URL and error handling
- `session` - User session data (if authenticated)
- `cookies` - Request cookies object
- `request` - Full request object (server-side only)

### Return Values

The `load` function can return:

1. **Data Object**: Plain object with data properties
2. **Redirect**: `{ redirect: '/login' }` for navigation
3. **Error**: `{ error: 'User not found' }` for error states
4. **Promise**: Async data loading with automatic resolution

## Server-Side Execution

### Initial Page Load

On server-side rendering:

1. Route matching determines which components need data
2. `load` functions execute in parallel for layout hierarchy
3. Data is serialized into HTML as JSON
4. Client receives pre-loaded data for instant hydration

### Data Serialization

```html
<script id="__EGHACT_DATA__" type="application/json">
{
  "/users/123": {
    "user": { "id": 123, "name": "John Doe" },
    "posts": [...],
    "timestamp": 1640995200000
  }
}
</script>
```

## Client-Side Navigation

### Progressive Enhancement

During client-side navigation:

1. Check if data is already cached and fresh
2. Show loading indicators while fetching
3. Execute `load` functions with automatic error boundaries
4. Update component state with new data
5. Cache results for future navigation

### Loading States

```javascript
// Automatic loading state injection
<template>
  {#if $loading}
    <div class="skeleton">
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </div>
  {:else if $error}
    <div class="error">
      <h2>Error Loading Data</h2>
      <p>{$error.message}</p>
      <button on:click={retry}>Retry</button>
    </div>
  {:else}
    <!-- Normal content -->
    <h1>{user.name}</h1>
  {/if}
</template>
```

## Error Handling

### Automatic Error Boundaries

Every route component is wrapped in an error boundary:

```javascript
// Automatic error boundary generation
try {
  const data = await load(context);
  component.setData(data);
} catch (error) {
  component.setError(error);
  // Optional: report to error service
  errorReporting.captureException(error);
}
```

### Custom Error Pages

Create `_error.egh` files for custom error handling:

```javascript
// src/routes/_error.egh
<template>
  <div class="error-page">
    <h1>Something went wrong</h1>
    <p>{error.message}</p>
    <button on:click={() => window.history.back()}>Go Back</button>
  </div>
</template>

<script>
  export async function load({ error, status }) {
    // Log error to service
    await fetch('/api/errors', {
      method: 'POST',
      body: JSON.stringify({ error: error.message, status })
    });
    
    return { error, status };
  }
</script>
```

## Parallel Data Loading

### Layout Hierarchy

Data loads in parallel across the layout hierarchy:

```
_layout.egh (loads user session)
└── users/
    ├── _layout.egh (loads user preferences)
    └── [id].egh (loads user profile)
```

All three `load` functions execute simultaneously, with the deepest component receiving all parent data.

### Data Dependencies

```javascript
// Parent layout data is available to children
export async function load({ params, parentData }) {
  const { session } = parentData;
  
  if (!session.user) {
    return { redirect: '/login' };
  }
  
  return {
    userPreferences: await fetch(`/api/users/${session.user.id}/preferences`)
  };
}
```

## Caching Strategy

### Client-Side Cache

- **Duration**: 5 minutes default, configurable per route
- **Invalidation**: Automatic on mutations, manual via cache API
- **Storage**: Memory + sessionStorage for persistence

### Cache Control

```javascript
export async function load({ params }) {
  return {
    data: await fetchUserData(params.id),
    cache: {
      maxAge: 300, // 5 minutes
      tags: ['user', `user:${params.id}`],
      revalidate: true // Background revalidation
    }
  };
}
```

## Request Deduplication

Identical requests during rapid navigation are automatically deduplicated:

```javascript
// Multiple rapid navigations to /users/123 will share the same request
const cache = new Map();

async function loadWithDeduplication(key, loader) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const promise = loader();
  cache.set(key, promise);
  
  try {
    const result = await promise;
    return result;
  } finally {
    cache.delete(key);
  }
}
```

## Security Considerations

### Data Sanitization

All data is automatically sanitized before serialization:

- HTML entities are escaped
- XSS protection via Content Security Policy
- Sensitive fields are filtered server-side

### Authentication

```javascript
export async function load({ session, cookies }) {
  if (!session.user) {
    return { redirect: '/login' };
  }
  
  // Only load data the user has access to
  return {
    data: await fetchAuthorizedData(session.user.id)
  };
}
```

## Performance Optimizations

### Streaming SSR

Large data sets can be streamed to the client:

```javascript
export async function load({ params }) {
  return {
    user: await fetchUser(params.id), // Critical data
    posts: fetchPosts(params.id), // Stream this
    stream: true
  };
}
```

### Preloading

Critical routes can be preloaded on hover or during idle time:

```html
<a href="/users/123" data-preload>User Profile</a>
```

This specification ensures Eghact's data loading system is both powerful and developer-friendly, with automatic optimizations that make applications fast by default.