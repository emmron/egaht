#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>

// Eghact Component Generator in Pure C
// Compiles to WebAssembly for ultimate decoupling

typedef struct {
    char* name;
    char* type;
    char* default_value;
} Prop;

typedef struct {
    char* name;
    char* initial_value;
} StateVar;

typedef struct {
    char* name;
    char* body;
} Handler;

typedef struct {
    char* component_type;
    Prop props[10];
    int prop_count;
    StateVar state_vars[10];
    int state_count;
    Handler handlers[10];
    int handler_count;
    char* reactive[10];
    int reactive_count;
} ComponentSpec;

// String utilities
char* str_lowercase(const char* str) {
    char* result = malloc(strlen(str) + 1);
    int i = 0;
    while (str[i]) {
        result[i] = tolower(str[i]);
        i++;
    }
    result[i] = '\0';
    return result;
}

int str_contains(const char* haystack, const char* needle) {
    char* lower_haystack = str_lowercase(haystack);
    char* lower_needle = str_lowercase(needle);
    int found = strstr(lower_haystack, lower_needle) != NULL;
    free(lower_haystack);
    free(lower_needle);
    return found;
}

// Component analysis
ComponentSpec* analyze_prompt(const char* prompt) {
    ComponentSpec* spec = calloc(1, sizeof(ComponentSpec));
    
    // Detect component type
    if (str_contains(prompt, "button")) {
        spec->component_type = "button";
        spec->props[spec->prop_count++] = (Prop){"label", "string", "Click me"};
        spec->state_vars[spec->state_count++] = (StateVar){"clickCount", "0"};
        spec->reactive[spec->reactive_count++] = "$: isEven = clickCount % 2 === 0;";
        spec->handlers[spec->handler_count++] = (Handler){"handleClick", "clickCount++;"};
    }
    else if (str_contains(prompt, "counter")) {
        spec->component_type = "counter";
        spec->props[spec->prop_count++] = (Prop){"initialValue", "number", "0"};
        spec->state_vars[spec->state_count++] = (StateVar){"count", "initialValue"};
        spec->reactive[spec->reactive_count++] = "$: doubled = count * 2;";
        spec->reactive[spec->reactive_count++] = "$: factorial = count <= 1 ? 1 : count * factorial(count - 1);";
        spec->handlers[spec->handler_count++] = (Handler){"increment", "count++;"};
        spec->handlers[spec->handler_count++] = (Handler){"decrement", "count--;"};
    }
    else if (str_contains(prompt, "list") || str_contains(prompt, "todo")) {
        spec->component_type = "list";
        spec->props[spec->prop_count++] = (Prop){"title", "string", "Todo List"};
        spec->state_vars[spec->state_count++] = (StateVar){"items", "[]"};
        spec->state_vars[spec->state_count++] = (StateVar){"newItem", "\"\""};
        spec->reactive[spec->reactive_count++] = "$: isEmpty = items.length === 0;";
        spec->reactive[spec->reactive_count++] = "$: itemCount = items.length;";
        spec->handlers[spec->handler_count++] = (Handler){
            "addItem", 
            "if (newItem.trim()) { items = [...items, {id: Date.now(), text: newItem}]; newItem = ''; }"
        };
        spec->handlers[spec->handler_count++] = (Handler){
            "removeItem",
            "items = items.filter(item => item.id !== id);"
        };
    }
    else if (str_contains(prompt, "form")) {
        spec->component_type = "form";
        spec->state_vars[spec->state_count++] = (StateVar){"formData", "{}"};
        spec->state_vars[spec->state_count++] = (StateVar){"errors", "{}"};
        spec->state_vars[spec->state_count++] = (StateVar){"isSubmitting", "false"};
        spec->reactive[spec->reactive_count++] = "$: isValid = Object.keys(errors).length === 0;";
        spec->handlers[spec->handler_count++] = (Handler){
            "handleSubmit",
            "if (isValid) { isSubmitting = true; /* submit */ }"
        };
    }
    else {
        spec->component_type = "div";
        spec->props[spec->prop_count++] = (Prop){"content", "string", "Component"};
    }
    
    return spec;
}

// Component generation
char* generate_egh_component(ComponentSpec* spec) {
    char* buffer = malloc(8192); // 8KB should be enough
    int pos = 0;
    
    // Start component
    pos += sprintf(buffer + pos, "<component>\n");
    
    // Props
    for (int i = 0; i < spec->prop_count; i++) {
        pos += sprintf(buffer + pos, "  <prop name=\"%s\" type=\"%s\" default=\"%s\" />\n",
                      spec->props[i].name, spec->props[i].type, spec->props[i].default_value);
    }
    
    // State
    if (spec->state_count > 0) {
        pos += sprintf(buffer + pos, "\n  <state>\n");
        for (int i = 0; i < spec->state_count; i++) {
            pos += sprintf(buffer + pos, "    let %s = %s;\n",
                          spec->state_vars[i].name, spec->state_vars[i].initial_value);
        }
        pos += sprintf(buffer + pos, "  </state>\n");
    }
    
    // Reactive
    for (int i = 0; i < spec->reactive_count; i++) {
        pos += sprintf(buffer + pos, "\n  %s\n", spec->reactive[i]);
    }
    
    // Handlers
    for (int i = 0; i < spec->handler_count; i++) {
        pos += sprintf(buffer + pos, "\n  const %s = () => {\n    %s\n  };\n",
                      spec->handlers[i].name, spec->handlers[i].body);
    }
    
    // Template
    pos += sprintf(buffer + pos, "\n  <template>\n");
    
    if (strcmp(spec->component_type, "button") == 0) {
        pos += sprintf(buffer + pos, 
            "    <button @click=\"handleClick\" class:even={isEven}>\n"
            "      {label} ({clickCount})\n"
            "    </button>\n");
    }
    else if (strcmp(spec->component_type, "counter") == 0) {
        pos += sprintf(buffer + pos,
            "    <div class=\"counter\">\n"
            "      <h2>Count: {count}</h2>\n"
            "      <p>Doubled: {doubled}</p>\n"
            "      <p>Factorial: {factorial}</p>\n"
            "      <button @click=\"decrement\">-</button>\n"
            "      <button @click=\"increment\">+</button>\n"
            "    </div>\n");
    }
    else if (strcmp(spec->component_type, "list") == 0) {
        pos += sprintf(buffer + pos,
            "    <div class=\"list\">\n"
            "      <h1>{title}</h1>\n"
            "      <input value={newItem} @input=\"(e) => newItem = e.target.value\" />\n"
            "      <button @click=\"addItem\">Add</button>\n"
            "      #if (isEmpty)\n"
            "        <p>No items yet</p>\n"
            "      #else\n"
            "        <ul>\n"
            "          #each (items as item)\n"
            "            <li key={item.id}>\n"
            "              {item.text}\n"
            "              <button @click=\"() => removeItem(item.id)\">×</button>\n"
            "            </li>\n"
            "          #/each\n"
            "        </ul>\n"
            "      #/if\n"
            "    </div>\n");
    }
    else {
        pos += sprintf(buffer + pos, "    <div>{content}</div>\n");
    }
    
    pos += sprintf(buffer + pos, "  </template>\n");
    
    // Style
    pos += sprintf(buffer + pos, "\n  <style>\n");
    pos += sprintf(buffer + pos, "    .%s { padding: 20px; }\n", spec->component_type);
    pos += sprintf(buffer + pos, "  </style>\n");
    
    // End component
    pos += sprintf(buffer + pos, "</component>");
    
    return buffer;
}

// WebAssembly exports
#ifdef __EMSCRIPTEN__
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
char* generate_component_wasm(const char* prompt) {
    ComponentSpec* spec = analyze_prompt(prompt);
    char* component = generate_egh_component(spec);
    free(spec);
    return component;
}

EMSCRIPTEN_KEEPALIVE
void free_string(char* str) {
    free(str);
}
#endif

// Standalone CLI
#ifndef __EMSCRIPTEN__
int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("Usage: %s \"component description\"\n", argv[0]);
        return 1;
    }
    
    ComponentSpec* spec = analyze_prompt(argv[1]);
    char* component = generate_egh_component(spec);
    
    printf("%s\n", component);
    
    free(component);
    free(spec);
    return 0;
}
#endif