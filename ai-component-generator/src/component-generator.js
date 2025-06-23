const OpenAI = require('openai');
const { inferProps, generatePropDefinitions } = require('./prop-inference');
const { inferStateNeeds, generateStateManagement, generateControlFlow } = require('./state-management');

// Initialize OpenRouter client
const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || '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',
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://eghact.dev',
    'X-Title': 'Eghact AI Component Generator'
  }
});

const SYSTEM_PROMPT = `You are an expert Eghact developer. Eghact uses .egh files with its own revolutionary syntax - NOT JSX!

KEY EGHACT (.egh) SYNTAX RULES:
1. Files MUST use .egh extension
2. Components wrapped in <component> tags
3. Props: <prop name="propName" type="string|number|boolean" default="value" />
4. State: <state>let varName = value;</state>
5. Reactive: $: computedValue = expression;
6. Template syntax:
   - {varName} for interpolation
   - @click="handler" for events (NOT onClick)
   - :attr="value" for dynamic attributes
   - #if, #each, #else for control flow
7. NO JSX! NO className! Use class="" directly
8. Event handlers use @ prefix: @click, @change, @input
9. Styles are scoped by default

CORRECT EGHACT COMPONENT EXAMPLE:
<component>
  <prop name="label" type="string" default="Click me" />
  <prop name="variant" type="string" default="primary" />
  
  <state>
    let clickCount = 0;
  </state>
  
  $: buttonText = clickCount > 0 ? \`\${label} (\${clickCount})\` : label;
  
  const handleClick = () => {
    clickCount++;
  };
  
  <template>
    <button class="btn btn-{variant}" @click="handleClick">
      {buttonText}
    </button>
  </template>
  
  <style>
    .btn {
      padding: 10px 20px;
      border: none;
      cursor: pointer;
    }
    .btn-primary {
      background: #007bff;
      color: white;
    }
  </style>
</component>

Generate ONLY valid .egh component code. NO JSX syntax! Use Eghact syntax only.`;

/**
 * Generate an Eghact component from a natural language prompt
 * @param {string} prompt - Natural language description
 * @param {Object} options - Generation options
 * @returns {Promise<string>} Generated Eghact component code
 */
async function generateComponent(prompt, options = {}) {
  try {
    // Check if we have a component spec from vision analysis
    let componentSpec = options.componentSpec;
    let inferredProps, propDefinitions, stateNeeds, stateManagement;
    
    if (componentSpec) {
      // Use vision-derived spec
      inferredProps = componentSpec.props.reduce((acc, prop) => {
        acc[prop.name] = { value: prop.default, type: prop.type };
        return acc;
      }, {});
      propDefinitions = generatePropDefinitions(inferredProps);
      
      // Convert spec state to our format
      stateNeeds = {
        patterns: [],
        customState: componentSpec.state.map(s => `let ${s.name} = ${s.initial};`),
        customHandlers: componentSpec.handlers.map(h => `const ${h.name} = () => { ${h.body} }`),
        customReactive: []
      };
      stateManagement = generateStateManagement(stateNeeds);
    } else {
      // Normal inference path
      inferredProps = inferProps(prompt);
      propDefinitions = generatePropDefinitions(inferredProps);
      stateNeeds = inferStateNeeds(prompt);
      stateManagement = generateStateManagement(stateNeeds);
    }
    
    // Enhanced prompt with inferred props and state
    const enhancedPrompt = `Generate a Turing-complete Eghact component for: ${prompt}
    
${Object.keys(inferredProps).length > 0 ? `Inferred props to include:
${propDefinitions}` : ''}

${stateManagement.state.length > 0 ? `State variables to include:
<state>
${stateManagement.state.join('\n')}
</state>` : ''}

${stateManagement.handlers.length > 0 ? `Event handlers to include:
${stateManagement.handlers.join('\n\n')}` : ''}

${stateManagement.reactive.length > 0 ? `Reactive statements to include:
${stateManagement.reactive.join('\n')}` : ''}

IMPORTANT: 
- Use .egh syntax ONLY - no JSX, no className, use @ for events
- Make the component Turing-complete with proper state management
- Use #if, #each, #else for control flow
- Include recursive functions or loops where appropriate
- State updates must be reactive (use assignment, not mutation)`;
    
    const completion = await openai.chat.completions.create({
      model: options.model || 'openai/gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: enhancedPrompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
    });

    const generatedCode = completion.choices[0].message.content.trim();
    
    // Clean up any markdown formatting if present
    const cleanedCode = generatedCode
      .replace(/^```.*$/gm, '')
      .trim();
    
    return cleanedCode;
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      throw new Error('Network error: Unable to reach OpenAI API');
    }
    if (error.status === 401) {
      throw new Error('Authentication error: Invalid API key');
    }
    throw error;
  }
}

/**
 * Generate component with local LLM fallback (for testing)
 */
async function generateComponentWithFallback(prompt, options = {}) {
  try {
    return await generateComponent(prompt, options);
  } catch (error) {
    console.warn('OpenAI API failed, using template-based fallback:', error.message);
    return generateTemplateBasedComponent(prompt);
  }
}

/**
 * Template-based Turing-complete component generation (fallback)
 */
function generateTemplateBasedComponent(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  // Infer props and state
  const inferredProps = inferProps(prompt);
  const propDefs = generatePropDefinitions(inferredProps);
  const stateNeeds = inferStateNeeds(prompt);
  const stateManagement = generateStateManagement(stateNeeds);
  
  // Determine component type
  let componentType = 'div';
  let componentName = 'Component';
  
  if (lowerPrompt.includes('button')) {
    componentType = 'button';
    componentName = 'Button';
    
    return `<component>
  ${propDefs || '<prop name="label" type="string" default="Click me" />'}
  <prop name="onClick" type="function" default={() => {}} />
  
  <state>
    let clickCount = 0;
  </state>
  
  $: buttonText = clickCount > 0 ? \`\${label || 'Click me'} (\${clickCount})\` : (label || 'Click me');
  $: isEven = clickCount % 2 === 0;
  
  const handleClick = () => {
    clickCount++;
    onClick(clickCount);
  };
  
  <template>
    <button 
      class="btn" 
      class:even={isEven}
      class:odd={!isEven}
      @click="handleClick"
    >
      {buttonText}
    </button>
  </template>
  
  <style>
    .btn {
      padding: 10px 20px;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn.even { background: #007bff; color: white; }
    .btn.odd { background: #28a745; color: white; }
    .btn:hover { opacity: 0.8; }
  </style>
</component>`;
  }
  
  if (lowerPrompt.includes('counter')) {
    return `<component>
  <prop name="initialValue" type="number" default={0} />
  <prop name="step" type="number" default={1} />
  
  <state>
    let count = initialValue;
  </state>
  
  $: doubled = count * 2;
  $: isPositive = count > 0;
  $: isNegative = count < 0;
  $: factorial = ((n) => {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
  })(Math.abs(count) <= 20 ? Math.abs(count) : 20);
  
  const increment = () => count += step;
  const decrement = () => count -= step;
  const reset = () => count = initialValue;
  const setCount = (value) => count = parseInt(value) || 0;
  
  <template>
    <div class="counter">
      <h2>Turing-Complete Counter</h2>
      <div class="display">
        <p>Count: {count}</p>
        <p>Doubled: {doubled}</p>
        <p>Factorial: {factorial}</p>
      </div>
      
      <div class="controls">
        <button @click="decrement">- {step}</button>
        <button @click="reset">Reset</button>
        <button @click="increment">+ {step}</button>
      </div>
      
      <input 
        type="number" 
        value={count}
        @input="(e) => setCount(e.target.value)"
      />
      
      #if (isPositive)
        <p class="positive">Positive number!</p>
      #elseif (isNegative)
        <p class="negative">Negative number!</p>
      #else
        <p class="zero">Zero!</p>
      #/if
    </div>
  </template>
  
  <style>
    .counter { padding: 20px; text-align: center; }
    .display { margin: 20px 0; }
    .controls { display: flex; gap: 10px; justify-content: center; }
    button { padding: 10px 20px; }
    input { margin-top: 10px; padding: 5px; }
    .positive { color: green; }
    .negative { color: red; }
    .zero { color: gray; }
  </style>
</component>`;
  }
  
  if (lowerPrompt.includes('list') || lowerPrompt.includes('todo')) {
    return `<component>
  <prop name="title" type="string" default="Todo List" />
  
  <state>
    let items = [];
    let newItem = "";
    let filter = "all"; // all, active, completed
    let editingId = null;
    let editingText = "";
  </state>
  
  $: filteredItems = (() => {
    switch(filter) {
      case "active": return items.filter(item => !item.completed);
      case "completed": return items.filter(item => item.completed);
      default: return items;
    }
  })();
  $: activeCount = items.filter(item => !item.completed).length;
  $: completedCount = items.filter(item => item.completed).length;
  $: hasItems = items.length > 0;
  
  const addItem = () => {
    if (newItem.trim()) {
      items = [...items, {
        id: Date.now(),
        text: newItem.trim(),
        completed: false
      }];
      newItem = "";
    }
  };
  
  const toggleItem = (id) => {
    items = items.map(item =>
      item.id === id ? { ...item, completed: !item.completed } : item
    );
  };
  
  const removeItem = (id) => {
    items = items.filter(item => item.id !== id);
  };
  
  const startEditing = (id, text) => {
    editingId = id;
    editingText = text;
  };
  
  const saveEdit = () => {
    if (editingText.trim()) {
      items = items.map(item =>
        item.id === editingId ? { ...item, text: editingText.trim() } : item
      );
    }
    editingId = null;
    editingText = "";
  };
  
  const clearCompleted = () => {
    items = items.filter(item => !item.completed);
  };
  
  <template>
    <div class="todo-list">
      <h1>{title}</h1>
      
      <div class="input-group">
        <input
          type="text"
          placeholder="What needs to be done?"
          value={newItem}
          @input="(e) => newItem = e.target.value"
          @keydown="(e) => e.key === 'Enter' && addItem()"
        />
        <button @click="addItem">Add</button>
      </div>
      
      #if (hasItems)
        <div class="filters">
          <button 
            class:active={filter === 'all'} 
            @click="() => filter = 'all'"
          >
            All ({items.length})
          </button>
          <button 
            class:active={filter === 'active'} 
            @click="() => filter = 'active'"
          >
            Active ({activeCount})
          </button>
          <button 
            class:active={filter === 'completed'} 
            @click="() => filter = 'completed'"
          >
            Completed ({completedCount})
          </button>
        </div>
        
        <ul class="items">
          #each (filteredItems as item)
            <li key={item.id} class:completed={item.completed}>
              #if (editingId === item.id)
                <input
                  type="text"
                  value={editingText}
                  @input="(e) => editingText = e.target.value"
                  @keydown="(e) => e.key === 'Enter' && saveEdit()"
                  @blur="saveEdit"
                  autofocus
                />
              #else
                <input 
                  type="checkbox" 
                  checked={item.completed}
                  @change="() => toggleItem(item.id)"
                />
                <span @dblclick="() => startEditing(item.id, item.text)">
                  {item.text}
                </span>
                <button @click="() => removeItem(item.id)">×</button>
              #/if
            </li>
          #/each
        </ul>
        
        #if (completedCount > 0)
          <button @click="clearCompleted">
            Clear completed ({completedCount})
          </button>
        #/if
      #else
        <p class="empty">No items yet. Add one above!</p>
      #/if
    </div>
  </template>
  
  <style>
    .todo-list { max-width: 500px; margin: 0 auto; padding: 20px; }
    .input-group { display: flex; gap: 10px; margin-bottom: 20px; }
    .input-group input { flex: 1; padding: 10px; }
    .filters { display: flex; gap: 10px; margin-bottom: 10px; }
    .filters button { padding: 5px 10px; border: 1px solid #ddd; background: white; }
    .filters button.active { background: #007bff; color: white; }
    .items { list-style: none; padding: 0; }
    .items li { display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #eee; }
    .items li.completed span { text-decoration: line-through; opacity: 0.5; }
    .empty { text-align: center; color: #999; }
  </style>
</component>`;
  }
  
  // Default Turing-complete template
  return `<component>
  ${propDefs || '<prop name="title" type="string" default="Component" />'}
  
  <state>
    ${stateManagement.state.join('\n    ') || 'let state = {};'}
  </state>
  
  ${stateManagement.reactive.join('\n  ') || '$: computed = Object.keys(state).length;'}
  
  ${stateManagement.handlers.join('\n  ') || `const handleAction = () => {
    console.log('Action handled');
  };`}
  
  <template>
    <div class="${componentName.toLowerCase()}">
      <h2>{title || "${componentName}"}</h2>
      ${stateNeeds.patterns.length > 0 ? generateControlFlow(stateNeeds).join('\n      ') : '<p>Content goes here</p>'}
    </div>
  </template>
  
  <style>
    .${componentName.toLowerCase()} {
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
  </style>
</component>`;
}

module.exports = {
  generateComponent,
  generateComponentWithFallback,
  generateTemplateBasedComponent
};