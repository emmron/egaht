cmake_minimum_required(VERSION 3.10)
project(EghactMobileRuntime C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
    src/core.c
)

# Headers
set(HEADERS
    src/core.h
)

# Platform-specific sources
if(IOS)
    enable_language(OBJC)
    list(APPEND SOURCES src/ios_renderer.m)
    set(CMAKE_OSX_SYSROOT iphoneos)
    set(CMAKE_OSX_ARCHITECTURES "arm64")
    
    # iOS frameworks
    find_library(UIKIT UIKit)
    find_library(FOUNDATION Foundation)
    set(PLATFORM_LIBS ${UIKIT} ${FOUNDATION})
    
elseif(ANDROID)
    list(APPEND SOURCES src/android_renderer.c)
    
    # Android NDK settings
    set(CMAKE_SYSTEM_NAME Android)
    set(CMAKE_ANDROID_ARCH_ABI arm64-v8a)
    set(CMAKE_ANDROID_STL_TYPE c++_static)
    
    # JNI
    find_package(JNI REQUIRED)
    include_directories(${JNI_INCLUDE_DIRS})
    set(PLATFORM_LIBS ${JNI_LIBRARIES} log)
    
else()
    # Default/testing renderer
    list(APPEND SOURCES src/default_renderer.c)
    set(PLATFORM_LIBS)
endif()

# WebAssembly support
if(EMSCRIPTEN)
    set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} -s WASM=1 -s EXPORTED_FUNCTIONS='[\"_eghact_wasm_init\",\"_eghact_wasm_create_view\",\"_eghact_wasm_create_text\",\"_eghact_wasm_add_child\",\"_eghact_wasm_set_position\",\"_eghact_wasm_set_size\"]' -s EXTRA_EXPORTED_RUNTIME_METHODS='[\"ccall\",\"cwrap\"]'")
endif()

# Create library
add_library(eghact_mobile STATIC ${SOURCES} ${HEADERS})

# Link platform-specific libraries
target_link_libraries(eghact_mobile ${PLATFORM_LIBS})

# Public headers
target_include_directories(eghact_mobile PUBLIC src)

# iOS Framework
if(IOS)
    set_target_properties(eghact_mobile PROPERTIES
        FRAMEWORK TRUE
        FRAMEWORK_VERSION A
        MACOSX_FRAMEWORK_IDENTIFIER com.eghact.runtime
        PUBLIC_HEADER "${HEADERS}"
    )
endif()

# Android AAR
if(ANDROID)
    # Generate JNI headers
    add_custom_command(
        TARGET eghact_mobile POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy
        $<TARGET_FILE:eghact_mobile>
        ${CMAKE_CURRENT_SOURCE_DIR}/android/src/main/jniLibs/${CMAKE_ANDROID_ARCH_ABI}/
    )
endif()

# Example app
if(BUILD_EXAMPLES)
    add_subdirectory(examples)
endif()

# Tests
if(BUILD_TESTS)
    enable_testing()
    add_subdirectory(tests)
endif()