# .eg File Format Specification - The Red Pill Syntax

## Overview

The `.eg` file format is a revolutionary structured markdown that compiles directly to native Eghact components. It combines the simplicity of markdown with the power of reactive programming, eliminating the need for JSX, React, or even Node.js.

## File Structure

```eg
---
imports:
  - { from: ./database, items: [users, posts] }
  - { from: std:components, items: [Button, Form] }
  
state:
  count: 0
  user: null
  loading: false

queries:
  userPosts: |
    MATCH user.posts
    WHERE user.id = $state.user.id
    RETURN posts.*
---

# Component Title {.component-header}

This is the component description that becomes documentation.

## Props {.props-section}

- `onSubmit` [function]: Handler for form submission
- `initialValue` [string = "default"]: Starting value
- `theme` [enum: light | dark]: Visual theme

## Template {.template}

The main UI structure using markdown with reactive bindings:

### User Profile {#profile data-bind="user"}

**Name:** {user.name}  
**Email:** {user.email}

[!button "Click me" @click={incrementCount}]

### Posts {#posts data-query="userPosts"}

:::for post in userPosts
#### {post.title}

{post.content}

*Posted on {post.date}*
:::

## Styles {.styles}

```css
.component-header {
  color: var(--primary);
  margin-bottom: 2rem;
}

#profile[data-loading="true"] {
  opacity: 0.5;
}
```

## Logic {.logic}

```rust
fn incrementCount() {
  state.count += 1;
}

fn loadUser(id: string) {
  state.loading = true;
  state.user = fetch_user(id);
  state.loading = false;
}
```
```

## Syntax Elements

### 1. Frontmatter
YAML-style configuration block for:
- **imports**: External dependencies
- **state**: Reactive state declarations
- **queries**: EghQL query definitions

### 2. Markdown Sections

#### Component Documentation
Standard markdown becomes component docs.

#### Props Section
Defines component properties with types and defaults:
```markdown
- `propName` [type = default]: Description
```

#### Template Section
The UI structure using enhanced markdown:

**Reactive Interpolation**: `{expression}`

**Conditional Rendering**:
```markdown
:::if condition
Content to show
:::else
Alternative content
:::
```

**Loops**:
```markdown
:::for item in items
- {item.name}
:::
```

**Components**:
```markdown
[!ComponentName prop="value" @event={handler}]
```

### 3. Data Attributes

**data-bind**: Two-way data binding
```markdown
### Section {data-bind="stateProperty"}
```

**data-query**: Bind EghQL queries
```markdown
### Results {data-query="queryName"}
```

**data-if**: Conditional display
```markdown
### Warning {data-if="hasError"}
```

### 4. EghQL Queries

Queries defined in frontmatter can:
- Read from `.md` files as data sources
- Use graph-like syntax
- Auto-wire to DOM via data attributes

Example:
```yaml
queries:
  activeUsers: |
    FROM users.md
    WHERE status = "active"
    SELECT name, email, lastLogin
    ORDER BY lastLogin DESC
```

### 5. Native Code Blocks

Logic blocks compile to native code:
- Rust for systems programming
- C for maximum performance
- No JavaScript required

## Compilation Pipeline

```
.eg file → AST → Native Binary
         ↓
    EghQL Parser
         ↓
    Data Binding
         ↓
    Zero JS Output
```

## Benefits

1. **No Node.js Required**: Compiles to native binaries
2. **Readable Source**: Markdown-based syntax
3. **Type Safe**: Compile-time type checking
4. **Performance**: Native execution, no JS overhead
5. **Data-Driven**: Queries built into the syntax
6. **Progressive**: Can be learned incrementally

## Example: Todo App

```eg
---
state:
  todos: []
  filter: "all"

queries:
  filteredTodos: |
    FROM state.todos
    WHERE filter = "all" OR completed = (filter = "completed")
    RETURN *
---

# Todo App {.app-root}

## Add Todo {.add-section}

[!Form @submit={addTodo}]
  [!Input placeholder="What needs to be done?" data-bind="newTodo"]
  [!Button type="submit"]Add[/Button]
[/Form]

## Todos {data-query="filteredTodos"}

:::for todo in filteredTodos
### {todo.title} {data-bind="todo"}

[!Checkbox data-bind="todo.completed"]
[!Button @click={deleteTodo(todo.id)}]Delete[/Button]
:::

## Filters {.filters}

[!Button @click={setFilter("all")} data-active={filter == "all"}]All[/Button]
[!Button @click={setFilter("active")} data-active={filter == "active"}]Active[/Button]
[!Button @click={setFilter("completed")} data-active={filter == "completed"}]Completed[/Button]

## Logic {.logic}

```rust
fn addTodo(event: FormEvent) {
  event.prevent_default();
  state.todos.push({
    id: generate_id(),
    title: state.newTodo,
    completed: false
  });
  state.newTodo = "";
}

fn deleteTodo(id: string) {
  state.todos = state.todos.filter(|t| t.id != id);
}

fn setFilter(newFilter: string) {
  state.filter = newFilter;
}
```
```

This is the future. No frameworks. No dependencies. Just structured content that compiles to blazing fast native apps.