use anyhow::Result;
use colored::*;
use std::path::PathBuf;

pub async fn execute(r#type: String, name: String, directory: Option<PathBuf>) -> Result<()> {
    println!("{} {} {} named {}", 
        "🎨".bold(),
        "Generating".blue(),
        r#type.bold(),
        name.bold()
    );
    
    let dir = directory.unwrap_or_else(|| {
        match r#type.as_str() {
            "component" => PathBuf::from("src/components"),
            "page" => PathBuf::from("src/routes"),
            "hook" => PathBuf::from("src/hooks"),
            "store" => PathBuf::from("src/stores"),
            _ => PathBuf::from("src"),
        }
    });
    
    // Ensure directory exists
    tokio::fs::create_dir_all(&dir).await?;
    
    match r#type.as_str() {
        "component" => generate_component(&name, &dir).await?,
        "page" => generate_page(&name, &dir).await?,
        "hook" => generate_hook(&name, &dir).await?,
        "store" => generate_store(&name, &dir).await?,
        _ => anyhow::bail!("Unknown type: {}. Valid types: component, page, hook, store", r#type),
    }
    
    println!("{} Generated {} successfully!", "✅".green(), r#type);
    println!("  {} {}", "Location:".dimmed(), dir.join(&name).display());
    
    Ok(())
}

async fn generate_component(name: &str, dir: &PathBuf) -> Result<()> {
    let component_name = capitalize_first(name);
    let content = format!(r#"<template>
  <div class="{}">
    <h2>{{{{ title }}}}</h2>
    <slot />
  </div>
</template>

<script>
  export let title = '{} Component'
</script>

<style>
  .{} {{
    padding: 1rem;
    border: 1px solid #ddd;
    border-radius: 4px;
  }}
</style>"#, name.to_lowercase(), component_name, name.to_lowercase());
    
    tokio::fs::write(dir.join(format!("{}.egh", component_name)), content).await?;
    Ok(())
}

async fn generate_page(name: &str, dir: &PathBuf) -> Result<()> {
    let page_name = capitalize_first(name);
    let content = format!(r#"<template>
  <div class="page-{}">
    <h1>{} Page</h1>
    <main>
      <!-- Page content here -->
    </main>
  </div>
</template>

<script>
  export async function load({{ params, url }}) {{
    // Load page data here
    return {{
      props: {{}}
    }}
  }}
</script>

<style>
  .page-{} {{
    min-height: 100vh;
    padding: 2rem;
  }}
</style>"#, name.to_lowercase(), page_name, name.to_lowercase());
    
    tokio::fs::write(dir.join(format!("{}.egh", page_name)), content).await?;
    Ok(())
}

async fn generate_hook(name: &str, dir: &PathBuf) -> Result<()> {
    let hook_name = if name.starts_with("use") { 
        name.to_string() 
    } else { 
        format!("use{}", capitalize_first(name))
    };
    
    let content = format!(r#"import {{ reactive, computed }} from 'eghact'

export function {}(initialValue = null) {{
  const state = reactive({{
    value: initialValue,
    loading: false,
    error: null
  }})
  
  const isReady = computed(() => !state.loading && !state.error)
  
  function setValue(newValue) {{
    state.value = newValue
  }}
  
  function setLoading(loading) {{
    state.loading = loading
  }}
  
  function setError(error) {{
    state.error = error
  }}
  
  return {{
    ...state,
    isReady,
    setValue,
    setLoading,
    setError
  }}
}}"#, hook_name);
    
    tokio::fs::write(dir.join(format!("{}.js", hook_name)), content).await?;
    Ok(())
}

async fn generate_store(name: &str, dir: &PathBuf) -> Result<()> {
    let store_name = name.to_lowercase();
    let content = format!(r#"import {{ createStore }} from 'eghact/store'

export const {}Store = createStore({{
  // State
  state: () => ({{
    items: [],
    loading: false,
    error: null
  }}),
  
  // Getters
  getters: {{
    itemCount: (state) => state.items.length,
    hasItems: (state) => state.items.length > 0
  }},
  
  // Actions
  actions: {{
    async fetchItems() {{
      this.loading = true
      this.error = null
      
      try {{
        const response = await fetch('/api/{}')
        this.items = await response.json()
      }} catch (error) {{
        this.error = error.message
      }} finally {{
        this.loading = false
      }}
    }},
    
    addItem(item) {{
      this.items.push(item)
    }},
    
    removeItem(id) {{
      const index = this.items.findIndex(item => item.id === id)
      if (index > -1) {{
        this.items.splice(index, 1)
      }}
    }}
  }}
}})"#, store_name, store_name);
    
    tokio::fs::write(dir.join(format!("{}.store.js", store_name)), content).await?;
    Ok(())
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}