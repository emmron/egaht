// Eghact Native Database Engine
// Lightweight embedded database with SQL and NoSQL support
// No external dependencies - pure C/WASM implementation

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include "eghact-core.h"

// B-tree node for indexing
typedef struct BTreeNode {
    int is_leaf;
    int num_keys;
    void** keys;
    struct BTreeNode** children;
    void** values; // Only for leaf nodes
} BTreeNode;

// Database page structure (4KB pages)
#define PAGE_SIZE 4096
typedef struct {
    uint32_t page_id;
    uint32_t next_page;
    uint16_t free_space;
    uint16_t num_records;
    char data[PAGE_SIZE - 12];
} DatabasePage;

// Table structure
typedef struct {
    char* name;
    char** column_names;
    char** column_types;
    int num_columns;
    BTreeNode* primary_index;
    DatabasePage* first_page;
} Table;

// Database structure
typedef struct {
    char* name;
    Table** tables;
    int num_tables;
    FILE* data_file;
    void* page_cache; // LRU cache for pages
} EghactDatabase;

// SQL Parser structures
typedef enum {
    QUERY_SELECT,
    QUERY_INSERT,
    QUERY_UPDATE,
    QUERY_DELETE,
    QUERY_CREATE_TABLE
} QueryType;

typedef struct {
    QueryType type;
    char* table_name;
    char** columns;
    char** values;
    char* where_clause;
    int num_columns;
} ParsedQuery;

// Create new database
EghactDatabase* eghact_db_create(const char* db_name) {
    EghactDatabase* db = malloc(sizeof(EghactDatabase));
    db->name = strdup(db_name);
    db->tables = NULL;
    db->num_tables = 0;
    
    // Open data file
    char filename[256];
    snprintf(filename, sizeof(filename), "%s.eghdb", db_name);
    db->data_file = fopen(filename, "wb+");
    
    // Initialize page cache
    db->page_cache = create_lru_cache(100); // 100 pages in cache
    
    return db;
}

// SQL Parser
ParsedQuery* parse_sql(const char* sql) {
    ParsedQuery* query = malloc(sizeof(ParsedQuery));
    char* sql_copy = strdup(sql);
    char* token = strtok(sql_copy, " ");
    
    if (strcasecmp(token, "SELECT") == 0) {
        query->type = QUERY_SELECT;
        // Parse SELECT statement
    } else if (strcasecmp(token, "INSERT") == 0) {
        query->type = QUERY_INSERT;
        // Parse INSERT statement
    } else if (strcasecmp(token, "CREATE") == 0) {
        token = strtok(NULL, " ");
        if (strcasecmp(token, "TABLE") == 0) {
            query->type = QUERY_CREATE_TABLE;
            query->table_name = strdup(strtok(NULL, " ("));
            // Parse column definitions
        }
    }
    
    free(sql_copy);
    return query;
}

// Create table
int eghact_db_create_table(EghactDatabase* db, const char* table_name, 
                          const char** columns, const char** types, int num_columns) {
    Table* table = malloc(sizeof(Table));
    table->name = strdup(table_name);
    table->num_columns = num_columns;
    table->column_names = malloc(sizeof(char*) * num_columns);
    table->column_types = malloc(sizeof(char*) * num_columns);
    
    for (int i = 0; i < num_columns; i++) {
        table->column_names[i] = strdup(columns[i]);
        table->column_types[i] = strdup(types[i]);
    }
    
    // Initialize B-tree index
    table->primary_index = create_btree_node(1); // Start with leaf node
    
    // Allocate first page
    table->first_page = allocate_page(db);
    
    // Add table to database
    db->num_tables++;
    db->tables = realloc(db->tables, sizeof(Table*) * db->num_tables);
    db->tables[db->num_tables - 1] = table;
    
    return 0;
}

// Insert record
int eghact_db_insert(EghactDatabase* db, const char* table_name, 
                    const char** values, int num_values) {
    Table* table = find_table(db, table_name);
    if (!table || num_values != table->num_columns) {
        return -1;
    }
    
    // Serialize record
    size_t record_size = calculate_record_size(table, values);
    char* record = serialize_record(table, values, record_size);
    
    // Find page with space
    DatabasePage* page = find_page_with_space(table, record_size);
    if (!page) {
        page = allocate_page(db);
        link_page(table, page);
    }
    
    // Insert into page
    insert_into_page(page, record, record_size);
    
    // Update index
    update_btree_index(table->primary_index, values[0], page->page_id);
    
    free(record);
    return 0;
}

// Query execution
typedef struct {
    char*** rows;
    int num_rows;
    int num_columns;
    char** column_names;
} QueryResult;

QueryResult* eghact_db_query(EghactDatabase* db, const char* sql) {
    ParsedQuery* parsed = parse_sql(sql);
    QueryResult* result = malloc(sizeof(QueryResult));
    
    switch (parsed->type) {
        case QUERY_SELECT:
            result = execute_select(db, parsed);
            break;
        case QUERY_INSERT:
            execute_insert(db, parsed);
            result->num_rows = 1; // Affected rows
            break;
        case QUERY_CREATE_TABLE:
            execute_create_table(db, parsed);
            result->num_rows = 0;
            break;
        default:
            break;
    }
    
    free_parsed_query(parsed);
    return result;
}

// NoSQL document store interface
typedef struct {
    char* id;
    char* json_data;
    size_t data_size;
} Document;

typedef struct {
    char* name;
    BTreeNode* document_index;
    DatabasePage* first_page;
} Collection;

// Insert JSON document
int eghact_db_insert_document(EghactDatabase* db, const char* collection_name, 
                              const char* json_data) {
    Collection* collection = find_or_create_collection(db, collection_name);
    
    // Generate document ID
    char* doc_id = generate_document_id();
    
    // Create document
    Document* doc = malloc(sizeof(Document));
    doc->id = doc_id;
    doc->json_data = strdup(json_data);
    doc->data_size = strlen(json_data);
    
    // Serialize and store
    char* serialized = serialize_document(doc);
    DatabasePage* page = find_page_with_space(collection, doc->data_size + 32);
    insert_into_page(page, serialized, doc->data_size + 32);
    
    // Update index
    update_btree_index(collection->document_index, doc_id, page->page_id);
    
    free(serialized);
    free(doc);
    return 0;
}

// Query JSON documents
QueryResult* eghact_db_query_documents(EghactDatabase* db, const char* collection_name,
                                       const char* json_query) {
    Collection* collection = find_collection(db, collection_name);
    if (!collection) return NULL;
    
    // Parse JSON query
    JsonQuery* query = parse_json_query(json_query);
    
    // Execute query
    QueryResult* result = malloc(sizeof(QueryResult));
    result->rows = NULL;
    result->num_rows = 0;
    
    // Scan collection
    DatabasePage* page = collection->first_page;
    while (page) {
        scan_page_for_documents(page, query, result);
        page = get_next_page(db, page);
    }
    
    free_json_query(query);
    return result;
}

// Transaction support
typedef struct {
    int transaction_id;
    DatabasePage** modified_pages;
    int num_modified;
    int is_active;
} Transaction;

Transaction* eghact_db_begin_transaction(EghactDatabase* db) {
    Transaction* txn = malloc(sizeof(Transaction));
    txn->transaction_id = generate_transaction_id();
    txn->modified_pages = NULL;
    txn->num_modified = 0;
    txn->is_active = 1;
    return txn;
}

int eghact_db_commit_transaction(EghactDatabase* db, Transaction* txn) {
    if (!txn->is_active) return -1;
    
    // Write all modified pages to disk
    for (int i = 0; i < txn->num_modified; i++) {
        write_page_to_disk(db, txn->modified_pages[i]);
    }
    
    // Flush to ensure durability
    fflush(db->data_file);
    
    txn->is_active = 0;
    free(txn->modified_pages);
    free(txn);
    return 0;
}

// Export for WASM
#ifdef __EMSCRIPTEN__
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
void* create_database(const char* name) {
    return eghact_db_create(name);
}

EMSCRIPTEN_KEEPALIVE
int execute_sql(void* db, const char* sql) {
    QueryResult* result = eghact_db_query((EghactDatabase*)db, sql);
    // Convert result to JSON for JavaScript
    char* json = query_result_to_json(result);
    emscripten_run_script(json);
    free(json);
    free_query_result(result);
    return 0;
}
#endif