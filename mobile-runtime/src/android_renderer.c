/**
 * Android Renderer for Eghact Native Mobile Runtime
 * JNI bridge to Android UI components
 */

#include <jni.h>
#include <android/log.h>
#include <stdlib.h>
#include <string.h>
#include "core.h"

#define LOG_TAG "EghactRuntime"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// JNI references
static JavaVM* g_jvm = NULL;
static jobject g_activity = NULL;
static jclass g_view_factory_class = NULL;
static jmethodID g_create_view_method = NULL;
static jmethodID g_create_text_method = NULL;
static jmethodID g_create_image_method = NULL;
static jmethodID g_create_button_method = NULL;
static jmethodID g_create_input_method = NULL;
static jmethodID g_create_scroll_method = NULL;
static jmethodID g_create_list_method = NULL;
static jmethodID g_update_layout_method = NULL;
static jmethodID g_update_style_method = NULL;
static jmethodID g_add_child_method = NULL;
static jmethodID g_remove_child_method = NULL;

// Get JNI environment
JNIEnv* get_jni_env() {
    JNIEnv* env;
    if ((*g_jvm)->GetEnv(g_jvm, (void**)&env, JNI_VERSION_1_6) != JNI_OK) {
        (*g_jvm)->AttachCurrentThread(g_jvm, &env, NULL);
    }
    return env;
}

// Convert C string to Java string
jstring to_jstring(JNIEnv* env, const char* str) {
    return (*env)->NewStringUTF(env, str ? str : "");
}

// Platform renderer functions
void* android_create_view(Component* component) {
    JNIEnv* env = get_jni_env();
    jobject view = (*env)->CallObjectMethod(env, g_activity, g_create_view_method);
    return (*env)->NewGlobalRef(env, view);
}

void* android_create_text(Component* component) {
    JNIEnv* env = get_jni_env();
    jstring text = to_jstring(env, component->data.text_data.text);
    jobject view = (*env)->CallObjectMethod(env, g_activity, g_create_text_method, text);
    (*env)->DeleteLocalRef(env, text);
    return (*env)->NewGlobalRef(env, view);
}

void* android_create_image(Component* component) {
    JNIEnv* env = get_jni_env();
    jstring src = to_jstring(env, component->data.image_data.src);
    jobject view = (*env)->CallObjectMethod(env, g_activity, g_create_image_method, src);
    (*env)->DeleteLocalRef(env, src);
    return (*env)->NewGlobalRef(env, view);
}

void* android_create_button(Component* component) {
    JNIEnv* env = get_jni_env();
    jstring title = to_jstring(env, component->data.button_data.title);
    jobject view = (*env)->CallObjectMethod(env, g_activity, g_create_button_method, title, (jlong)component);
    (*env)->DeleteLocalRef(env, title);
    return (*env)->NewGlobalRef(env, view);
}

void* android_create_input(Component* component) {
    JNIEnv* env = get_jni_env();
    jstring placeholder = to_jstring(env, component->data.input_data.placeholder);
    jobject view = (*env)->CallObjectMethod(env, g_activity, g_create_input_method, placeholder, (jlong)component);
    (*env)->DeleteLocalRef(env, placeholder);
    return (*env)->NewGlobalRef(env, view);
}

void* android_create_scroll(Component* component) {
    JNIEnv* env = get_jni_env();
    jobject view = (*env)->CallObjectMethod(env, g_activity, g_create_scroll_method);
    return (*env)->NewGlobalRef(env, view);
}

void* android_create_list(Component* component) {
    JNIEnv* env = get_jni_env();
    jobject view = (*env)->CallObjectMethod(env, g_activity, g_create_list_method);
    return (*env)->NewGlobalRef(env, view);
}

void android_update_layout(Component* component) {
    if (!component || !component->native_handle) return;
    
    JNIEnv* env = get_jni_env();
    jobject view = (jobject)component->native_handle;
    
    (*env)->CallVoidMethod(env, g_activity, g_update_layout_method, view,
                          (jfloat)component->style.x, (jfloat)component->style.y,
                          (jfloat)component->style.width, (jfloat)component->style.height);
}

void android_update_style(Component* component) {
    if (!component || !component->native_handle) return;
    
    JNIEnv* env = get_jni_env();
    jobject view = (jobject)component->native_handle;
    
    // Create style object with all properties
    jclass style_class = (*env)->FindClass(env, "com/eghact/runtime/Style");
    jmethodID style_constructor = (*env)->GetMethodID(env, style_class, "<init>", "()V");
    jobject style = (*env)->NewObject(env, style_class, style_constructor);
    
    // Set style properties
    jfieldID bgcolor_field = (*env)->GetFieldID(env, style_class, "backgroundColor", "I");
    (*env)->SetIntField(env, style, bgcolor_field, component->style.background_color);
    
    jfieldID opacity_field = (*env)->GetFieldID(env, style_class, "opacity", "F");
    (*env)->SetFloatField(env, style, opacity_field, component->style.opacity);
    
    // Update view with style
    (*env)->CallVoidMethod(env, g_activity, g_update_style_method, view, style);
    
    // Component-specific updates
    switch (component->type) {
        case COMPONENT_TEXT: {
            jmethodID set_text = (*env)->GetMethodID(env, (*env)->GetObjectClass(env, view), 
                                                     "setText", "(Ljava/lang/CharSequence;)V");
            jstring text = to_jstring(env, component->data.text_data.text);
            (*env)->CallVoidMethod(env, view, set_text, text);
            (*env)->DeleteLocalRef(env, text);
            break;
        }
        case COMPONENT_BUTTON: {
            jmethodID set_text = (*env)->GetMethodID(env, (*env)->GetObjectClass(env, view), 
                                                     "setText", "(Ljava/lang/CharSequence;)V");
            jstring text = to_jstring(env, component->data.button_data.title);
            (*env)->CallVoidMethod(env, view, set_text, text);
            (*env)->DeleteLocalRef(env, text);
            break;
        }
        default:
            break;
    }
    
    (*env)->DeleteLocalRef(env, style);
}

void android_add_child(Component* parent, Component* child) {
    if (!parent || !child || !parent->native_handle || !child->native_handle) return;
    
    JNIEnv* env = get_jni_env();
    jobject parent_view = (jobject)parent->native_handle;
    jobject child_view = (jobject)child->native_handle;
    
    (*env)->CallVoidMethod(env, g_activity, g_add_child_method, parent_view, child_view);
}

void android_remove_child(Component* parent, Component* child) {
    if (!parent || !child || !parent->native_handle || !child->native_handle) return;
    
    JNIEnv* env = get_jni_env();
    jobject parent_view = (jobject)parent->native_handle;
    jobject child_view = (jobject)child->native_handle;
    
    (*env)->CallVoidMethod(env, g_activity, g_remove_child_method, parent_view, child_view);
}

void android_destroy(Component* component) {
    if (!component || !component->native_handle) return;
    
    JNIEnv* env = get_jni_env();
    jobject view = (jobject)component->native_handle;
    
    // Remove from parent and clean up
    jclass view_class = (*env)->GetObjectClass(env, view);
    jmethodID get_parent = (*env)->GetMethodID(env, view_class, "getParent", "()Landroid/view/ViewParent;");
    jobject parent = (*env)->CallObjectMethod(env, view, get_parent);
    
    if (parent) {
        jclass view_group_class = (*env)->FindClass(env, "android/view/ViewGroup");
        jmethodID remove_view = (*env)->GetMethodID(env, view_group_class, "removeView", "(Landroid/view/View;)V");
        (*env)->CallVoidMethod(env, parent, remove_view, view);
    }
    
    (*env)->DeleteGlobalRef(env, view);
}

// Platform renderer implementation
static PlatformRenderer android_renderer = {
    .create_view = android_create_view,
    .create_text = android_create_text,
    .create_image = android_create_image,
    .create_button = android_create_button,
    .create_input = android_create_input,
    .create_scroll = android_create_scroll,
    .create_list = android_create_list,
    .update_layout = android_update_layout,
    .update_style = android_update_style,
    .add_child = android_add_child,
    .remove_child = android_remove_child,
    .destroy = android_destroy
};

// Initialize Android renderer
PlatformRenderer* eghact_android_renderer_init() {
    return &android_renderer;
}

// JNI initialization
JNIEXPORT void JNICALL
Java_com_eghact_runtime_EghactRuntime_nativeInit(JNIEnv* env, jobject activity) {
    (*env)->GetJavaVM(env, &g_jvm);
    g_activity = (*env)->NewGlobalRef(env, activity);
    
    // Cache method IDs
    jclass activity_class = (*env)->GetObjectClass(env, activity);
    g_create_view_method = (*env)->GetMethodID(env, activity_class, "createView", "()Landroid/view/View;");
    g_create_text_method = (*env)->GetMethodID(env, activity_class, "createText", "(Ljava/lang/String;)Landroid/widget/TextView;");
    g_create_image_method = (*env)->GetMethodID(env, activity_class, "createImage", "(Ljava/lang/String;)Landroid/widget/ImageView;");
    g_create_button_method = (*env)->GetMethodID(env, activity_class, "createButton", "(Ljava/lang/String;J)Landroid/widget/Button;");
    g_create_input_method = (*env)->GetMethodID(env, activity_class, "createInput", "(Ljava/lang/String;J)Landroid/widget/EditText;");
    g_create_scroll_method = (*env)->GetMethodID(env, activity_class, "createScroll", "()Landroid/widget/ScrollView;");
    g_create_list_method = (*env)->GetMethodID(env, activity_class, "createList", "()Landroid/widget/ListView;");
    g_update_layout_method = (*env)->GetMethodID(env, activity_class, "updateLayout", "(Landroid/view/View;FFFF)V");
    g_update_style_method = (*env)->GetMethodID(env, activity_class, "updateStyle", "(Landroid/view/View;Lcom/eghact/runtime/Style;)V");
    g_add_child_method = (*env)->GetMethodID(env, activity_class, "addChild", "(Landroid/view/ViewGroup;Landroid/view/View;)V");
    g_remove_child_method = (*env)->GetMethodID(env, activity_class, "removeChild", "(Landroid/view/ViewGroup;Landroid/view/View;)V");
    
    LOGI("Eghact Android Runtime initialized");
}

// Button click callback
JNIEXPORT void JNICALL
Java_com_eghact_runtime_EghactRuntime_onButtonClick(JNIEnv* env, jobject thiz, jlong component_ptr) {
    Component* component = (Component*)component_ptr;
    if (component && component->data.button_data.on_press) {
        component->data.button_data.on_press();
    }
}

// Input text change callback
JNIEXPORT void JNICALL
Java_com_eghact_runtime_EghactRuntime_onTextChanged(JNIEnv* env, jobject thiz, jlong component_ptr, jstring text) {
    Component* component = (Component*)component_ptr;
    if (component && component->data.input_data.on_change) {
        const char* text_str = (*env)->GetStringUTFChars(env, text, NULL);
        
        // Update component value
        free(component->data.input_data.value);
        component->data.input_data.value = strdup(text_str);
        
        // Call callback
        component->data.input_data.on_change(text_str);
        
        (*env)->ReleaseStringUTFChars(env, text, text_str);
    }
}

// Android run loop
void eghact_android_run_loop(EghactRuntime* runtime) {
    // The Android UI runs in the main thread managed by the Activity
    // This function would typically be called from the Activity's onCreate
    LOGI("Eghact Android run loop started");
}