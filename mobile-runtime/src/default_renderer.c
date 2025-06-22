/**
 * Default Renderer for Eghact Native Mobile Runtime
 * Used for testing and development on desktop platforms
 */

#include <stdio.h>
#include <stdlib.h>
#include "core.h"

// Mock implementations for testing
void* default_create_view(Component* component) {
    printf("[DEFAULT] Creating view component\n");
    return (void*)1; // Mock handle
}

void* default_create_text(Component* component) {
    printf("[DEFAULT] Creating text component: %s\n", component->data.text_data.text);
    return (void*)2;
}

void* default_create_image(Component* component) {
    printf("[DEFAULT] Creating image component: %s\n", component->data.image_data.src);
    return (void*)3;
}

void* default_create_button(Component* component) {
    printf("[DEFAULT] Creating button component: %s\n", component->data.button_data.title);
    return (void*)4;
}

void* default_create_input(Component* component) {
    printf("[DEFAULT] Creating input component: %s\n", component->data.input_data.placeholder);
    return (void*)5;
}

void* default_create_scroll(Component* component) {
    printf("[DEFAULT] Creating scroll component\n");
    return (void*)6;
}

void* default_create_list(Component* component) {
    printf("[DEFAULT] Creating list component\n");
    return (void*)7;
}

void default_update_layout(Component* component) {
    printf("[DEFAULT] Updating layout: x=%.0f, y=%.0f, w=%.0f, h=%.0f\n",
           component->style.x, component->style.y,
           component->style.width, component->style.height);
}

void default_update_style(Component* component) {
    printf("[DEFAULT] Updating style for component type %d\n", component->type);
}

void default_add_child(Component* parent, Component* child) {
    printf("[DEFAULT] Adding child (type %d) to parent (type %d)\n", 
           child->type, parent->type);
}

void default_remove_child(Component* parent, Component* child) {
    printf("[DEFAULT] Removing child (type %d) from parent (type %d)\n", 
           child->type, parent->type);
}

void default_destroy(Component* component) {
    printf("[DEFAULT] Destroying component type %d\n", component->type);
}

// Platform renderer implementation
static PlatformRenderer default_renderer = {
    .create_view = default_create_view,
    .create_text = default_create_text,
    .create_image = default_create_image,
    .create_button = default_create_button,
    .create_input = default_create_input,
    .create_scroll = default_create_scroll,
    .create_list = default_create_list,
    .update_layout = default_update_layout,
    .update_style = default_update_style,
    .add_child = default_add_child,
    .remove_child = default_remove_child,
    .destroy = default_destroy
};

PlatformRenderer* eghact_default_renderer_init() {
    printf("[DEFAULT] Initializing default renderer\n");
    return &default_renderer;
}