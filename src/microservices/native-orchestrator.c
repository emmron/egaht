// Eghact Native Microservice Orchestrator
// Pure C/WASM implementation for distributed Eghact applications
// No Kubernetes or Docker dependencies

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include "eghact-core.h"

// Service registry
typedef struct ServiceNode {
    char* service_id;
    char* service_name;
    char* host;
    int port;
    int health_status;
    int load;
    struct ServiceNode* next;
} ServiceNode;

typedef struct {
    ServiceNode* services;
    pthread_mutex_t lock;
    int num_services;
} ServiceRegistry;

// Message queue for inter-service communication
typedef struct Message {
    char* from_service;
    char* to_service;
    char* payload;
    int priority;
    struct Message* next;
} Message;

typedef struct {
    Message* head;
    Message* tail;
    pthread_mutex_t lock;
    pthread_cond_t not_empty;
} MessageQueue;

// Load balancer
typedef enum {
    LB_ROUND_ROBIN,
    LB_LEAST_CONNECTIONS,
    LB_WEIGHTED,
    LB_IP_HASH
} LoadBalancingStrategy;

typedef struct {
    ServiceRegistry* registry;
    LoadBalancingStrategy strategy;
    int current_index; // For round-robin
} LoadBalancer;

// Global orchestrator state
typedef struct {
    ServiceRegistry* registry;
    MessageQueue* message_queue;
    LoadBalancer* load_balancer;
    pthread_t health_check_thread;
    pthread_t message_dispatcher_thread;
} EghactOrchestrator;

// Initialize orchestrator
EghactOrchestrator* eghact_orchestrator_init() {
    EghactOrchestrator* orch = malloc(sizeof(EghactOrchestrator));
    
    // Initialize service registry
    orch->registry = malloc(sizeof(ServiceRegistry));
    orch->registry->services = NULL;
    orch->registry->num_services = 0;
    pthread_mutex_init(&orch->registry->lock, NULL);
    
    // Initialize message queue
    orch->message_queue = malloc(sizeof(MessageQueue));
    orch->message_queue->head = NULL;
    orch->message_queue->tail = NULL;
    pthread_mutex_init(&orch->message_queue->lock, NULL);
    pthread_cond_init(&orch->message_queue->not_empty, NULL);
    
    // Initialize load balancer
    orch->load_balancer = malloc(sizeof(LoadBalancer));
    orch->load_balancer->registry = orch->registry;
    orch->load_balancer->strategy = LB_ROUND_ROBIN;
    orch->load_balancer->current_index = 0;
    
    // Start background threads
    pthread_create(&orch->health_check_thread, NULL, health_check_worker, orch);
    pthread_create(&orch->message_dispatcher_thread, NULL, message_dispatcher_worker, orch);
    
    return orch;
}

// Register a service
int eghact_register_service(EghactOrchestrator* orch, const char* name, 
                           const char* host, int port) {
    ServiceNode* node = malloc(sizeof(ServiceNode));
    node->service_id = generate_service_id();
    node->service_name = strdup(name);
    node->host = strdup(host);
    node->port = port;
    node->health_status = 1; // Assume healthy initially
    node->load = 0;
    
    pthread_mutex_lock(&orch->registry->lock);
    node->next = orch->registry->services;
    orch->registry->services = node;
    orch->registry->num_services++;
    pthread_mutex_unlock(&orch->registry->lock);
    
    return 0;
}

// Service discovery
ServiceNode* eghact_discover_service(EghactOrchestrator* orch, const char* service_name) {
    return select_service_instance(orch->load_balancer, service_name);
}

// Load balancing implementation
ServiceNode* select_service_instance(LoadBalancer* lb, const char* service_name) {
    pthread_mutex_lock(&lb->registry->lock);
    
    // Collect all instances of the service
    ServiceNode** instances = NULL;
    int num_instances = 0;
    ServiceNode* current = lb->registry->services;
    
    while (current) {
        if (strcmp(current->service_name, service_name) == 0 && 
            current->health_status == 1) {
            num_instances++;
            instances = realloc(instances, sizeof(ServiceNode*) * num_instances);
            instances[num_instances - 1] = current;
        }
        current = current->next;
    }
    
    ServiceNode* selected = NULL;
    
    if (num_instances > 0) {
        switch (lb->strategy) {
            case LB_ROUND_ROBIN:
                selected = instances[lb->current_index % num_instances];
                lb->current_index++;
                break;
                
            case LB_LEAST_CONNECTIONS:
                selected = instances[0];
                for (int i = 1; i < num_instances; i++) {
                    if (instances[i]->load < selected->load) {
                        selected = instances[i];
                    }
                }
                break;
                
            case LB_WEIGHTED:
                // Implement weighted selection based on service capacity
                break;
                
            case LB_IP_HASH:
                // Implement consistent hashing
                break;
        }
        
        if (selected) {
            selected->load++; // Increment connection count
        }
    }
    
    free(instances);
    pthread_mutex_unlock(&lb->registry->lock);
    
    return selected;
}

// Inter-service communication
int eghact_send_message(EghactOrchestrator* orch, const char* from, 
                       const char* to, const char* payload) {
    Message* msg = malloc(sizeof(Message));
    msg->from_service = strdup(from);
    msg->to_service = strdup(to);
    msg->payload = strdup(payload);
    msg->priority = 5; // Default priority
    msg->next = NULL;
    
    pthread_mutex_lock(&orch->message_queue->lock);
    
    if (orch->message_queue->tail) {
        orch->message_queue->tail->next = msg;
        orch->message_queue->tail = msg;
    } else {
        orch->message_queue->head = orch->message_queue->tail = msg;
    }
    
    pthread_cond_signal(&orch->message_queue->not_empty);
    pthread_mutex_unlock(&orch->message_queue->lock);
    
    return 0;
}

// Health check worker
void* health_check_worker(void* arg) {
    EghactOrchestrator* orch = (EghactOrchestrator*)arg;
    
    while (1) {
        pthread_mutex_lock(&orch->registry->lock);
        ServiceNode* current = orch->registry->services;
        
        while (current) {
            // Perform health check
            int sock = socket(AF_INET, SOCK_STREAM, 0);
            struct sockaddr_in addr;
            addr.sin_family = AF_INET;
            addr.sin_port = htons(current->port);
            addr.sin_addr.s_addr = inet_addr(current->host);
            
            // Set timeout
            struct timeval timeout;
            timeout.tv_sec = 1;
            timeout.tv_usec = 0;
            setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
            
            if (connect(sock, (struct sockaddr*)&addr, sizeof(addr)) == 0) {
                // Send health check request
                send(sock, "HEALTH_CHECK", 12, 0);
                char response[32];
                if (recv(sock, response, sizeof(response), 0) > 0) {
                    current->health_status = (strcmp(response, "OK") == 0) ? 1 : 0;
                } else {
                    current->health_status = 0;
                }
            } else {
                current->health_status = 0;
            }
            
            close(sock);
            current = current->next;
        }
        
        pthread_mutex_unlock(&orch->registry->lock);
        sleep(5); // Check every 5 seconds
    }
    
    return NULL;
}

// Message dispatcher worker
void* message_dispatcher_worker(void* arg) {
    EghactOrchestrator* orch = (EghactOrchestrator*)arg;
    
    while (1) {
        pthread_mutex_lock(&orch->message_queue->lock);
        
        while (orch->message_queue->head == NULL) {
            pthread_cond_wait(&orch->message_queue->not_empty, 
                            &orch->message_queue->lock);
        }
        
        Message* msg = orch->message_queue->head;
        orch->message_queue->head = msg->next;
        if (orch->message_queue->head == NULL) {
            orch->message_queue->tail = NULL;
        }
        
        pthread_mutex_unlock(&orch->message_queue->lock);
        
        // Dispatch message to target service
        ServiceNode* target = eghact_discover_service(orch, msg->to_service);
        if (target) {
            deliver_message(target, msg);
        }
        
        // Clean up
        free(msg->from_service);
        free(msg->to_service);
        free(msg->payload);
        free(msg);
    }
    
    return NULL;
}

// Circuit breaker pattern
typedef struct {
    int failure_count;
    int failure_threshold;
    int timeout_duration;
    time_t last_failure_time;
    enum { CLOSED, OPEN, HALF_OPEN } state;
} CircuitBreaker;

CircuitBreaker* create_circuit_breaker(int threshold, int timeout) {
    CircuitBreaker* cb = malloc(sizeof(CircuitBreaker));
    cb->failure_count = 0;
    cb->failure_threshold = threshold;
    cb->timeout_duration = timeout;
    cb->last_failure_time = 0;
    cb->state = CLOSED;
    return cb;
}

int circuit_breaker_call(CircuitBreaker* cb, int (*func)(void*), void* arg) {
    if (cb->state == OPEN) {
        if (time(NULL) - cb->last_failure_time > cb->timeout_duration) {
            cb->state = HALF_OPEN;
        } else {
            return -1; // Circuit is open
        }
    }
    
    int result = func(arg);
    
    if (result == 0) {
        // Success
        if (cb->state == HALF_OPEN) {
            cb->state = CLOSED;
            cb->failure_count = 0;
        }
    } else {
        // Failure
        cb->failure_count++;
        cb->last_failure_time = time(NULL);
        
        if (cb->failure_count >= cb->failure_threshold) {
            cb->state = OPEN;
        }
    }
    
    return result;
}

// Export for WASM
#ifdef __EMSCRIPTEN__
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
void* create_orchestrator() {
    return eghact_orchestrator_init();
}

EMSCRIPTEN_KEEPALIVE
int register_service(void* orch, const char* name, const char* host, int port) {
    return eghact_register_service((EghactOrchestrator*)orch, name, host, port);
}

EMSCRIPTEN_KEEPALIVE
void* discover_service(void* orch, const char* name) {
    ServiceNode* node = eghact_discover_service((EghactOrchestrator*)orch, name);
    if (node) {
        // Return service info as JSON
        char json[256];
        snprintf(json, sizeof(json), 
                "{\"id\":\"%s\",\"host\":\"%s\",\"port\":%d}", 
                node->service_id, node->host, node->port);
        return strdup(json);
    }
    return NULL;
}
#endif