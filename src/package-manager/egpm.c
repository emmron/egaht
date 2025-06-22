// EGPM - Eghact Package Manager
// Replacement for npm - Pure C implementation
// No Node.js or npm dependencies

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>
#include <json-c/json.h>
#include <zlib.h>
#include <tar.h>
#include "eghact-core.h"

#define REGISTRY_URL "https://registry.eghact.dev"
#define CACHE_DIR "~/.egpm/cache"
#define MODULES_DIR "egh_modules"

// Package metadata
typedef struct {
    char* name;
    char* version;
    char* description;
    char** dependencies;
    int num_dependencies;
    char* main;
    char* repository;
    char* author;
} PackageInfo;

// Dependency tree
typedef struct DependencyNode {
    PackageInfo* package;
    struct DependencyNode** dependencies;
    int num_dependencies;
    int installed;
} DependencyNode;

// Lock file entry
typedef struct {
    char* name;
    char* version;
    char* resolved;
    char* integrity;
    char** requires;
    int num_requires;
} LockEntry;

// Global state
typedef struct {
    char* working_dir;
    PackageInfo* current_package;
    DependencyNode* dep_tree;
    LockEntry** lock_entries;
    int num_lock_entries;
} EGPMState;

// HTTP request helper
typedef struct {
    char* data;
    size_t size;
} HTTPResponse;

size_t write_callback(void* contents, size_t size, size_t nmemb, void* userp) {
    size_t total_size = size * nmemb;
    HTTPResponse* response = (HTTPResponse*)userp;
    
    response->data = realloc(response->data, response->size + total_size + 1);
    memcpy(&(response->data[response->size]), contents, total_size);
    response->size += total_size;
    response->data[response->size] = 0;
    
    return total_size;
}

// Fetch package metadata from registry
PackageInfo* fetch_package_info(const char* name, const char* version) {
    CURL* curl = curl_easy_init();
    if (!curl) return NULL;
    
    char url[512];
    if (version) {
        snprintf(url, sizeof(url), "%s/%s/%s", REGISTRY_URL, name, version);
    } else {
        snprintf(url, sizeof(url), "%s/%s/latest", REGISTRY_URL, name);
    }
    
    HTTPResponse response = {0};
    
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
    
    CURLcode res = curl_easy_perform(curl);
    curl_easy_cleanup(curl);
    
    if (res != CURLE_OK) {
        if (response.data) free(response.data);
        return NULL;
    }
    
    // Parse JSON response
    PackageInfo* info = parse_package_json(response.data);
    free(response.data);
    
    return info;
}

// Parse package.json
PackageInfo* parse_package_json(const char* json_str) {
    json_object* root = json_tokener_parse(json_str);
    if (!root) return NULL;
    
    PackageInfo* info = malloc(sizeof(PackageInfo));
    
    // Extract fields
    json_object* obj;
    
    if (json_object_object_get_ex(root, "name", &obj)) {
        info->name = strdup(json_object_get_string(obj));
    }
    
    if (json_object_object_get_ex(root, "version", &obj)) {
        info->version = strdup(json_object_get_string(obj));
    }
    
    if (json_object_object_get_ex(root, "description", &obj)) {
        info->description = strdup(json_object_get_string(obj));
    }
    
    if (json_object_object_get_ex(root, "main", &obj)) {
        info->main = strdup(json_object_get_string(obj));
    }
    
    // Parse dependencies
    if (json_object_object_get_ex(root, "dependencies", &obj)) {
        json_object_object_foreach(obj, key, val) {
            info->num_dependencies++;
        }
        
        info->dependencies = malloc(sizeof(char*) * info->num_dependencies * 2);
        int i = 0;
        
        json_object_object_foreach(obj, key, val) {
            info->dependencies[i * 2] = strdup(key);
            info->dependencies[i * 2 + 1] = strdup(json_object_get_string(val));
            i++;
        }
    }
    
    json_object_put(root);
    return info;
}

// Install command
int egpm_install(EGPMState* state, const char* package_name, const char* version) {
    printf("Installing %s%s%s...\n", package_name, 
           version ? "@" : "", version ? version : "");
    
    // Fetch package info
    PackageInfo* info = fetch_package_info(package_name, version);
    if (!info) {
        fprintf(stderr, "Error: Package not found: %s\n", package_name);
        return 1;
    }
    
    // Build dependency tree
    DependencyNode* tree = build_dependency_tree(info);
    
    // Resolve version conflicts
    resolve_dependencies(tree);
    
    // Download and extract packages
    install_dependency_tree(tree);
    
    // Update package.json
    if (package_name) {
        add_to_package_json(state, package_name, info->version);
    }
    
    // Generate lock file
    generate_lock_file(state, tree);
    
    printf("✓ Installed %s@%s\n", info->name, info->version);
    
    return 0;
}

// Build dependency tree recursively
DependencyNode* build_dependency_tree(PackageInfo* info) {
    DependencyNode* node = malloc(sizeof(DependencyNode));
    node->package = info;
    node->installed = 0;
    node->num_dependencies = info->num_dependencies;
    node->dependencies = malloc(sizeof(DependencyNode*) * node->num_dependencies);
    
    for (int i = 0; i < info->num_dependencies; i++) {
        char* dep_name = info->dependencies[i * 2];
        char* dep_version = info->dependencies[i * 2 + 1];
        
        PackageInfo* dep_info = fetch_package_info(dep_name, dep_version);
        if (dep_info) {
            node->dependencies[i] = build_dependency_tree(dep_info);
        }
    }
    
    return node;
}

// Download and extract package
int download_and_extract(PackageInfo* info, const char* dest_dir) {
    char url[512];
    snprintf(url, sizeof(url), "%s/%s/-/%s-%s.tgz", 
             REGISTRY_URL, info->name, info->name, info->version);
    
    // Download tarball
    char tarball_path[PATH_MAX];
    snprintf(tarball_path, sizeof(tarball_path), "/tmp/%s-%s.tgz", 
             info->name, info->version);
    
    if (download_file(url, tarball_path) != 0) {
        return 1;
    }
    
    // Extract tarball
    char extract_cmd[512];
    snprintf(extract_cmd, sizeof(extract_cmd), 
             "tar -xzf %s -C %s --strip-components=1", 
             tarball_path, dest_dir);
    
    system(extract_cmd);
    unlink(tarball_path);
    
    return 0;
}

// Initialize new package
int egpm_init(EGPMState* state) {
    printf("Creating new Eghact package...\n");
    
    // Interactive prompts
    char name[256], version[32], description[512];
    
    printf("Package name: ");
    fgets(name, sizeof(name), stdin);
    name[strcspn(name, "\n")] = 0;
    
    printf("Version (1.0.0): ");
    fgets(version, sizeof(version), stdin);
    version[strcspn(version, "\n")] = 0;
    if (strlen(version) == 0) strcpy(version, "1.0.0");
    
    printf("Description: ");
    fgets(description, sizeof(description), stdin);
    description[strcspn(description, "\n")] = 0;
    
    // Create package.json
    json_object* package_json = json_object_new_object();
    json_object_object_add(package_json, "name", json_object_new_string(name));
    json_object_object_add(package_json, "version", json_object_new_string(version));
    json_object_object_add(package_json, "description", json_object_new_string(description));
    json_object_object_add(package_json, "main", json_object_new_string("index.js"));
    json_object_object_add(package_json, "dependencies", json_object_new_object());
    
    // Write file
    FILE* f = fopen("package.json", "w");
    fprintf(f, "%s\n", json_object_to_json_string_ext(package_json, 
            JSON_C_TO_STRING_PRETTY));
    fclose(f);
    
    json_object_put(package_json);
    
    printf("✓ Created package.json\n");
    return 0;
}

// Run scripts
int egpm_run(EGPMState* state, const char* script_name) {
    // Read package.json
    PackageInfo* info = read_package_json("package.json");
    if (!info) {
        fprintf(stderr, "Error: No package.json found\n");
        return 1;
    }
    
    // Find script
    json_object* package_json = json_object_from_file("package.json");
    json_object* scripts;
    
    if (!json_object_object_get_ex(package_json, "scripts", &scripts)) {
        fprintf(stderr, "Error: No scripts defined\n");
        return 1;
    }
    
    json_object* script_obj;
    if (!json_object_object_get_ex(scripts, script_name, &script_obj)) {
        fprintf(stderr, "Error: Script '%s' not found\n", script_name);
        return 1;
    }
    
    const char* script_cmd = json_object_get_string(script_obj);
    
    // Set up environment
    setenv("PATH", "./egh_modules/.bin:/usr/local/bin:/usr/bin:/bin", 1);
    
    // Execute script
    printf("> %s\n", script_cmd);
    int result = system(script_cmd);
    
    json_object_put(package_json);
    return result;
}

// Publish package
int egpm_publish(EGPMState* state) {
    printf("Publishing package...\n");
    
    // Read package.json
    PackageInfo* info = read_package_json("package.json");
    if (!info) {
        fprintf(stderr, "Error: No package.json found\n");
        return 1;
    }
    
    // Create tarball
    char tarball_name[256];
    snprintf(tarball_name, sizeof(tarball_name), "%s-%s.tgz", 
             info->name, info->version);
    
    char tar_cmd[512];
    snprintf(tar_cmd, sizeof(tar_cmd), 
             "tar -czf %s --exclude=egh_modules --exclude=.git .", 
             tarball_name);
    
    system(tar_cmd);
    
    // Upload to registry
    char url[512];
    snprintf(url, sizeof(url), "%s/%s", REGISTRY_URL, info->name);
    
    if (upload_file(url, tarball_name, info) != 0) {
        unlink(tarball_name);
        return 1;
    }
    
    unlink(tarball_name);
    printf("✓ Published %s@%s\n", info->name, info->version);
    
    return 0;
}

// CLI entry point
int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("EGPM - Eghact Package Manager v1.0.0\n\n");
        printf("Usage: egpm <command> [options]\n\n");
        printf("Commands:\n");
        printf("  init              Create a new package.json\n");
        printf("  install [pkg]     Install dependencies\n");
        printf("  run <script>      Run a script\n");
        printf("  publish           Publish package to registry\n");
        printf("  search <query>    Search packages\n");
        printf("  info <pkg>        Show package info\n");
        return 0;
    }
    
    EGPMState state = {0};
    state.working_dir = getcwd(NULL, 0);
    
    int result = 0;
    
    if (strcmp(argv[1], "init") == 0) {
        result = egpm_init(&state);
    } else if (strcmp(argv[1], "install") == 0 || strcmp(argv[1], "i") == 0) {
        if (argc > 2) {
            // Install specific package
            char* pkg = argv[2];
            char* version = strchr(pkg, '@');
            if (version) {
                *version = '\0';
                version++;
            }
            result = egpm_install(&state, pkg, version);
        } else {
            // Install from package.json
            result = egpm_install(&state, NULL, NULL);
        }
    } else if (strcmp(argv[1], "run") == 0) {
        if (argc < 3) {
            fprintf(stderr, "Error: Script name required\n");
            result = 1;
        } else {
            result = egpm_run(&state, argv[2]);
        }
    } else if (strcmp(argv[1], "publish") == 0) {
        result = egpm_publish(&state);
    } else {
        fprintf(stderr, "Error: Unknown command '%s'\n", argv[1]);
        result = 1;
    }
    
    free(state.working_dir);
    return result;
}