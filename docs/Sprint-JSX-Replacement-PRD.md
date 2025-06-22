# Sprint 0.5: JSX Replacement Syntax Finalization
## Core Syntax Agent Priority Sprint

### Executive Summary

The Eghact Framework is at a critical juncture where the final component syntax must be locked down before production build implementation. This sprint focuses on finalizing the JSX replacement syntax that has been designed but needs immediate implementation and validation.

### Current Syntax Status

**Existing Foundation**:
- ✅ Basic .egh file structure with `<template>`, `<script>`, `<style>` sections
- ✅ Component parser infrastructure in compiler/src/parser.rs
- ✅ Template parser foundation in compiler/src/template_parser.rs
- 🔄 Syntax specification documented in docs/egh-syntax-spec.md (needs finalization)

**Critical Gaps**:
- ❌ Template interpolation syntax not finalized
- ❌ Reactive statements ($:) implementation incomplete
- ❌ Event handlers (@click) syntax not standardized
- ❌ Conditional rendering ({#if}) not implemented
- ❌ Loop syntax ({#each}) not implemented
- ❌ Component composition and slot system incomplete

### Sprint Objectives

#### Sprint 0.5: JSX Replacement Syntax (URGENT)
**Duration**: 1-2 sessions (BLOCKING OTHER WORK)
**Primary Goal**: Finalize and implement core syntax before production build

**IMMEDIATE DELIVERABLES**:

1. **Template Interpolation System**
   - Finalize `{variable}` vs `{{variable}}` syntax choice
   - Implement expression evaluation within interpolations
   - Support for method calls `{user.getName()}`
   - Safe HTML escaping by default, `{@html content}` for raw HTML

2. **Reactive Statements Implementation**
   - Complete `$: derivedValue = baseValue * 2` syntax
   - Implement dependency tracking and auto-execution
   - Integration with signals-based reactivity system
   - Debug reactive statement chains

3. **Event Handler Standardization**
   - Lock down `@click` vs `on:click` vs `onclick` choice
   - Implement event modifier system: `@click.prevent`, `@click.stop`
   - Support inline handlers and function references
   - Custom event handling for components

4. **Control Flow Structures**
   - Implement `{#if condition}...{:else}...{/if}` blocks
   - Add `{#each items as item}...{/each}` loops
   - Support `{#each items as item, index}` with index
   - Key-based reconciliation for efficient updates

5. **Component Composition**
   - Finalize component import/usage syntax
   - Implement `<slot>` and named slots system
   - Component prop passing and validation
   - Nested component rendering

6. **Production Syntax Validation**
   - Complete syntax parser for all features
   - AST generation for production compiler
   - Error handling and developer feedback
   - Syntax highlighting preparation

### Syntax Design Decisions (MUST BE FINALIZED)

#### Template Interpolation
```egh
<template>
  <!-- Single braces for expressions -->
  <h1>{title}</h1>
  <p>{user.name} has {posts.length} posts</p>
  
  <!-- Raw HTML insertion -->
  <div>{@html content}</div>
  
  <!-- Complex expressions -->
  <span>{posts.filter(p => p.published).length} published</span>
</template>
```

#### Reactive Statements
```egh
<script>
  let count = 0;
  let doubled = 0;
  
  // Reactive statement - auto-updates when count changes
  $: doubled = count * 2;
  
  // Complex reactive statement
  $: {
    console.log('Count changed to:', count);
    if (count > 10) {
      alert('Count is high!');
    }
  }
</script>
```

#### Event Handlers
```egh
<template>
  <!-- Simple event handlers -->
  <button @click={increment}>Click me</button>
  
  <!-- Event modifiers -->
  <form @submit.prevent={handleSubmit}>
    <input @keydown.enter={submitOnEnter} />
  </form>
  
  <!-- Inline handlers -->
  <button @click={() => count++}>Increment</button>
</template>
```

#### Control Flow
```egh
<template>
  <!-- Conditional rendering -->
  {#if user}
    <p>Welcome, {user.name}!</p>
  {:else}
    <p>Please log in</p>
  {/if}
  
  <!-- List rendering -->
  {#each posts as post}
    <article>
      <h2>{post.title}</h2>
      <p>{post.content}</p>
    </article>
  {/each}
  
  <!-- List with index -->
  {#each items as item, i}
    <div class="item-{i}">{item.name}</div>
  {/each}
</template>
```

#### Component Composition
```egh
<script>
  import UserCard from './UserCard.egh';
  import Modal from './Modal.egh';
</script>

<template>
  <div class="app">
    <UserCard {user} />
    
    <Modal bind:open={showModal}>
      <h2 slot="title">Confirm Action</h2>
      <p>Are you sure?</p>
    </Modal>
  </div>
</template>
```

### Implementation Priority

#### Phase 1: Core Syntax (BLOCKING)
1. **Template Interpolation** - Required for basic component rendering
2. **Event Handlers** - Required for interactive components
3. **Control Flow** - Required for dynamic UIs
4. **Reactive Statements** - Required for state management

#### Phase 2: Composition (HIGH PRIORITY)
1. **Component Import/Export** - Required for modular development
2. **Slot System** - Required for flexible layouts
3. **Props System** - Required for component communication

#### Phase 3: Advanced Features (MEDIUM PRIORITY)
1. **Transition/Animation Hooks** - For smooth UX
2. **Custom Directives** - For framework extensibility
3. **Template Helpers** - For developer convenience

### Success Criteria

**Syntax Sprint Complete When**:
- All core syntax features implemented and tested
- Parser generates complete AST for production compiler
- Example components work with finalized syntax
- No breaking changes expected for 1.0 release
- Syntax documentation complete and accurate

**Validation Requirements**:
- Counter example works with new syntax
- User profile page with data loading works
- Todo list with all CRUD operations works
- Error cases handled gracefully
- Performance meets existing benchmarks

### Risk Mitigation

#### High-Risk Items

1. **Syntax Breaking Changes**
   - **Risk**: Late syntax changes break existing components
   - **Mitigation**: Lock syntax decisions, create migration guide
   - **Escalation**: No changes after implementation complete

2. **Parser Performance**
   - **Risk**: Complex syntax slows compilation
   - **Mitigation**: Benchmark parsing speed, optimize hot paths
   - **Escalation**: Simplify syntax if performance degrades

3. **AST Compatibility**
   - **Risk**: Syntax doesn't map cleanly to AST for production
   - **Mitigation**: Validate AST generation for all syntax features
   - **Escalation**: Adjust syntax to ensure clean compilation

### Agent Coordination

#### Syntax Agent Responsibilities
- **IMMEDIATE**: Finalize all syntax decisions (no delays)
- **HIGH**: Implement complete parser for all syntax features
- **HIGH**: Generate comprehensive AST for compiler integration
- **MEDIUM**: Create syntax documentation and examples

#### Handoff Requirements
- **To Compiler Agent**: Complete AST specification and parser
- **To Core Agent**: Finalized syntax examples and test cases
- **To Runtime Agent**: Event handling and reactive statement requirements

#### Communication Protocol
- **Update frequency**: Every 30 minutes (mandatory)
- **Status tracking**: Real-time progress in worktree-status.json
- **Blocker escalation**: Immediate notification to Core Agent
- **Completion criteria**: All syntax features working and documented

### Timeline

**Sprint 0.5 Duration**: 1-2 sessions (URGENT)
- **Session 1**: Finalize syntax decisions and core implementation
- **Session 2**: Complete advanced features and AST generation

**Critical Path**:
1. Template interpolation (blocks everything)
2. Event handlers (blocks interactivity)
3. Control flow (blocks dynamic UIs)
4. Component composition (blocks modularity)

**Handoff Target**: End of Session 2, all syntax locked and implemented

---

*This sprint is BLOCKING the production build system. No delays acceptable. Syntax Agent must deliver complete, final syntax implementation immediately.*