//! EghQL Parser and Executor
//! 
//! The GraphQL killer that queries markdown files and reactive state

use nom::{
    IResult,
    branch::alt,
    bytes::complete::{tag, take_while, take_until},
    character::complete::{char, multispace0, multispace1, alphanumeric1},
    combinator::{map, opt, recognize},
    multi::{separated_list0, many0},
    sequence::{tuple, preceded, terminated, delimited},
};
use std::collections::HashMap;
use crate::{EghactRuntime, StateValue, RuntimeError, EghQLQuery, QueryAST, QueryOperation, QuerySource, Condition, ComparisonOp, OrderBy, SortDirection};

/// Parse an EghQL query string into AST
pub fn parse_query(query: &str) -> Result<EghQLQuery, RuntimeError> {
    let (_, ast) = parse_eghql(query)
        .map_err(|e| RuntimeError::ParseError(format!("EghQL parse error: {:?}", e)))?;
    
    Ok(ast)
}

/// Execute a parsed EghQL query
pub async fn execute_query(query: &EghQLQuery, runtime: &EghactRuntime) -> Result<Vec<StateValue>, RuntimeError> {
    match &query.source {
        QuerySource::Markdown(path) => execute_markdown_query(path, &query.ast, runtime).await,
        QuerySource::State(key) => execute_state_query(key, &query.ast, runtime),
        QuerySource::Remote(url) => execute_remote_query(url, &query.ast).await,
        QuerySource::Native(conn) => execute_native_query(conn, &query.ast).await,
    }
}

/// Parse the main EghQL query
fn parse_eghql(input: &str) -> IResult<&str, EghQLQuery> {
    alt((
        parse_select_query,
        parse_match_query,
        parse_mutation_query,
        parse_subscription_query,
    ))(input)
}

/// Parse SELECT/FROM query
fn parse_select_query(input: &str) -> IResult<&str, EghQLQuery> {
    let (input, _) = multispace0(input)?;
    let (input, source) = parse_from_clause(input)?;
    let (input, conditions) = opt(parse_where_clause)(input)?;
    let (input, selections) = parse_select_clause(input)?;
    let (input, ordering) = opt(parse_order_clause)(input)?;
    let (input, limit) = opt(parse_limit_clause)(input)?;
    
    Ok((input, EghQLQuery {
        id: uuid::Uuid::new_v4().to_string(),
        source,
        ast: QueryAST {
            operation: QueryOperation::Select,
            selections,
            conditions: conditions.unwrap_or_default(),
            ordering,
            limit,
        },
        dependencies: extract_dependencies(&conditions.unwrap_or_default()),
    }))
}

/// Parse MATCH query (graph traversal)
fn parse_match_query(input: &str) -> IResult<&str, EghQLQuery> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("MATCH")(input)?;
    let (input, _) = multispace1(input)?;
    let (input, pattern) = parse_graph_pattern(input)?;
    let (input, conditions) = opt(parse_where_clause)(input)?;
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("RETURN")(input)?;
    let (input, _) = multispace1(input)?;
    let (input, selections) = parse_selection_list(input)?;
    
    Ok((input, EghQLQuery {
        id: uuid::Uuid::new_v4().to_string(),
        source: QuerySource::State(pattern), // Graph queries work on state
        ast: QueryAST {
            operation: QueryOperation::Match,
            selections,
            conditions: conditions.unwrap_or_default(),
            ordering: None,
            limit: None,
        },
        dependencies: vec![pattern],
    }))
}

/// Parse FROM clause
fn parse_from_clause(input: &str) -> IResult<&str, QuerySource> {
    let (input, _) = tag("FROM")(input)?;
    let (input, _) = multispace1(input)?;
    
    alt((
        map(
            terminated(take_until(".md"), tag(".md")),
            |path: &str| QuerySource::Markdown(format!("{}.md", path))
        ),
        map(
            preceded(char('$'), parse_identifier),
            |state_ref| QuerySource::State(state_ref)
        ),
        map(
            delimited(char('"'), take_until("\""), char('"')),
            |url: &str| {
                if url.starts_with("http") {
                    QuerySource::Remote(url.to_string())
                } else {
                    QuerySource::Native(url.to_string())
                }
            }
        ),
    ))(input)
}

/// Parse WHERE clause
fn parse_where_clause(input: &str) -> IResult<&str, Vec<Condition>> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("WHERE")(input)?;
    let (input, _) = multispace1(input)?;
    
    separated_list0(
        tuple((multispace0, tag("AND"), multispace0)),
        parse_condition
    )(input)
}

/// Parse a single condition
fn parse_condition(input: &str) -> IResult<&str, Condition> {
    let (input, field) = parse_field_path(input)?;
    let (input, _) = multispace0(input)?;
    let (input, op) = parse_comparison_op(input)?;
    let (input, _) = multispace0(input)?;
    let (input, value) = parse_value(input)?;
    
    Ok((input, Condition { field, operator: op, value }))
}

/// Parse comparison operator
fn parse_comparison_op(input: &str) -> IResult<&str, ComparisonOp> {
    alt((
        map(tag(">="), |_| ComparisonOp::Gte),
        map(tag("<="), |_| ComparisonOp::Lte),
        map(tag("!="), |_| ComparisonOp::Ne),
        map(tag("="), |_| ComparisonOp::Eq),
        map(tag(">"), |_| ComparisonOp::Gt),
        map(tag("<"), |_| ComparisonOp::Lt),
        map(tag("IN"), |_| ComparisonOp::In),
        map(tag("LIKE"), |_| ComparisonOp::Like),
    ))(input)
}

/// Parse SELECT clause
fn parse_select_clause(input: &str) -> IResult<&str, Vec<String>> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("SELECT")(input)?;
    let (input, _) = multispace1(input)?;
    
    alt((
        map(char('*'), |_| vec!["*".to_string()]),
        parse_selection_list,
    ))(input)
}

/// Parse selection list
fn parse_selection_list(input: &str) -> IResult<&str, Vec<String>> {
    separated_list0(
        tuple((multispace0, char(','), multispace0)),
        parse_selection_item
    )(input)
}

/// Parse a single selection item
fn parse_selection_item(input: &str) -> IResult<&str, String> {
    alt((
        // Field with alias: field AS alias
        map(
            tuple((
                parse_field_path,
                multispace1,
                tag("AS"),
                multispace1,
                parse_identifier
            )),
            |(field, _, _, _, alias)| format!("{} AS {}", field, alias)
        ),
        // Computed field: (expression) AS alias
        map(
            tuple((
                delimited(char('('), take_until(")"), char(')')),
                multispace1,
                tag("AS"),
                multispace1,
                parse_identifier
            )),
            |(expr, _, _, _, alias)| format!("({}) AS {}", expr, alias)
        ),
        // Simple field
        parse_field_path,
    ))(input)
}

/// Parse ORDER BY clause
fn parse_order_clause(input: &str) -> IResult<&str, OrderBy> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("ORDER BY")(input)?;
    let (input, _) = multispace1(input)?;
    let (input, field) = parse_field_path(input)?;
    let (input, direction) = opt(preceded(
        multispace1,
        alt((
            map(tag("ASC"), |_| SortDirection::Asc),
            map(tag("DESC"), |_| SortDirection::Desc),
        ))
    ))(input)?;
    
    Ok((input, OrderBy {
        field,
        direction: direction.unwrap_or(SortDirection::Asc),
    }))
}

/// Parse LIMIT clause
fn parse_limit_clause(input: &str) -> IResult<&str, usize> {
    let (input, _) = multispace0(input)?;
    let (input, _) = tag("LIMIT")(input)?;
    let (input, _) = multispace1(input)?;
    let (input, limit_str) = take_while(|c: char| c.is_numeric())(input)?;
    
    let limit = limit_str.parse::<usize>()
        .map_err(|_| nom::Err::Error(nom::error::Error::new(input, nom::error::ErrorKind::Digit)))?;
    
    Ok((input, limit))
}

/// Parse field path (e.g., user.name, posts.author.email)
fn parse_field_path(input: &str) -> IResult<&str, String> {
    map(
        separated_list0(char('.'), parse_identifier),
        |parts| parts.join(".")
    )(input)
}

/// Parse identifier
fn parse_identifier(input: &str) -> IResult<&str, String> {
    map(
        recognize(tuple((
            alt((alphanumeric1, tag("_"))),
            many0(alt((alphanumeric1, tag("_"))))
        ))),
        |s: &str| s.to_string()
    )(input)
}

/// Parse value (string, number, bool, state reference)
fn parse_value(input: &str) -> IResult<&str, StateValue> {
    alt((
        // String literal
        map(
            delimited(char('"'), take_until("\""), char('"')),
            |s: &str| StateValue::String(s.to_string())
        ),
        // Number
        map(
            recognize(tuple((
                opt(char('-')),
                take_while(|c: char| c.is_numeric()),
                opt(tuple((char('.'), take_while(|c: char| c.is_numeric()))))
            ))),
            |n: &str| StateValue::Number(n.parse::<f64>().unwrap())
        ),
        // Boolean
        map(tag("true"), |_| StateValue::Bool(true)),
        map(tag("false"), |_| StateValue::Bool(false)),
        // Null
        map(tag("null"), |_| StateValue::Null),
        // State reference
        map(
            preceded(char('$'), parse_field_path),
            |path| StateValue::String(format!("${}", path))
        ),
    ))(input)
}

/// Parse graph pattern for MATCH queries
fn parse_graph_pattern(input: &str) -> IResult<&str, String> {
    map(
        separated_list0(char('.'), parse_identifier),
        |parts| parts.join(".")
    )(input)
}

/// Parse mutation queries (INSERT, UPDATE, DELETE)
fn parse_mutation_query(input: &str) -> IResult<&str, EghQLQuery> {
    // Simplified for now
    todo!("Implement mutation parsing")
}

/// Parse subscription queries
fn parse_subscription_query(input: &str) -> IResult<&str, EghQLQuery> {
    // Simplified for now
    todo!("Implement subscription parsing")
}

/// Extract state dependencies from conditions
fn extract_dependencies(conditions: &[Condition]) -> Vec<String> {
    conditions.iter()
        .filter_map(|c| {
            if let StateValue::String(s) = &c.value {
                if s.starts_with('$') {
                    Some(s[1..].to_string())
                } else {
                    None
                }
            } else {
                None
            }
        })
        .collect()
}

/// Execute query against markdown files
async fn execute_markdown_query(
    path: &str,
    ast: &QueryAST,
    runtime: &EghactRuntime
) -> Result<Vec<StateValue>, RuntimeError> {
    use pulldown_cmark::{Parser, Event, Tag};
    use std::fs;
    
    // Read markdown file
    let content = fs::read_to_string(path)
        .map_err(|e| RuntimeError::Io(format!("Failed to read {}: {}", path, e)))?;
    
    // Parse frontmatter
    let (frontmatter, body) = parse_markdown_frontmatter(&content)?;
    
    // Convert to records
    let mut records = vec![frontmatter];
    
    // Apply WHERE conditions
    let filtered = records.into_iter()
        .filter(|record| apply_conditions(record, &ast.conditions, runtime))
        .collect::<Vec<_>>();
    
    // Apply SELECT projections
    let projected = filtered.into_iter()
        .map(|record| apply_projections(record, &ast.selections))
        .collect::<Vec<_>>();
    
    // Apply ORDER BY
    let mut sorted = projected;
    if let Some(order) = &ast.ordering {
        sorted.sort_by(|a, b| compare_values(a, b, &order.field, &order.direction));
    }
    
    // Apply LIMIT
    if let Some(limit) = ast.limit {
        sorted.truncate(limit);
    }
    
    Ok(sorted)
}

/// Execute query against reactive state
fn execute_state_query(
    key: &str,
    ast: &QueryAST,
    runtime: &EghactRuntime
) -> Result<Vec<StateValue>, RuntimeError> {
    // Get state value
    let state_value = runtime.get_state(key)
        .ok_or_else(|| RuntimeError::QueryNotFound(format!("State key not found: {}", key)))?;
    
    // Handle array vs single value
    let records = match state_value {
        StateValue::Array(items) => items,
        other => vec![other],
    };
    
    // Apply query operations similar to markdown query
    Ok(records)
}

/// Execute remote HTTP query
async fn execute_remote_query(
    url: &str,
    ast: &QueryAST
) -> Result<Vec<StateValue>, RuntimeError> {
    // TODO: Implement HTTP fetching with query pushdown
    todo!("Remote query execution")
}

/// Execute native database query
async fn execute_native_query(
    conn: &str,
    ast: &QueryAST
) -> Result<Vec<StateValue>, RuntimeError> {
    // TODO: Implement direct database access
    todo!("Native database query execution")
}

/// Parse markdown frontmatter into StateValue
fn parse_markdown_frontmatter(content: &str) -> Result<(StateValue, String), RuntimeError> {
    let parts: Vec<&str> = content.splitn(3, "---").collect();
    
    if parts.len() < 3 {
        return Err(RuntimeError::ParseError("Invalid markdown format".to_string()));
    }
    
    let frontmatter = parts[1].trim();
    let body = parts[2].trim();
    
    // Parse YAML frontmatter
    let value: serde_yaml::Value = serde_yaml::from_str(frontmatter)
        .map_err(|e| RuntimeError::ParseError(format!("YAML parse error: {}", e)))?;
    
    // Convert to StateValue
    let state_value = yaml_to_state_value(value);
    
    Ok((state_value, body.to_string()))
}

/// Convert YAML value to StateValue
fn yaml_to_state_value(value: serde_yaml::Value) -> StateValue {
    use serde_yaml::Value;
    
    match value {
        Value::Null => StateValue::Null,
        Value::Bool(b) => StateValue::Bool(b),
        Value::Number(n) => StateValue::Number(n.as_f64().unwrap_or(0.0)),
        Value::String(s) => StateValue::String(s),
        Value::Sequence(seq) => StateValue::Array(
            seq.into_iter().map(yaml_to_state_value).collect()
        ),
        Value::Mapping(map) => {
            let mut obj = HashMap::new();
            for (k, v) in map {
                if let Value::String(key) = k {
                    obj.insert(key, yaml_to_state_value(v));
                }
            }
            StateValue::Object(obj)
        }
    }
}

/// Apply WHERE conditions to a record
fn apply_conditions(record: &StateValue, conditions: &[Condition], runtime: &EghactRuntime) -> bool {
    conditions.iter().all(|cond| {
        let field_value = get_nested_field(record, &cond.field);
        let cond_value = resolve_value(&cond.value, runtime);
        
        match cond.operator {
            ComparisonOp::Eq => field_value == cond_value,
            ComparisonOp::Ne => field_value != cond_value,
            ComparisonOp::Gt => compare_gt(&field_value, &cond_value),
            ComparisonOp::Lt => compare_lt(&field_value, &cond_value),
            ComparisonOp::Gte => !compare_lt(&field_value, &cond_value),
            ComparisonOp::Lte => !compare_gt(&field_value, &cond_value),
            ComparisonOp::In => check_in(&field_value, &cond_value),
            ComparisonOp::Like => check_like(&field_value, &cond_value),
        }
    })
}

/// Get nested field from StateValue
fn get_nested_field(value: &StateValue, path: &str) -> StateValue {
    let parts: Vec<&str> = path.split('.').collect();
    let mut current = value;
    
    for part in parts {
        match current {
            StateValue::Object(map) => {
                current = map.get(part).unwrap_or(&StateValue::Null);
            }
            _ => return StateValue::Null,
        }
    }
    
    current.clone()
}

/// Resolve value references (e.g., $state.value)
fn resolve_value(value: &StateValue, runtime: &EghactRuntime) -> StateValue {
    if let StateValue::String(s) = value {
        if s.starts_with('$') {
            return runtime.get_state(&s[1..]).unwrap_or(StateValue::Null);
        }
    }
    value.clone()
}

/// Apply SELECT projections
fn apply_projections(record: StateValue, selections: &[String]) -> StateValue {
    if selections.len() == 1 && selections[0] == "*" {
        return record;
    }
    
    let mut result = HashMap::new();
    
    for selection in selections {
        // Handle AS aliases
        let (field, alias) = if selection.contains(" AS ") {
            let parts: Vec<&str> = selection.split(" AS ").collect();
            (parts[0], parts[1])
        } else {
            (selection.as_str(), selection.as_str())
        };
        
        let value = get_nested_field(&record, field);
        result.insert(alias.to_string(), value);
    }
    
    StateValue::Object(result)
}

// Comparison helpers
fn compare_gt(a: &StateValue, b: &StateValue) -> bool {
    match (a, b) {
        (StateValue::Number(n1), StateValue::Number(n2)) => n1 > n2,
        (StateValue::String(s1), StateValue::String(s2)) => s1 > s2,
        _ => false,
    }
}

fn compare_lt(a: &StateValue, b: &StateValue) -> bool {
    match (a, b) {
        (StateValue::Number(n1), StateValue::Number(n2)) => n1 < n2,
        (StateValue::String(s1), StateValue::String(s2)) => s1 < s2,
        _ => false,
    }
}

fn check_in(value: &StateValue, collection: &StateValue) -> bool {
    if let StateValue::Array(items) = collection {
        items.contains(value)
    } else {
        false
    }
}

fn check_like(value: &StateValue, pattern: &StateValue) -> bool {
    if let (StateValue::String(s), StateValue::String(p)) = (value, pattern) {
        // Simple LIKE implementation
        let pattern = p.replace('%', ".*");
        regex::Regex::new(&pattern).map(|re| re.is_match(s)).unwrap_or(false)
    } else {
        false
    }
}

fn compare_values(a: &StateValue, b: &StateValue, field: &str, direction: &SortDirection) -> std::cmp::Ordering {
    let a_val = get_nested_field(a, field);
    let b_val = get_nested_field(b, field);
    
    let ord = match (&a_val, &b_val) {
        (StateValue::Number(n1), StateValue::Number(n2)) => n1.partial_cmp(n2).unwrap_or(std::cmp::Ordering::Equal),
        (StateValue::String(s1), StateValue::String(s2)) => s1.cmp(s2),
        _ => std::cmp::Ordering::Equal,
    };
    
    match direction {
        SortDirection::Asc => ord,
        SortDirection::Desc => ord.reverse(),
    }
}