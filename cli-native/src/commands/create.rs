use anyhow::Result;
use colored::*;
use std::path::Path;
use tokio::fs;

pub async fn execute(name: String, template: String, typescript: bool, git: bool) -> Result<()> {
    println!("{} {} {}", 
        "🚀".bold(),
        "Creating new Eghact project:".blue(),
        name.bold()
    );
    
    // Validate project name
    if !is_valid_project_name(&name) {
        anyhow::bail!("Invalid project name. Use only letters, numbers, hyphens, and underscores.");
    }
    
    let project_path = Path::new(&name);
    
    // Check if directory exists
    if project_path.exists() {
        anyhow::bail!("Directory '{}' already exists", name);
    }
    
    // Create project structure
    println!("{} Creating project structure...", "📁".dimmed());
    create_project_structure(project_path, &name, typescript).await?;
    
    // Initialize git if requested
    if git {
        println!("{} Initializing git repository...", "🔧".dimmed());
        initialize_git(project_path).await?;
    }
    
    println!();
    println!("{} Project created successfully!", "✨".green().bold());
    println!();
    println!("{}", "Next steps:".bold());
    println!("  cd {}", name.cyan());
    println!("  {}", "eghact dev".cyan());
    println!();
    
    Ok(())
}

fn is_valid_project_name(name: &str) -> bool {
    name.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

async fn create_project_structure(path: &Path, name: &str, typescript: bool) -> Result<()> {
    // Create directories
    fs::create_dir_all(path.join("src/components")).await?;
    fs::create_dir_all(path.join("src/routes")).await?;
    fs::create_dir_all(path.join("public")).await?;
    
    // Create package.json
    let package_json = serde_json::json!({
        "name": name,
        "version": "0.1.0",
        "scripts": {
            "dev": "eghact dev",
            "build": "eghact build",
            "test": "eghact test"
        }
    });
    
    fs::write(
        path.join("package.json"),
        serde_json::to_string_pretty(&package_json)?
    ).await?;
    
    // Create main component
    let app_component = r#"<template>
  <div class="app">
    <h1>Welcome to {{ name }}</h1>
    <Counter />
  </div>
</template>

<script>
  import Counter from './components/Counter.egh'
  
  let name = 'Eghact'
</script>

<style>
  .app {
    text-align: center;
    padding: 2rem;
    font-family: system-ui, sans-serif;
  }
</style>"#;
    
    fs::write(path.join("src/App.egh"), app_component).await?;
    
    // Create Counter component
    let counter_component = r#"<template>
  <div class="counter">
    <h2>Count: {{ count }}</h2>
    <button @click="increment">+</button>
    <button @click="decrement">-</button>
  </div>
</template>

<script>
  let count = 0
  
  function increment() {
    count++
  }
  
  function decrement() {
    count--
  }
</script>

<style>
  .counter {
    margin: 2rem 0;
  }
  
  button {
    margin: 0 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
  }
</style>"#;
    
    fs::write(path.join("src/components/Counter.egh"), counter_component).await?;
    
    // Create index.html
    let index_html = format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>"#, name);
    
    fs::write(path.join("public/index.html"), index_html).await?;
    
    // Create main.js
    let main_js = r#"import { createApp } from 'eghact'
import App from './App.egh'

createApp(App).mount('#app')"#;
    
    fs::write(path.join("src/main.js"), main_js).await?;
    
    // Create config
    let config = crate::config::EghactConfig::default();
    let config_str = serde_json::to_string_pretty(&config)?;
    fs::write(path.join("eghact.config.json"), config_str).await?;
    
    // Create .gitignore
    let gitignore = r#"node_modules/
dist/
.eghact-cache/
*.log
.DS_Store"#;
    
    fs::write(path.join(".gitignore"), gitignore).await?;
    
    Ok(())
}

async fn initialize_git(path: &Path) -> Result<()> {
    tokio::process::Command::new("git")
        .arg("init")
        .current_dir(path)
        .output()
        .await?;
    
    Ok(())
}