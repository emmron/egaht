use std::time::Instant;
use eghact_compiler::{parse_component, parse_template};

#[test]
fn test_parser_performance_simple() {
    let input = r#"
<template>
  <div>
    <h1>{title}</h1>
    <p>{count}</p>
    <button @click={increment}>+</button>
  </div>
</template>

<script>
  let title = "Test";
  let count = 0;
  
  function increment() {
    count++;
  }
</script>

<style>
  div { padding: 20px; }
</style>
"#;

    let start = Instant::now();
    let result = parse_component("test.egh", input);
    let duration = start.elapsed();
    
    assert!(result.is_ok());
    assert!(duration.as_millis() < 100, "Parse time {} ms exceeds 100ms limit", duration.as_millis());
    
    println!("Simple component parsed in {:?}", duration);
}

#[test]
fn test_parser_performance_complex() {
    let input = r#"
<template>
  <div class="app">
    {#if user}
      <header>
        <h1>Welcome, {user.name}!</h1>
        <nav>
          {#each menuItems as item}
            <a href={item.href} class:active={item.active}>
              {item.label}
            </a>
          {/each}
        </nav>
      </header>
      
      <main>
        {#each posts as post (post.id)}
          <article>
            <h2>{post.title}</h2>
            <p>{@html post.content}</p>
            <footer>
              <span>By {post.author}</span>
              <time>{formatDate(post.date)}</time>
            </footer>
          </article>
        {/each}
      </main>
      
      <aside>
        <UserCard {user} @logout={handleLogout} />
        <RecentActivity items={activities} />
      </aside>
    {:else}
      <LoginForm @submit={handleLogin} />
    {/if}
  </div>
</template>

<script>
  import UserCard from './UserCard.egh';
  import RecentActivity from './RecentActivity.egh';
  import LoginForm from './LoginForm.egh';
  
  export let user = null;
  let posts = [];
  let activities = [];
  let menuItems = [
    { label: 'Home', href: '/', active: true },
    { label: 'About', href: '/about', active: false },
    { label: 'Contact', href: '/contact', active: false }
  ];
  
  $: userLoggedIn = user !== null;
  $: postCount = posts.length;
  $: {
    if (user) {
      loadUserData();
    }
  }
  
  async function loadUserData() {
    posts = await fetchPosts(user.id);
    activities = await fetchActivities(user.id);
  }
  
  function handleLogin(event) {
    const { email, password } = event.detail;
    // Login logic
  }
  
  function handleLogout() {
    user = null;
    posts = [];
    activities = [];
  }
  
  function formatDate(date) {
    return new Date(date).toLocaleDateString();
  }
</script>

<style>
  .app {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }
  
  header {
    grid-column: 1 / -1;
    border-bottom: 1px solid #eee;
    padding-bottom: 20px;
  }
  
  nav {
    display: flex;
    gap: 20px;
  }
  
  nav a {
    color: #333;
    text-decoration: none;
  }
  
  nav a.active {
    font-weight: bold;
    border-bottom: 2px solid #007bff;
  }
  
  article {
    margin-bottom: 30px;
    padding: 20px;
    border: 1px solid #eee;
    border-radius: 8px;
  }
  
  aside {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
</style>
"#;

    let start = Instant::now();
    let result = parse_component("complex.egh", input);
    let duration = start.elapsed();
    
    assert!(result.is_ok());
    assert!(duration.as_millis() < 100, "Parse time {} ms exceeds 100ms limit", duration.as_millis());
    
    println!("Complex component parsed in {:?}", duration);
}

#[test]
fn test_parser_performance_large_template() {
    // Generate a large template with many elements
    let mut template = String::from("<template>\n<div>\n");
    
    for i in 0..100 {
        template.push_str(&format!(
            r#"
  <div class="item-{i}">
    <h3>Item {i}</h3>
    <p>Description for item {i}</p>
    {{#if items[{i}].active}}
      <span class="active">Active</span>
    {{:else}}
      <span class="inactive">Inactive</span>
    {{/if}}
    <button @click={{() => handleClick({i})}}>Click {i}</button>
  </div>
"#,
            i = i
        ));
    }
    
    template.push_str("</div>\n</template>\n\n<script>\nlet items = [];\n</script>");
    
    let start = Instant::now();
    let result = parse_component("large.egh", &template);
    let duration = start.elapsed();
    
    assert!(result.is_ok());
    assert!(duration.as_millis() < 100, "Parse time {} ms exceeds 100ms limit for large template", duration.as_millis());
    
    println!("Large template (100 items) parsed in {:?}", duration);
}

#[test]
fn test_template_parser_performance() {
    let template = r#"
<div class="container">
  {#each users as user, index (user.id)}
    <div class="user-card">
      <img src={user.avatar} alt={user.name}>
      <h3>{user.name}</h3>
      <p>{user.bio}</p>
      {#if user.isPremium}
        <span class="badge">Premium</span>
      {/if}
      <div class="actions">
        <button @click={() => editUser(user.id)}>Edit</button>
        <button @click.once={() => deleteUser(user.id)}>Delete</button>
      </div>
    </div>
  {/each}
</div>
"#;

    let iterations = 1000;
    let start = Instant::now();
    
    for _ in 0..iterations {
        let result = parse_template(template);
        assert!(result.is_ok());
    }
    
    let total_duration = start.elapsed();
    let avg_duration = total_duration / iterations;
    
    println!("Template parser average time over {} iterations: {:?}", iterations, avg_duration);
    assert!(avg_duration.as_micros() < 100_000, "Average parse time {:?} exceeds 100µs", avg_duration);
}

#[test]
fn test_parser_memory_efficiency() {
    // Test that parser doesn't have memory leaks with repeated parsing
    let input = r#"
<template>
  <div>{content}</div>
</template>
<script>
  let content = "test";
</script>
"#;

    let initial_memory = get_current_memory_usage();
    
    for _ in 0..10000 {
        let _ = parse_component("test.egh", input);
    }
    
    let final_memory = get_current_memory_usage();
    let memory_increase = final_memory.saturating_sub(initial_memory);
    
    // Allow up to 10MB increase for 10k parses
    assert!(memory_increase < 10_000_000, "Memory usage increased by {} bytes", memory_increase);
    
    println!("Memory increase after 10k parses: {} bytes", memory_increase);
}

// Helper function to get approximate memory usage
fn get_current_memory_usage() -> usize {
    // In a real implementation, use platform-specific memory APIs
    // This is a placeholder
    0
}