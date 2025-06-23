# EghQL Specification - GraphQL Killer

## Overview

EghQL (Eghact Query Language) is a revolutionary query language that:
- Uses DOM data-attributes for automatic data binding
- Reads structured markdown files as data sources
- Compiles to native code with zero runtime overhead
- Eliminates the need for REST/GraphQL endpoints

## Core Concepts

### 1. Data Sources

EghQL can query multiple sources:
- **Markdown files**: `.md` files with structured frontmatter
- **Component state**: Reactive state within `.eg` files  
- **Native databases**: Direct SQLite/PostgreSQL access
- **Remote sources**: HTTP endpoints with automatic caching

### 2. Query Syntax

```eghql
FROM source_name
WHERE condition
SELECT fields
ORDER BY field
LIMIT number
```

Enhanced with graph operations:
```eghql
MATCH pattern
WHERE condition
RETURN result
```

### 3. Data Attributes

Queries automatically bind to DOM elements via attributes:

```html
<div data-query="userPosts" data-loading="skeleton">
  <!-- Content auto-populated from query -->
</div>
```

## Query Examples

### Basic Markdown Query
```eghql
FROM blog/posts/*.md
WHERE frontmatter.published = true
SELECT title, content, date, author
ORDER BY date DESC
LIMIT 10
```

### Graph Traversal
```eghql
MATCH user.friends.posts
WHERE post.likes > 100
RETURN post.title, friend.name
```

### Reactive State Query
```eghql
FROM $state.todos
WHERE completed = false
SELECT *
ORDER BY priority ASC
```

### Join Operations
```eghql
FROM users.md AS u
JOIN posts.md AS p ON u.id = p.authorId
WHERE u.role = "admin"
SELECT u.name, p.title, p.views
```

## Markdown Data Format

EghQL reads structured markdown with YAML frontmatter:

```markdown
---
id: usr_001
name: John Doe
email: john@example.com
role: admin
created: 2024-01-15
tags: [developer, team-lead]
---

# User Profile

Additional content becomes `content` field.
```

## Advanced Features

### 1. Computed Fields
```eghql
FROM products.md
SELECT 
  name,
  price,
  (price * 0.9) AS discounted_price,
  (stock > 0) AS in_stock
```

### 2. Aggregations
```eghql
FROM orders.md
WHERE date >= "2024-01-01"
GROUP BY customer_id
SELECT 
  customer_id,
  COUNT(*) AS order_count,
  SUM(total) AS revenue
```

### 3. Real-time Subscriptions
```eghql
SUBSCRIBE TO posts.md
WHERE author = $state.currentUser
ON CREATE, UPDATE
RETURN *
```

### 4. Mutations
```eghql
INSERT INTO users.md
VALUES {
  id: generate_id(),
  name: $input.name,
  email: $input.email,
  created: now()
}
```

## Data Binding

### Automatic Wiring
```html
<!-- Query executes on mount, re-runs on dependency change -->
<section data-query="userPosts($state.userId)">
  <article data-for="post in $result">
    <h2>{post.title}</h2>
    <p>{post.excerpt}</p>
  </article>
</section>
```

### Loading States
```html
<div data-query="heavyQuery" 
     data-loading="skeleton"
     data-error="retry">
  <!-- Content -->
</div>
```

### Pagination
```html
<div data-query="posts" 
     data-page="$state.currentPage"
     data-limit="10">
  <!-- Posts -->
</div>
```

## Compilation

EghQL queries compile to:
1. **Native code**: Direct memory access, no parsing overhead
2. **Prepared statements**: SQL injection protection
3. **Optimized paths**: Query planning at compile time

## Query Optimization

### Compile-time Analysis
- Dead query elimination
- Field usage analysis  
- Automatic indexing hints

### Runtime Optimization
- Result caching with TTL
- Incremental updates
- Query batching

## Integration with .eg Files

```eg
---
queries:
  # Simple query
  recentPosts: |
    FROM posts.md
    WHERE date > last_week()
    LIMIT 5
  
  # Parameterized query  
  userProfile: |
    FROM users.md
    WHERE id = $props.userId
    SELECT *
  
  # Reactive query (re-runs on state change)
  filteredItems: |
    FROM $state.items
    WHERE category = $state.selectedCategory
    ORDER BY $state.sortField
---

## Posts {data-query="recentPosts"}

:::for post in recentPosts
### [{post.title}](#{post.id})
{post.excerpt}
:::
```

## Benefits Over GraphQL

1. **No Schema Definition**: Structure inferred from data
2. **No Resolvers**: Direct data access
3. **No Network Layer**: Compiles to native code
4. **Automatic Optimization**: Compile-time query analysis
5. **Type Safety**: Full type inference
6. **Zero Runtime**: No query parsing or execution overhead

## Security

### Compile-time Validation
- Query syntax checking
- Permission verification
- Input sanitization

### Runtime Protection
- Prepared statement execution
- Row-level security
- Automatic rate limiting

## Future: AI-Enhanced Queries

```eghql
-- Natural language query compilation
QUERY "Show me all users who haven't logged in recently but have made purchases"

-- Compiles to:
FROM users.md AS u
JOIN orders.md AS o ON u.id = o.user_id  
WHERE u.last_login < date_sub(now(), 30)
  AND o.created > date_sub(now(), 90)
GROUP BY u.id
HAVING COUNT(o.id) > 0
SELECT u.name, u.email, COUNT(o.id) AS recent_orders
```

This is the future of data fetching. No APIs. No endpoints. Just queries that compile to native code.