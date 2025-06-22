// Eghact JavaScript Runtime
// Replacement for Node.js - Pure C implementation with V8/QuickJS embedding
// No Node.js dependencies whatsoever

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <dirent.h>
#include <dlfcn.h>
#include "quickjs.h"
#include "eghact-core.h"

// Runtime context
typedef struct {
    JSRuntime* js_runtime;
    JSContext* js_context;
    char* module_path;
    void* native_modules;
    void* event_loop;
} EghactRuntime;

// Module system
typedef struct Module {
    char* name;
    char* path;
    JSValue exports;
    int loaded;
    struct Module* next;
} Module;

typedef struct {
    Module* modules;
    char** search_paths;
    int num_paths;
} ModuleSystem;

// Event loop
typedef struct Event {
    void (*callback)(void*);
    void* data;
    int timeout;
    struct Event* next;
} Event;

typedef struct {
    Event* events;
    int running;
    pthread_t thread;
} EventLoop;

// Initialize Eghact runtime
EghactRuntime* eghact_runtime_create() {
    EghactRuntime* runtime = malloc(sizeof(EghactRuntime));
    
    // Initialize QuickJS
    runtime->js_runtime = JS_NewRuntime();
    runtime->js_context = JS_NewContext(runtime->js_runtime);
    
    // Set memory limit (256MB)
    JS_SetMemoryLimit(runtime->js_runtime, 256 * 1024 * 1024);
    
    // Initialize module system
    init_module_system(runtime);
    
    // Initialize event loop
    runtime->event_loop = create_event_loop();
    
    // Install global objects
    install_global_objects(runtime);
    
    return runtime;
}

// Custom require() implementation
JSValue eghact_require(JSContext* ctx, JSValueConst this_val, 
                       int argc, JSValueConst* argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "require expects module name");
    }
    
    const char* module_name = JS_ToCString(ctx, argv[0]);
    EghactRuntime* runtime = JS_GetContextOpaque(ctx);
    
    // Check if module is already loaded
    Module* cached = find_cached_module(runtime, module_name);
    if (cached) {
        JS_FreeCString(ctx, module_name);
        return JS_DupValue(ctx, cached->exports);
    }
    
    // Resolve module path
    char* module_path = resolve_module_path(runtime, module_name);
    if (!module_path) {
        JS_FreeCString(ctx, module_name);
        return JS_ThrowReferenceError(ctx, "Cannot find module '%s'", module_name);
    }
    
    // Load module
    JSValue module_exports = load_module(runtime, module_path);
    
    // Cache module
    cache_module(runtime, module_name, module_exports);
    
    JS_FreeCString(ctx, module_name);
    free(module_path);
    
    return module_exports;
}

// File system API
JSValue eghact_fs_readFile(JSContext* ctx, JSValueConst this_val,
                           int argc, JSValueConst* argv) {
    if (argc < 1) {
        return JS_ThrowTypeError(ctx, "readFile expects filename");
    }
    
    const char* filename = JS_ToCString(ctx, argv[0]);
    
    // Read file
    FILE* file = fopen(filename, "rb");
    if (!file) {
        JS_FreeCString(ctx, filename);
        return JS_ThrowInternalError(ctx, "Cannot read file");
    }
    
    fseek(file, 0, SEEK_END);
    long size = ftell(file);
    fseek(file, 0, SEEK_SET);
    
    char* buffer = malloc(size + 1);
    fread(buffer, 1, size, file);
    buffer[size] = '\0';
    fclose(file);
    
    JSValue result = JS_NewString(ctx, buffer);
    
    free(buffer);
    JS_FreeCString(ctx, filename);
    
    return result;
}

// HTTP Server implementation
typedef struct {
    int socket_fd;
    int port;
    JSValue handler;
    EghactRuntime* runtime;
} HttpServer;

JSValue eghact_http_createServer(JSContext* ctx, JSValueConst this_val,
                                int argc, JSValueConst* argv) {
    if (argc < 1 || !JS_IsFunction(ctx, argv[0])) {
        return JS_ThrowTypeError(ctx, "createServer expects handler function");
    }
    
    HttpServer* server = malloc(sizeof(HttpServer));
    server->runtime = JS_GetContextOpaque(ctx);
    server->handler = JS_DupValue(ctx, argv[0]);
    
    // Create socket
    server->socket_fd = socket(AF_INET, SOCK_STREAM, 0);
    
    // Return server object
    JSValue server_obj = JS_NewObject(ctx);
    JS_SetOpaque(server_obj, server);
    
    // Add listen method
    JSValue listen_func = JS_NewCFunction(ctx, http_server_listen, "listen", 1);
    JS_SetPropertyStr(ctx, server_obj, "listen", listen_func);
    
    return server_obj;
}

// Process API
JSValue eghact_process_exit(JSContext* ctx, JSValueConst this_val,
                           int argc, JSValueConst* argv) {
    int code = 0;
    if (argc > 0) {
        JS_ToInt32(ctx, &code, argv[0]);
    }
    exit(code);
    return JS_UNDEFINED;
}

// Timer functions
JSValue eghact_setTimeout(JSContext* ctx, JSValueConst this_val,
                         int argc, JSValueConst* argv) {
    if (argc < 2) {
        return JS_ThrowTypeError(ctx, "setTimeout expects callback and delay");
    }
    
    JSValue callback = argv[0];
    int delay;
    JS_ToInt32(ctx, &delay, argv[1]);
    
    EghactRuntime* runtime = JS_GetContextOpaque(ctx);
    
    // Schedule in event loop
    schedule_timeout(runtime->event_loop, callback, delay);
    
    return JS_NewInt32(ctx, generate_timer_id());
}

// Console implementation
JSValue console_log(JSContext* ctx, JSValueConst this_val,
                   int argc, JSValueConst* argv) {
    for (int i = 0; i < argc; i++) {
        if (i > 0) printf(" ");
        
        const char* str = JS_ToCString(ctx, argv[i]);
        if (str) {
            printf("%s", str);
            JS_FreeCString(ctx, str);
        }
    }
    printf("\n");
    fflush(stdout);
    
    return JS_UNDEFINED;
}

// Install global objects
void install_global_objects(EghactRuntime* runtime) {
    JSContext* ctx = runtime->js_context;
    JSValue global = JS_GetGlobalObject(ctx);
    
    // require() function
    JSValue require_func = JS_NewCFunction(ctx, eghact_require, "require", 1);
    JS_SetPropertyStr(ctx, global, "require", require_func);
    
    // console object
    JSValue console = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, console, "log", 
                     JS_NewCFunction(ctx, console_log, "log", 1));
    JS_SetPropertyStr(ctx, global, "console", console);
    
    // process object
    JSValue process = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, process, "exit",
                     JS_NewCFunction(ctx, eghact_process_exit, "exit", 1));
    
    // process.env
    JSValue env = JS_NewObject(ctx);
    extern char** environ;
    for (char** e = environ; *e; e++) {
        char* eq = strchr(*e, '=');
        if (eq) {
            *eq = '\0';
            JS_SetPropertyStr(ctx, env, *e, JS_NewString(ctx, eq + 1));
            *eq = '=';
        }
    }
    JS_SetPropertyStr(ctx, process, "env", env);
    JS_SetPropertyStr(ctx, global, "process", process);
    
    // fs module
    JSValue fs = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, fs, "readFile",
                     JS_NewCFunction(ctx, eghact_fs_readFile, "readFile", 2));
    register_builtin_module(runtime, "fs", fs);
    
    // http module
    JSValue http = JS_NewObject(ctx);
    JS_SetPropertyStr(ctx, http, "createServer",
                     JS_NewCFunction(ctx, eghact_http_createServer, "createServer", 1));
    register_builtin_module(runtime, "http", http);
    
    // Timers
    JS_SetPropertyStr(ctx, global, "setTimeout",
                     JS_NewCFunction(ctx, eghact_setTimeout, "setTimeout", 2));
    
    JS_FreeValue(ctx, global);
}

// Module resolution (compatible with Node.js algorithm)
char* resolve_module_path(EghactRuntime* runtime, const char* name) {
    // Check if it's a relative path
    if (name[0] == '.' || name[0] == '/') {
        return resolve_relative_module(runtime, name);
    }
    
    // Check builtin modules
    if (is_builtin_module(name)) {
        return strdup(name);
    }
    
    // Search in node_modules directories
    return search_node_modules(runtime, name);
}

// Event loop implementation
void* event_loop_thread(void* arg) {
    EventLoop* loop = (EventLoop*)arg;
    
    while (loop->running) {
        Event* event = get_next_event(loop);
        if (event) {
            event->callback(event->data);
            free(event);
        } else {
            usleep(1000); // 1ms sleep
        }
    }
    
    return NULL;
}

// Main execution
int eghact_run_script(EghactRuntime* runtime, const char* filename) {
    // Read script
    char* script = read_file(filename);
    if (!script) {
        fprintf(stderr, "Cannot read file: %s\n", filename);
        return 1;
    }
    
    // Set __filename and __dirname
    JSContext* ctx = runtime->js_context;
    JSValue global = JS_GetGlobalObject(ctx);
    JS_SetPropertyStr(ctx, global, "__filename", JS_NewString(ctx, filename));
    
    char dirname[PATH_MAX];
    get_dirname(filename, dirname);
    JS_SetPropertyStr(ctx, global, "__dirname", JS_NewString(ctx, dirname));
    
    // Execute script
    JSValue result = JS_Eval(ctx, script, strlen(script), filename, 
                            JS_EVAL_TYPE_GLOBAL);
    
    if (JS_IsException(result)) {
        JSValue exception = JS_GetException(ctx);
        const char* error = JS_ToCString(ctx, exception);
        fprintf(stderr, "Error: %s\n", error);
        JS_FreeCString(ctx, error);
        JS_FreeValue(ctx, exception);
        return 1;
    }
    
    JS_FreeValue(ctx, result);
    JS_FreeValue(ctx, global);
    free(script);
    
    // Run event loop
    run_event_loop(runtime->event_loop);
    
    return 0;
}

// CLI entry point
int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("Eghact Runtime v1.0.0\n");
        printf("Usage: eghact <script.js>\n");
        return 1;
    }
    
    EghactRuntime* runtime = eghact_runtime_create();
    int result = eghact_run_script(runtime, argv[1]);
    
    // Cleanup
    JS_FreeContext(runtime->js_context);
    JS_FreeRuntime(runtime->js_runtime);
    free(runtime);
    
    return result;
}