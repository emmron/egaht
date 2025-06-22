/**
 * Eghact Native Mobile Runtime - Header
 * Public API for the native mobile runtime
 */

#ifndef EGHACT_CORE_H
#define EGHACT_CORE_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

// Forward declarations
typedef struct Component Component;
typedef struct EghactRuntime EghactRuntime;
typedef struct PlatformRenderer PlatformRenderer;

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

// Runtime functions
EghactRuntime* eghact_init(void);
void eghact_run(Component* root);
void eghact_shutdown(void);

// Component creation
Component* eghact_create_view(void);
Component* eghact_create_text(const char* text);
Component* eghact_create_image(const char* src);
Component* eghact_create_button(const char* title, void (*on_press)(void));
Component* eghact_create_input(const char* placeholder);
Component* eghact_create_scroll(void);
Component* eghact_create_list(void);

// Component manipulation
void eghact_add_child(Component* parent, Component* child);
void eghact_remove_child(Component* parent, Component* child);
void eghact_destroy_component(Component* component);

// Style setters
void eghact_set_position(Component* component, float x, float y);
void eghact_set_size(Component* component, float width, float height);
void eghact_set_background_color(Component* component, uint32_t color);
void eghact_set_padding(Component* component, float top, float right, float bottom, float left);
void eghact_set_margin(Component* component, float top, float right, float bottom, float left);
void eghact_set_border(Component* component, float width, uint32_t color, float radius);
void eghact_set_opacity(Component* component, float opacity);
void eghact_set_hidden(Component* component, bool hidden);

// Text-specific functions
void eghact_set_text(Component* component, const char* text);
void eghact_set_text_color(Component* component, uint32_t color);
void eghact_set_font_size(Component* component, float size);

// Input-specific functions
void eghact_set_input_value(Component* component, const char* value);
void eghact_set_input_placeholder(Component* component, const char* placeholder);
void eghact_set_input_change_handler(Component* component, void (*on_change)(const char*));

// Layout helpers
void eghact_layout_flex_row(Component* container, float spacing);
void eghact_layout_flex_column(Component* container, float spacing);
void eghact_layout_center(Component* container);

// Color helpers
#define EGHACT_COLOR_RGBA(r, g, b, a) (((a) << 24) | ((r) << 16) | ((g) << 8) | (b))
#define EGHACT_COLOR_RGB(r, g, b) EGHACT_COLOR_RGBA(r, g, b, 255)
#define EGHACT_COLOR_BLACK EGHACT_COLOR_RGB(0, 0, 0)
#define EGHACT_COLOR_WHITE EGHACT_COLOR_RGB(255, 255, 255)
#define EGHACT_COLOR_RED EGHACT_COLOR_RGB(255, 0, 0)
#define EGHACT_COLOR_GREEN EGHACT_COLOR_RGB(0, 255, 0)
#define EGHACT_COLOR_BLUE EGHACT_COLOR_RGB(0, 0, 255)
#define EGHACT_COLOR_TRANSPARENT EGHACT_COLOR_RGBA(0, 0, 0, 0)

// Platform-specific renderer initialization (internal use)
extern PlatformRenderer* eghact_ios_renderer_init(void);
extern PlatformRenderer* eghact_android_renderer_init(void);
extern PlatformRenderer* eghact_default_renderer_init(void);

// Platform-specific run loops (internal use)
extern void eghact_ios_run_loop(EghactRuntime* runtime);
extern void eghact_android_run_loop(EghactRuntime* runtime);

#ifdef __cplusplus
}
#endif

#endif // EGHACT_CORE_H
