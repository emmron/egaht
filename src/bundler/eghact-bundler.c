// Eghact Bundler
// Replacement for Webpack/Rollup - Pure C implementation
// Zero dependencies on Node.js ecosystem

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <dirent.h>
#include <sys/stat.h>
#include "eghact-core.h"
#include "acorn-parser.h" // Our own JS parser

// Module types
typedef enum {
    MODULE_JS,
    MODULE_EGH,
    MODULE_CSS,
    MODULE_WASM,
    MODULE_JSON,
    MODULE_ASSET
} ModuleType;

// Module structure
typedef struct Module {
    char* id;
    char* path;
    char* content;
    char* transformed_content;
    ModuleType type;
    struct Module** dependencies;
    int num_dependencies;
    int processed;
} Module;

// Bundle configuration
typedef struct {
    char* entry;
    char* output;
    int minify;
    int sourcemaps;
    int tree_shaking;
    char* target; // "browser" or "node"
    char** externals;
    int num_externals;
} BundleConfig;

// AST node for tree shaking
typedef struct ASTNode {
    enum {
        AST_IMPORT,
        AST_EXPORT,
        AST_FUNCTION,
        AST_VARIABLE,
        AST_CLASS
    } type;
    char* name;
    int used;
    struct ASTNode** references;
    int num_references;
} ASTNode;

// Bundle context
typedef struct {
    Module** modules;
    int num_modules;
    ASTNode** ast_nodes;
    int num_ast_nodes;
    BundleConfig* config;
    char* output_code;
} BundleContext;

// Parse JavaScript/Eghact module
Module* parse_module(const char* path) {
    Module* module = malloc(sizeof(Module));
    module->path = strdup(path);
    module->id = generate_module_id(path);
    module->dependencies = NULL;
    module->num_dependencies = 0;
    module->processed = 0;
    
    // Determine module type
    if (ends_with(path, ".js")) {
        module->type = MODULE_JS;
    } else if (ends_with(path, ".egh")) {
        module->type = MODULE_EGH;
    } else if (ends_with(path, ".css")) {
        module->type = MODULE_CSS;
    } else if (ends_with(path, ".wasm")) {
        module->type = MODULE_WASM;
    } else if (ends_with(path, ".json")) {
        module->type = MODULE_JSON;
    } else {
        module->type = MODULE_ASSET;
    }
    
    // Read content
    module->content = read_file(path);
    if (!module->content) {
        free(module);
        return NULL;
    }
    
    return module;
}

// Extract dependencies from module
void extract_dependencies(Module* module) {
    if (module->type != MODULE_JS && module->type != MODULE_EGH) {
        return;
    }
    
    // Parse imports/requires
    char* content = module->content;
    char* import_pos = content;
    
    while ((import_pos = strstr(import_pos, "import")) != NULL) {
        // Parse import statement
        char* from_pos = strstr(import_pos, "from");
        if (from_pos) {
            char* quote_start = strchr(from_pos, '"');
            if (!quote_start) quote_start = strchr(from_pos, '\'');
            
            if (quote_start) {
                char* quote_end = strchr(quote_start + 1, quote_start[0]);
                if (quote_end) {
                    int len = quote_end - quote_start - 1;
                    char* dep_path = malloc(len + 1);
                    strncpy(dep_path, quote_start + 1, len);
                    dep_path[len] = '\0';
                    
                    // Resolve dependency path
                    char* resolved = resolve_dependency(module->path, dep_path);
                    
                    // Add to dependencies
                    module->num_dependencies++;
                    module->dependencies = realloc(module->dependencies,
                        sizeof(Module*) * module->num_dependencies);
                    module->dependencies[module->num_dependencies - 1] = 
                        parse_module(resolved);
                    
                    free(dep_path);
                    free(resolved);
                }
            }
        }
        
        import_pos += 6; // Move past "import"
    }
    
    // Also handle require() for CommonJS
    char* require_pos = content;
    while ((require_pos = strstr(require_pos, "require(")) != NULL) {
        char* paren_start = require_pos + 8;
        char* quote_start = strchr(paren_start, '"');
        if (!quote_start) quote_start = strchr(paren_start, '\'');
        
        if (quote_start) {
            char* quote_end = strchr(quote_start + 1, quote_start[0]);
            if (quote_end) {
                int len = quote_end - quote_start - 1;
                char* dep_path = malloc(len + 1);
                strncpy(dep_path, quote_start + 1, len);
                dep_path[len] = '\0';
                
                // Add dependency
                char* resolved = resolve_dependency(module->path, dep_path);
                module->num_dependencies++;
                module->dependencies = realloc(module->dependencies,
                    sizeof(Module*) * module->num_dependencies);
                module->dependencies[module->num_dependencies - 1] = 
                    parse_module(resolved);
                
                free(dep_path);
                free(resolved);
            }
        }
        
        require_pos += 8;
    }
}

// Transform module content
void transform_module(Module* module, BundleContext* ctx) {
    switch (module->type) {
        case MODULE_JS:
            module->transformed_content = transform_javascript(module, ctx);
            break;
            
        case MODULE_EGH:
            module->transformed_content = transform_eghact(module, ctx);
            break;
            
        case MODULE_CSS:
            module->transformed_content = transform_css(module, ctx);
            break;
            
        case MODULE_JSON:
            module->transformed_content = wrap_json_module(module->content);
            break;
            
        case MODULE_WASM:
            module->transformed_content = create_wasm_loader(module);
            break;
            
        default:
            module->transformed_content = create_asset_loader(module);
    }
}

// Transform JavaScript
char* transform_javascript(Module* module, BundleContext* ctx) {
    char* output = malloc(strlen(module->content) * 2);
    char* out_ptr = output;
    
    // Wrap in module closure
    out_ptr += sprintf(out_ptr, 
        "__eghact_modules__['%s'] = function(module, exports, require) {\n",
        module->id);
    
    // Transform import/export to CommonJS
    char* content = strdup(module->content);
    char* line = strtok(content, "\n");
    
    while (line) {
        if (strstr(line, "import ") == line) {
            // Transform ES6 import
            out_ptr += transform_import_statement(line, out_ptr);
        } else if (strstr(line, "export ") == line) {
            // Transform ES6 export
            out_ptr += transform_export_statement(line, out_ptr);
        } else {
            // Copy line as-is
            out_ptr += sprintf(out_ptr, "%s\n", line);
        }
        
        line = strtok(NULL, "\n");
    }
    
    // Close module wrapper
    out_ptr += sprintf(out_ptr, "\n};\n");
    
    free(content);
    
    // Minify if requested
    if (ctx->config->minify) {
        char* minified = minify_javascript(output);
        free(output);
        output = minified;
    }
    
    return output;
}

// Tree shaking - mark used exports
void mark_used_exports(BundleContext* ctx) {
    // Start from entry module
    Module* entry = find_module_by_path(ctx, ctx->config->entry);
    if (!entry) return;
    
    // Mark all exports from entry as used
    mark_module_exports_used(entry, ctx);
    
    // Traverse dependency graph
    int changed = 1;
    while (changed) {
        changed = 0;
        for (int i = 0; i < ctx->num_modules; i++) {
            Module* module = ctx->modules[i];
            if (check_and_mark_used_imports(module, ctx)) {
                changed = 1;
            }
        }
    }
}

// Remove unused code
void shake_tree(BundleContext* ctx) {
    if (!ctx->config->tree_shaking) return;
    
    mark_used_exports(ctx);
    
    // Remove unused exports from each module
    for (int i = 0; i < ctx->num_modules; i++) {
        Module* module = ctx->modules[i];
        module->transformed_content = remove_unused_exports(
            module->transformed_content, ctx);
    }
}

// Generate source maps
char* generate_source_map(BundleContext* ctx) {
    if (!ctx->config->sourcemaps) return NULL;
    
    // Create source map in JSON format
    char* sourcemap = malloc(1024 * 1024); // 1MB initial
    char* ptr = sourcemap;
    
    ptr += sprintf(ptr, "{\n");
    ptr += sprintf(ptr, "  \"version\": 3,\n");
    ptr += sprintf(ptr, "  \"sources\": [");
    
    // List all source files
    for (int i = 0; i < ctx->num_modules; i++) {
        if (i > 0) ptr += sprintf(ptr, ", ");
        ptr += sprintf(ptr, "\"%s\"", ctx->modules[i]->path);
    }
    
    ptr += sprintf(ptr, "],\n");
    ptr += sprintf(ptr, "  \"mappings\": \"");
    
    // Generate VLQ-encoded mappings
    ptr += generate_vlq_mappings(ctx, ptr);
    
    ptr += sprintf(ptr, "\"\n}\n");
    
    return sourcemap;
}

// Bundle all modules
void create_bundle(BundleContext* ctx) {
    // Calculate bundle size
    size_t bundle_size = 0;
    for (int i = 0; i < ctx->num_modules; i++) {
        bundle_size += strlen(ctx->modules[i]->transformed_content);
    }
    bundle_size += 10240; // Runtime overhead
    
    ctx->output_code = malloc(bundle_size);
    char* ptr = ctx->output_code;
    
    // Add runtime
    ptr += sprintf(ptr, 
        "// Eghact Bundle Runtime\n"
        "(function() {\n"
        "  var __eghact_modules__ = {};\n"
        "  var __eghact_cache__ = {};\n"
        "  \n"
        "  function __eghact_require__(id) {\n"
        "    if (__eghact_cache__[id]) {\n"
        "      return __eghact_cache__[id].exports;\n"
        "    }\n"
        "    var module = { exports: {} };\n"
        "    __eghact_cache__[id] = module;\n"
        "    __eghact_modules__[id](module, module.exports, __eghact_require__);\n"
        "    return module.exports;\n"
        "  }\n"
        "  \n");
    
    // Add all modules
    for (int i = 0; i < ctx->num_modules; i++) {
        ptr += sprintf(ptr, "%s\n", ctx->modules[i]->transformed_content);
    }
    
    // Add entry point
    ptr += sprintf(ptr, 
        "  // Entry point\n"
        "  __eghact_require__('%s');\n"
        "})();\n",
        ctx->modules[0]->id);
    
    // Add source map reference
    if (ctx->config->sourcemaps) {
        ptr += sprintf(ptr, "//# sourceMappingURL=%s.map\n", 
                      ctx->config->output);
    }
}

// Main bundler function
int eghact_bundle(BundleConfig* config) {
    printf("Bundling %s...\n", config->entry);
    
    BundleContext ctx = {0};
    ctx.config = config;
    
    // Parse entry module
    Module* entry = parse_module(config->entry);
    if (!entry) {
        fprintf(stderr, "Error: Cannot read entry file: %s\n", config->entry);
        return 1;
    }
    
    // Build dependency graph
    ctx.modules = malloc(sizeof(Module*) * 1024);
    ctx.num_modules = 0;
    
    build_dependency_graph(entry, &ctx);
    
    // Transform all modules
    for (int i = 0; i < ctx.num_modules; i++) {
        transform_module(ctx.modules[i], &ctx);
    }
    
    // Tree shaking
    shake_tree(&ctx);
    
    // Create bundle
    create_bundle(&ctx);
    
    // Write output
    FILE* out = fopen(config->output, "w");
    if (!out) {
        fprintf(stderr, "Error: Cannot write output file: %s\n", config->output);
        return 1;
    }
    
    fprintf(out, "%s", ctx.output_code);
    fclose(out);
    
    // Write source map
    if (config->sourcemaps) {
        char mapfile[PATH_MAX];
        snprintf(mapfile, sizeof(mapfile), "%s.map", config->output);
        
        char* sourcemap = generate_source_map(&ctx);
        FILE* map = fopen(mapfile, "w");
        fprintf(map, "%s", sourcemap);
        fclose(map);
        free(sourcemap);
    }
    
    // Print stats
    struct stat st;
    stat(config->output, &st);
    printf("✓ Bundle created: %s (%ld KB)\n", config->output, st.st_size / 1024);
    
    // Cleanup
    for (int i = 0; i < ctx.num_modules; i++) {
        free_module(ctx.modules[i]);
    }
    free(ctx.modules);
    free(ctx.output_code);
    
    return 0;
}

// CLI entry point
int main(int argc, char* argv[]) {
    if (argc < 3) {
        printf("Eghact Bundler v1.0.0\n\n");
        printf("Usage: eghact-bundle <entry> <output> [options]\n\n");
        printf("Options:\n");
        printf("  --minify          Minify output\n");
        printf("  --sourcemaps      Generate source maps\n");
        printf("  --tree-shaking    Remove unused exports\n");
        printf("  --target <env>    Target environment (browser/node)\n");
        printf("  --external <mod>  Mark module as external\n");
        return 0;
    }
    
    BundleConfig config = {0};
    config.entry = argv[1];
    config.output = argv[2];
    config.target = "browser";
    
    // Parse options
    for (int i = 3; i < argc; i++) {
        if (strcmp(argv[i], "--minify") == 0) {
            config.minify = 1;
        } else if (strcmp(argv[i], "--sourcemaps") == 0) {
            config.sourcemaps = 1;
        } else if (strcmp(argv[i], "--tree-shaking") == 0) {
            config.tree_shaking = 1;
        } else if (strcmp(argv[i], "--target") == 0 && i + 1 < argc) {
            config.target = argv[++i];
        }
    }
    
    return eghact_bundle(&config);
}