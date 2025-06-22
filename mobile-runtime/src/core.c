/**
 * Eghact Native Mobile Runtime
 * Pure C implementation for iOS/Android native rendering
 * Task #23.7 - Native runtime without React Native
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>

#ifdef __APPLE__
    #include <TargetConditionals.h>
    #if TARGET_OS_IPHONE
        #define PLATFORM_IOS
    #endif
#elif defined(__ANDROID__)
    #define PLATFORM_ANDROID
#endif

// Component types
typedef enum {
    COMPONENT_VIEW,
    COMPONENT_TEXT,
    COMPONENT_IMAGE,
    COMPONENT_BUTTON,
    COMPONENT_INPUT,
    COMPONENT_SCROLL,
    COMPONENT_LIST
} ComponentType;

// Style properties
typedef struct {
    float x, y, width, height;
    float padding_top, padding_right, padding_bottom, padding_left;
    float margin_top, margin_right, margin_bottom, margin_left;
    uint32_t background_color;
    uint32_t border_color;
    float border_width;
    float border_radius;
    float opacity;
    bool hidden;
} Style;

// Base component structure
typedef struct Component {
    ComponentType type;
    char* id;
    Style style;
    void* native_handle;  // Platform-specific handle
    struct Component* parent;
    struct Component** children;
    size_t child_count;
    size_t child_capacity;
    
    // Component-specific data
    union {
        struct {
            char* text;
            uint32_t color;
            float font_size;
        } text_data;
        
        struct {
            char* src;
            int resize_mode;
        } image_data;
        
        struct {
            char* title;
            void (*on_press)(void);
        } button_data;
        
        struct {
            char* value;
            char* placeholder;
            void (*on_change)(const char*);
        } input_data;
    } data;
} Component;

// Runtime context
typedef struct {
    Component* root;
    void* platform_context;
    size_t component_count;
    bool is_running;
} EghactRuntime;

// Platform-specific rendering interface
typedef struct {
    void* (*create_view)(Component* component);
    void* (*create_text)(Component* component);
    void* (*create_image)(Component* component);
    void* (*create_button)(Component* component);
    void* (*create_input)(Component* component);
    void* (*create_scroll)(Component* component);
    void* (*create_list)(Component* component);
    
    void (*update_layout)(Component* component);
    void (*update_style)(Component* component);
    void (*add_child)(Component* parent, Component* child);
    void (*remove_child)(Component* parent, Component* child);
    void (*destroy)(Component* component);
} PlatformRenderer;

// Global runtime instance
static EghactRuntime* g_runtime = NULL;
static PlatformRenderer* g_renderer = NULL;

// Forward declarations
Component* eghact_create_component(ComponentType type);
void eghact_destroy_component(Component* component);
void eghact_add_child(Component* parent, Component* child);
void eghact_remove_child(Component* parent, Component* child);
void eghact_update_layout(Component* component);

// Initialize runtime
EghactRuntime* eghact_init() {
    g_runtime = (EghactRuntime*)malloc(sizeof(EghactRuntime));
    g_runtime->root = NULL;
    g_runtime->platform_context = NULL;
    g_runtime->component_count = 0;
    g_runtime->is_running = false;
    
    // Initialize platform-specific renderer
    #ifdef PLATFORM_IOS
        g_renderer = eghact_ios_renderer_init();
    #elif defined(PLATFORM_ANDROID)
        g_renderer = eghact_android_renderer_init();
    #else
        g_renderer = eghact_default_renderer_init();
    #endif
    
    return g_runtime;
}

// Create component
Component* eghact_create_component(ComponentType type) {
    Component* component = (Component*)calloc(1, sizeof(Component));
    component->type = type;
    component->id = NULL;
    component->parent = NULL;
    component->children = NULL;
    component->child_count = 0;
    component->child_capacity = 0;
    
    // Initialize style with defaults
    component->style.x = 0;
    component->style.y = 0;
    component->style.width = 0;
    component->style.height = 0;
    component->style.opacity = 1.0f;
    component->style.hidden = false;
    component->style.background_color = 0x00000000; // Transparent
    
    // Create native component
    switch (type) {
        case COMPONENT_VIEW:
            component->native_handle = g_renderer->create_view(component);
            break;
        case COMPONENT_TEXT:
            component->native_handle = g_renderer->create_text(component);
            break;
        case COMPONENT_IMAGE:
            component->native_handle = g_renderer->create_image(component);
            break;
        case COMPONENT_BUTTON:
            component->native_handle = g_renderer->create_button(component);
            break;
        case COMPONENT_INPUT:
            component->native_handle = g_renderer->create_input(component);
            break;
        case COMPONENT_SCROLL:
            component->native_handle = g_renderer->create_scroll(component);
            break;
        case COMPONENT_LIST:
            component->native_handle = g_renderer->create_list(component);
            break;
    }
    
    g_runtime->component_count++;
    return component;
}

// Component factory functions
Component* eghact_create_view() {
    return eghact_create_component(COMPONENT_VIEW);
}

Component* eghact_create_text(const char* text) {
    Component* component = eghact_create_component(COMPONENT_TEXT);
    component->data.text_data.text = strdup(text);
    component->data.text_data.color = 0xFF000000; // Black
    component->data.text_data.font_size = 16.0f;
    return component;
}

Component* eghact_create_image(const char* src) {
    Component* component = eghact_create_component(COMPONENT_IMAGE);
    component->data.image_data.src = strdup(src);
    component->data.image_data.resize_mode = 0; // Cover
    return component;
}

Component* eghact_create_button(const char* title, void (*on_press)(void)) {
    Component* component = eghact_create_component(COMPONENT_BUTTON);
    component->data.button_data.title = strdup(title);
    component->data.button_data.on_press = on_press;
    return component;
}

Component* eghact_create_input(const char* placeholder) {
    Component* component = eghact_create_component(COMPONENT_INPUT);
    component->data.input_data.value = strdup("");
    component->data.input_data.placeholder = strdup(placeholder);
    component->data.input_data.on_change = NULL;
    return component;
}

// Add child to parent
void eghact_add_child(Component* parent, Component* child) {
    if (!parent || !child) return;
    
    // Grow children array if needed
    if (parent->child_count >= parent->child_capacity) {
        size_t new_capacity = parent->child_capacity == 0 ? 4 : parent->child_capacity * 2;
        parent->children = (Component**)realloc(parent->children, new_capacity * sizeof(Component*));
        parent->child_capacity = new_capacity;
    }
    
    parent->children[parent->child_count++] = child;
    child->parent = parent;
    
    // Update native hierarchy
    if (g_renderer && g_renderer->add_child) {
        g_renderer->add_child(parent, child);
    }
}

// Style setters
void eghact_set_position(Component* component, float x, float y) {
    if (!component) return;
    component->style.x = x;
    component->style.y = y;
    g_renderer->update_layout(component);
}

void eghact_set_size(Component* component, float width, float height) {
    if (!component) return;
    component->style.width = width;
    component->style.height = height;
    g_renderer->update_layout(component);
}

void eghact_set_background_color(Component* component, uint32_t color) {
    if (!component) return;
    component->style.background_color = color;
    g_renderer->update_style(component);
}

void eghact_set_padding(Component* component, float top, float right, float bottom, float left) {
    if (!component) return;
    component->style.padding_top = top;
    component->style.padding_right = right;
    component->style.padding_bottom = bottom;
    component->style.padding_left = left;
    g_renderer->update_layout(component);
}

// Text-specific setters
void eghact_set_text(Component* component, const char* text) {
    if (!component || component->type != COMPONENT_TEXT) return;
    
    free(component->data.text_data.text);
    component->data.text_data.text = strdup(text);
    g_renderer->update_style(component);
}

void eghact_set_text_color(Component* component, uint32_t color) {
    if (!component || component->type != COMPONENT_TEXT) return;
    
    component->data.text_data.color = color;
    g_renderer->update_style(component);
}

void eghact_set_font_size(Component* component, float size) {
    if (!component || component->type != COMPONENT_TEXT) return;
    
    component->data.text_data.font_size = size;
    g_renderer->update_style(component);
}

// Layout engine - simplified flexbox-like layout
void eghact_layout_flex_row(Component* container, float spacing) {
    if (!container || container->child_count == 0) return;
    
    float x = container->style.padding_left;
    float y = container->style.padding_top;
    float available_width = container->style.width - container->style.padding_left - container->style.padding_right;
    
    for (size_t i = 0; i < container->child_count; i++) {
        Component* child = container->children[i];
        if (child->style.hidden) continue;
        
        eghact_set_position(child, x, y);
        x += child->style.width + spacing;
    }
}

void eghact_layout_flex_column(Component* container, float spacing) {
    if (!container || container->child_count == 0) return;
    
    float x = container->style.padding_left;
    float y = container->style.padding_top;
    
    for (size_t i = 0; i < container->child_count; i++) {
        Component* child = container->children[i];
        if (child->style.hidden) continue;
        
        eghact_set_position(child, x, y);
        y += child->style.height + spacing;
    }
}

// Destroy component and its children
void eghact_destroy_component(Component* component) {
    if (!component) return;
    
    // Destroy children first
    for (size_t i = 0; i < component->child_count; i++) {
        eghact_destroy_component(component->children[i]);
    }
    
    // Free component-specific data
    switch (component->type) {
        case COMPONENT_TEXT:
            free(component->data.text_data.text);
            break;
        case COMPONENT_IMAGE:
            free(component->data.image_data.src);
            break;
        case COMPONENT_BUTTON:
            free(component->data.button_data.title);
            break;
        case COMPONENT_INPUT:
            free(component->data.input_data.value);
            free(component->data.input_data.placeholder);
            break;
        default:
            break;
    }
    
    // Destroy native component
    if (g_renderer && g_renderer->destroy) {
        g_renderer->destroy(component);
    }
    
    free(component->id);
    free(component->children);
    free(component);
    
    g_runtime->component_count--;
}

// Run the app
void eghact_run(Component* root) {
    if (!g_runtime || !root) return;
    
    g_runtime->root = root;
    g_runtime->is_running = true;
    
    // Platform-specific run loop
    #ifdef PLATFORM_IOS
        eghact_ios_run_loop(g_runtime);
    #elif defined(PLATFORM_ANDROID)
        eghact_android_run_loop(g_runtime);
    #else
        // Default run loop for testing
        while (g_runtime->is_running) {
            // Process events, update, render
        }
    #endif
}

// Shutdown runtime
void eghact_shutdown() {
    if (!g_runtime) return;
    
    g_runtime->is_running = false;
    
    if (g_runtime->root) {
        eghact_destroy_component(g_runtime->root);
    }
    
    free(g_runtime);
    g_runtime = NULL;
}

// Export for WebAssembly
#ifdef __EMSCRIPTEN__
    #include <emscripten.h>
    
    EMSCRIPTEN_KEEPALIVE
    void* eghact_wasm_init() {
        return eghact_init();
    }
    
    EMSCRIPTEN_KEEPALIVE
    void* eghact_wasm_create_view() {
        return eghact_create_view();
    }
    
    EMSCRIPTEN_KEEPALIVE
    void* eghact_wasm_create_text(const char* text) {
        return eghact_create_text(text);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void eghact_wasm_add_child(void* parent, void* child) {
        eghact_add_child((Component*)parent, (Component*)child);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void eghact_wasm_set_position(void* component, float x, float y) {
        eghact_set_position((Component*)component, x, y);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void eghact_wasm_set_size(void* component, float width, float height) {
        eghact_set_size((Component*)component, width, height);
    }
#endif