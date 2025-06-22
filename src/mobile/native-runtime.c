// Eghact Native Mobile Runtime
// Compiles Eghact components directly to native iOS/Android code
// No React Native or Node.js dependencies

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "eghact-core.h"

#ifdef __APPLE__
    #include <objc/runtime.h>
    #include <objc/message.h>
    #define PLATFORM_IOS
#endif

#ifdef __ANDROID__
    #include <jni.h>
    #define PLATFORM_ANDROID
#endif

// Component structure for native rendering
typedef struct {
    char* type;
    void* native_view;
    struct EghactComponent* children;
    size_t child_count;
    void (*render)(void*);
} EghactNativeComponent;

// Native view creation for iOS
#ifdef PLATFORM_IOS
void* create_ios_view(const char* type) {
    if (strcmp(type, "view") == 0) {
        // Create UIView
        Class UIViewClass = objc_getClass("UIView");
        return objc_msgSend(objc_msgSend(UIViewClass, sel_getUid("alloc")), sel_getUid("init"));
    } else if (strcmp(type, "text") == 0) {
        // Create UILabel
        Class UILabelClass = objc_getClass("UILabel");
        return objc_msgSend(objc_msgSend(UILabelClass, sel_getUid("alloc")), sel_getUid("init"));
    } else if (strcmp(type, "button") == 0) {
        // Create UIButton
        Class UIButtonClass = objc_getClass("UIButton");
        return objc_msgSend(UIButtonClass, sel_getUid("buttonWithType:"), 1);
    }
    return NULL;
}
#endif

// Native view creation for Android
#ifdef PLATFORM_ANDROID
void* create_android_view(JNIEnv* env, const char* type) {
    jclass viewClass;
    
    if (strcmp(type, "view") == 0) {
        viewClass = (*env)->FindClass(env, "android/view/View");
    } else if (strcmp(type, "text") == 0) {
        viewClass = (*env)->FindClass(env, "android/widget/TextView");
    } else if (strcmp(type, "button") == 0) {
        viewClass = (*env)->FindClass(env, "android/widget/Button");
    } else {
        return NULL;
    }
    
    jmethodID constructor = (*env)->GetMethodID(env, viewClass, "<init>", "(Landroid/content/Context;)V");
    jobject context = get_android_context(); // Implementation needed
    return (*env)->NewObject(env, viewClass, constructor, context);
}
#endif

// Cross-platform component creation
EghactNativeComponent* eghact_create_native_component(const char* type) {
    EghactNativeComponent* component = malloc(sizeof(EghactNativeComponent));
    component->type = strdup(type);
    component->children = NULL;
    component->child_count = 0;
    
    #ifdef PLATFORM_IOS
    component->native_view = create_ios_view(type);
    #endif
    
    #ifdef PLATFORM_ANDROID
    JNIEnv* env = get_jni_env(); // Implementation needed
    component->native_view = create_android_view(env, type);
    #endif
    
    return component;
}

// Gesture handling
typedef struct {
    void (*on_tap)(void*);
    void (*on_swipe)(void*, float dx, float dy);
    void (*on_long_press)(void*);
} EghactGestureHandlers;

void eghact_add_gesture_handler(EghactNativeComponent* component, EghactGestureHandlers* handlers) {
    #ifdef PLATFORM_IOS
    // Add iOS gesture recognizers
    if (handlers->on_tap) {
        Class tapClass = objc_getClass("UITapGestureRecognizer");
        void* tapGesture = objc_msgSend(objc_msgSend(tapClass, sel_getUid("alloc")), 
                                       sel_getUid("initWithTarget:action:"), 
                                       component, sel_getUid("handleTap:"));
        objc_msgSend(component->native_view, sel_getUid("addGestureRecognizer:"), tapGesture);
    }
    #endif
    
    #ifdef PLATFORM_ANDROID
    // Add Android touch listeners
    JNIEnv* env = get_jni_env();
    jclass viewClass = (*env)->GetObjectClass(env, component->native_view);
    jmethodID setOnClickListener = (*env)->GetMethodID(env, viewClass, 
                                                       "setOnClickListener", 
                                                       "(Landroid/view/View$OnClickListener;)V");
    // Implementation needed for listener creation
    #endif
}

// Native animation system
typedef struct {
    float duration;
    float from_value;
    float to_value;
    char* property;
    void (*completion)(void);
} EghactAnimation;

void eghact_animate(EghactNativeComponent* component, EghactAnimation* animation) {
    #ifdef PLATFORM_IOS
    // Use Core Animation
    Class CABasicAnimation = objc_getClass("CABasicAnimation");
    void* anim = objc_msgSend(CABasicAnimation, sel_getUid("animationWithKeyPath:"), 
                             animation->property);
    
    objc_msgSend(anim, sel_getUid("setDuration:"), animation->duration);
    objc_msgSend(anim, sel_getUid("setFromValue:"), animation->from_value);
    objc_msgSend(anim, sel_getUid("setToValue:"), animation->to_value);
    
    void* layer = objc_msgSend(component->native_view, sel_getUid("layer"));
    objc_msgSend(layer, sel_getUid("addAnimation:forKey:"), anim, animation->property);
    #endif
    
    #ifdef PLATFORM_ANDROID
    // Use Android property animators
    JNIEnv* env = get_jni_env();
    jclass animatorClass = (*env)->FindClass(env, "android/animation/ObjectAnimator");
    // Implementation for Android animations
    #endif
}

// Export functions for WASM compilation
#ifdef __EMSCRIPTEN__
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
void* create_component(const char* type) {
    return eghact_create_native_component(type);
}

EMSCRIPTEN_KEEPALIVE
void animate_component(void* component, const char* property, float from, float to, float duration) {
    EghactAnimation anim = {
        .duration = duration,
        .from_value = from,
        .to_value = to,
        .property = (char*)property,
        .completion = NULL
    };
    eghact_animate((EghactNativeComponent*)component, &anim);
}
#endif