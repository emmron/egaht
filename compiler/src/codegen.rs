use anyhow::Result;
use swc_common::{SourceMap, FileName};
use swc_ecma_ast::Module;
use swc_ecma_codegen::{text_writer::JsWriter, Emitter};

/// HTML escape function to prevent XSS attacks
pub fn escape_html(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
        .replace('/', "&#x2F;")
}

pub struct CompilerOutput {
    pub code: String,
    pub map: Option<String>,
}

pub fn generate_javascript(module: Module, sourcemap: bool) -> Result<CompilerOutput> {
    let cm = SourceMap::default();
    let mut buf = vec![];
    let mut map_buf = vec![];
    
    {
        let writer = JsWriter::new(
            &cm,
            "\n",
            &mut buf,
            if sourcemap { Some(&mut map_buf) } else { None },
        );
        
        let mut emitter = Emitter {
            cfg: swc_ecma_codegen::Config {
                minify: false,
                ..Default::default()
            },
            cm: cm.clone(),
            comments: None,
            wr: Box::new(writer),
        };
        
        emitter.emit_module(&module)?;
    }
    
    let code = String::from_utf8(buf)?;
    
    let map = if sourcemap {
        let map = cm.build_source_map(&map_buf);
        Some(map.to_json())
    } else {
        None
    };
    
    Ok(CompilerOutput { code, map })
}