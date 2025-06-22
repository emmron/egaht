/**
 * Counter App Example
 * Demonstrates Eghact Native Mobile Runtime without React Native
 */

#include <stdio.h>
#include "core.h"

// Global counter state
static int counter = 0;
static Component* counter_label = NULL;

// Button click handler
void on_increment_click() {
    counter++;
    
    // Update counter display
    char text[32];
    snprintf(text, sizeof(text), "Count: %d", counter);
    eghact_set_text(counter_label, text);
    
    printf("Counter incremented to: %d\n", counter);
}

void on_decrement_click() {
    counter--;
    
    // Update counter display
    char text[32];
    snprintf(text, sizeof(text), "Count: %d", counter);
    eghact_set_text(counter_label, text);
    
    printf("Counter decremented to: %d\n", counter);
}

Component* create_counter_app() {
    // Create root container
    Component* root = eghact_create_view();
    eghact_set_size(root, 375, 667);  // iPhone 8 size
    eghact_set_background_color(root, EGHACT_COLOR_WHITE);
    eghact_set_padding(root, 20, 20, 20, 20);
    
    // Create title
    Component* title = eghact_create_text("Eghact Counter App");
    eghact_set_size(title, 335, 40);
    eghact_set_text_color(title, EGHACT_COLOR_BLACK);
    eghact_set_font_size(title, 24);
    eghact_add_child(root, title);
    
    // Create counter display
    counter_label = eghact_create_text("Count: 0");
    eghact_set_position(counter_label, 20, 80);
    eghact_set_size(counter_label, 335, 60);
    eghact_set_text_color(counter_label, EGHACT_COLOR_BLACK);
    eghact_set_font_size(counter_label, 36);
    eghact_set_background_color(counter_label, EGHACT_COLOR_RGB(240, 240, 240));
    eghact_set_padding(counter_label, 10, 10, 10, 10);
    eghact_add_child(root, counter_label);
    
    // Create button container
    Component* button_container = eghact_create_view();
    eghact_set_position(button_container, 20, 160);
    eghact_set_size(button_container, 335, 50);
    eghact_add_child(root, button_container);
    
    // Create increment button
    Component* increment_btn = eghact_create_button("Increment", on_increment_click);
    eghact_set_size(increment_btn, 160, 50);
    eghact_set_background_color(increment_btn, EGHACT_COLOR_GREEN);
    eghact_add_child(button_container, increment_btn);
    
    // Create decrement button
    Component* decrement_btn = eghact_create_button("Decrement", on_decrement_click);
    eghact_set_position(decrement_btn, 175, 0);
    eghact_set_size(decrement_btn, 160, 50);
    eghact_set_background_color(decrement_btn, EGHACT_COLOR_RED);
    eghact_add_child(button_container, decrement_btn);
    
    // Create info text
    Component* info = eghact_create_text("Pure C implementation - No React Native!");
    eghact_set_position(info, 20, 230);
    eghact_set_size(info, 335, 30);
    eghact_set_text_color(info, EGHACT_COLOR_RGB(100, 100, 100));
    eghact_set_font_size(info, 14);
    eghact_add_child(root, info);
    
    return root;
}

int main() {
    printf("Starting Eghact Counter App...\n");
    
    // Initialize runtime
    EghactRuntime* runtime = eghact_init();
    
    // Create app UI
    Component* app = create_counter_app();
    
    // Run the app
    eghact_run(app);
    
    // Cleanup
    eghact_shutdown();
    
    return 0;
}