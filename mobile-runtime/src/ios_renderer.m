/**
 * iOS Renderer for Eghact Native Mobile Runtime
 * Direct UIKit integration without React Native
 */

#import <UIKit/UIKit.h>
#import <Foundation/Foundation.h>
#include "core.h"

// Forward declarations
UIView* ios_create_view(Component* component);
UILabel* ios_create_text(Component* component);
UIImageView* ios_create_image(Component* component);
UIButton* ios_create_button(Component* component);
UITextField* ios_create_input(Component* component);
UIScrollView* ios_create_scroll(Component* component);
UITableView* ios_create_list(Component* component);

void ios_update_layout(Component* component);
void ios_update_style(Component* component);
void ios_add_child(Component* parent, Component* child);
void ios_remove_child(Component* parent, Component* child);
void ios_destroy(Component* component);

// Platform renderer implementation
static PlatformRenderer ios_renderer = {
    .create_view = (void*)ios_create_view,
    .create_text = (void*)ios_create_text,
    .create_image = (void*)ios_create_image,
    .create_button = (void*)ios_create_button,
    .create_input = (void*)ios_create_input,
    .create_scroll = (void*)ios_create_scroll,
    .create_list = (void*)ios_create_list,
    .update_layout = ios_update_layout,
    .update_style = ios_update_style,
    .add_child = ios_add_child,
    .remove_child = ios_remove_child,
    .destroy = ios_destroy
};

// Initialize iOS renderer
PlatformRenderer* eghact_ios_renderer_init() {
    return &ios_renderer;
}

// Helper to convert color
UIColor* color_from_uint32(uint32_t color) {
    float a = ((color >> 24) & 0xFF) / 255.0f;
    float r = ((color >> 16) & 0xFF) / 255.0f;
    float g = ((color >> 8) & 0xFF) / 255.0f;
    float b = (color & 0xFF) / 255.0f;
    return [UIColor colorWithRed:r green:g blue:b alpha:a];
}

// Create UIView
UIView* ios_create_view(Component* component) {
    UIView* view = [[UIView alloc] init];
    view.clipsToBounds = YES;
    return view;
}

// Create UILabel
UILabel* ios_create_text(Component* component) {
    UILabel* label = [[UILabel alloc] init];
    label.text = [NSString stringWithUTF8String:component->data.text_data.text];
    label.textColor = color_from_uint32(component->data.text_data.color);
    label.font = [UIFont systemFontOfSize:component->data.text_data.font_size];
    return label;
}

// Create UIImageView
UIImageView* ios_create_image(Component* component) {
    UIImageView* imageView = [[UIImageView alloc] init];
    
    NSString* src = [NSString stringWithUTF8String:component->data.image_data.src];
    if ([src hasPrefix:@"http"]) {
        // Load from URL
        NSURL* url = [NSURL URLWithString:src];
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
            NSData* data = [NSData dataWithContentsOfURL:url];
            UIImage* image = [UIImage imageWithData:data];
            dispatch_async(dispatch_get_main_queue(), ^{
                imageView.image = image;
            });
        });
    } else {
        // Load from bundle
        imageView.image = [UIImage imageNamed:src];
    }
    
    // Set content mode based on resize mode
    switch (component->data.image_data.resize_mode) {
        case 0: // cover
            imageView.contentMode = UIViewContentModeScaleAspectFill;
            break;
        case 1: // contain
            imageView.contentMode = UIViewContentModeScaleAspectFit;
            break;
        case 2: // stretch
            imageView.contentMode = UIViewContentModeScaleToFill;
            break;
        default:
            imageView.contentMode = UIViewContentModeScaleAspectFill;
    }
    
    return imageView;
}

// Create UIButton
UIButton* ios_create_button(Component* component) {
    UIButton* button = [UIButton buttonWithType:UIButtonTypeSystem];
    [button setTitle:[NSString stringWithUTF8String:component->data.button_data.title] 
            forState:UIControlStateNormal];
    
    // Store callback pointer in associated object
    if (component->data.button_data.on_press) {
        objc_setAssociatedObject(button, "eghact_callback", 
                                [NSValue valueWithPointer:component->data.button_data.on_press], 
                                OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        
        [button addTarget:button 
                   action:@selector(eghact_button_pressed:) 
         forControlEvents:UIControlEventTouchUpInside];
    }
    
    return button;
}

// Button callback handler
@implementation UIButton (EghactCallback)
- (void)eghact_button_pressed:(id)sender {
    NSValue* callbackValue = objc_getAssociatedObject(self, "eghact_callback");
    if (callbackValue) {
        void (*callback)(void) = [callbackValue pointerValue];
        if (callback) callback();
    }
}
@end

// Create UITextField
UITextField* ios_create_input(Component* component) {
    UITextField* textField = [[UITextField alloc] init];
    textField.text = [NSString stringWithUTF8String:component->data.input_data.value];
    textField.placeholder = [NSString stringWithUTF8String:component->data.input_data.placeholder];
    textField.borderStyle = UITextBorderStyleRoundedRect;
    
    // Add change handler if provided
    if (component->data.input_data.on_change) {
        objc_setAssociatedObject(textField, "eghact_component", 
                                [NSValue valueWithPointer:component], 
                                OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        
        [textField addTarget:textField 
                      action:@selector(eghact_text_changed:) 
            forControlEvents:UIControlEventEditingChanged];
    }
    
    return textField;
}

// Text field change handler
@implementation UITextField (EghactCallback)
- (void)eghact_text_changed:(id)sender {
    NSValue* componentValue = objc_getAssociatedObject(self, "eghact_component");
    if (componentValue) {
        Component* component = [componentValue pointerValue];
        if (component && component->data.input_data.on_change) {
            const char* text = [self.text UTF8String];
            component->data.input_data.on_change(text);
        }
    }
}
@end

// Create UIScrollView
UIScrollView* ios_create_scroll(Component* component) {
    UIScrollView* scrollView = [[UIScrollView alloc] init];
    scrollView.showsVerticalScrollIndicator = YES;
    scrollView.showsHorizontalScrollIndicator = NO;
    return scrollView;
}

// Create UITableView
UITableView* ios_create_list(Component* component) {
    UITableView* tableView = [[UITableView alloc] initWithFrame:CGRectZero 
                                                          style:UITableViewStylePlain];
    // Would need to implement data source and delegate
    return tableView;
}

// Update layout
void ios_update_layout(Component* component) {
    if (!component || !component->native_handle) return;
    
    UIView* view = (__bridge UIView*)component->native_handle;
    view.frame = CGRectMake(component->style.x, 
                           component->style.y,
                           component->style.width, 
                           component->style.height);
}

// Update style
void ios_update_style(Component* component) {
    if (!component || !component->native_handle) return;
    
    UIView* view = (__bridge UIView*)component->native_handle;
    
    // Background color
    view.backgroundColor = color_from_uint32(component->style.background_color);
    
    // Border
    view.layer.borderWidth = component->style.border_width;
    view.layer.borderColor = color_from_uint32(component->style.border_color).CGColor;
    view.layer.cornerRadius = component->style.border_radius;
    
    // Opacity
    view.alpha = component->style.opacity;
    view.hidden = component->style.hidden;
    
    // Component-specific updates
    switch (component->type) {
        case COMPONENT_TEXT: {
            UILabel* label = (UILabel*)view;
            label.text = [NSString stringWithUTF8String:component->data.text_data.text];
            label.textColor = color_from_uint32(component->data.text_data.color);
            label.font = [UIFont systemFontOfSize:component->data.text_data.font_size];
            break;
        }
        case COMPONENT_BUTTON: {
            UIButton* button = (UIButton*)view;
            [button setTitle:[NSString stringWithUTF8String:component->data.button_data.title] 
                    forState:UIControlStateNormal];
            break;
        }
        case COMPONENT_INPUT: {
            UITextField* textField = (UITextField*)view;
            textField.text = [NSString stringWithUTF8String:component->data.input_data.value];
            break;
        }
        default:
            break;
    }
}

// Add child
void ios_add_child(Component* parent, Component* child) {
    if (!parent || !child || !parent->native_handle || !child->native_handle) return;
    
    UIView* parentView = (__bridge UIView*)parent->native_handle;
    UIView* childView = (__bridge UIView*)child->native_handle;
    
    [parentView addSubview:childView];
}

// Remove child
void ios_remove_child(Component* parent, Component* child) {
    if (!parent || !child || !parent->native_handle || !child->native_handle) return;
    
    UIView* childView = (__bridge UIView*)child->native_handle;
    [childView removeFromSuperview];
}

// Destroy component
void ios_destroy(Component* component) {
    if (!component || !component->native_handle) return;
    
    UIView* view = (__bridge UIView*)component->native_handle;
    [view removeFromSuperview];
    
    // Clear associated objects
    if (component->type == COMPONENT_BUTTON) {
        objc_setAssociatedObject(view, "eghact_callback", nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    } else if (component->type == COMPONENT_INPUT) {
        objc_setAssociatedObject(view, "eghact_component", nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }
}

// iOS run loop
void eghact_ios_run_loop(EghactRuntime* runtime) {
    // This would typically be integrated with UIApplicationMain
    // For now, just ensure the root view is added to the window
    
    UIWindow* window = [UIApplication sharedApplication].keyWindow;
    if (!window) {
        window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
        window.backgroundColor = [UIColor whiteColor];
        [window makeKeyAndVisible];
    }
    
    if (runtime->root && runtime->root->native_handle) {
        UIView* rootView = (__bridge UIView*)runtime->root->native_handle;
        window.rootViewController = [[UIViewController alloc] init];
        window.rootViewController.view = rootView;
    }
}