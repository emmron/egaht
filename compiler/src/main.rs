use anyhow::Result;
use clap::Parser;
use std::fs;
use std::path::PathBuf;

mod parser;
mod transformer;
mod codegen;
mod template;
mod style;
mod reactivity;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Input .egh file to compile
    #[arg(short, long)]
    input: PathBuf,

    /// Output JavaScript file
    #[arg(short, long)]
    output: Option<PathBuf>,

    /// Enable incremental compilation
    #[arg(short = 'i', long)]
    incremental: bool,

    /// Enable source maps
    #[arg(short = 'm', long)]
    sourcemap: bool,
}

fn main() -> Result<()> {
    let args = Args::parse();
    
    // Read the input file
    let source = fs::read_to_string(&args.input)?;
    
    // Parse the .egh file
    let component = parser::parse_egh_file(&source, &args.input)?;
    
    // Transform to JavaScript AST
    let js_ast = transformer::transform_component(component)?;
    
    // Generate JavaScript code
    let output = codegen::generate_javascript(js_ast, args.sourcemap)?;
    
    // Determine output path
    let output_path = args.output.unwrap_or_else(|| {
        let mut path = args.input.clone();
        path.set_extension("js");
        path
    });
    
    // Write output
    fs::write(&output_path, output.code)?;
    println!("✨ Compiled {} -> {}", args.input.display(), output_path.display());
    
    if args.sourcemap {
        let map_path = output_path.with_extension("js.map");
        if let Some(map) = output.map {
            fs::write(&map_path, map)?;
            println!("📍 Source map written to {}", map_path.display());
        }
    }
    
    Ok(())
}