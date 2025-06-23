/**
 * State Management Scaffolding for Turing-complete .egh components
 * Generates proper Eghact state, reactive computations, and control flow
 */

const STATE_PATTERNS = {
  // Counter/numeric operations
  'counter': {
    state: 'let count = 0;',
    handlers: ['const increment = () => count++;', 'const decrement = () => count--;'],
    reactive: '$: isEven = count % 2 === 0;'
  },
  'toggle': {
    state: 'let isActive = false;',
    handlers: ['const toggle = () => isActive = !isActive;'],
    reactive: '$: buttonText = isActive ? "On" : "Off";'
  },
  'list': {
    state: 'let items = [];\nlet newItem = "";',
    handlers: [
      'const addItem = () => { if (newItem.trim()) { items = [...items, { id: Date.now(), text: newItem }]; newItem = ""; } }',
      'const removeItem = (id) => { items = items.filter(item => item.id !== id); }',
      'const clearAll = () => { items = []; }'
    ],
    reactive: '$: itemCount = items.length;\n$: isEmpty = items.length === 0;'
  },
  'form': {
    state: 'let formData = { name: "", email: "", message: "" };\nlet errors = {};\nlet isSubmitting = false;',
    handlers: [
      'const validateForm = () => { errors = {}; if (!formData.name) errors.name = "Name required"; if (!formData.email) errors.email = "Email required"; else if (!/\\S+@\\S+\\.\\S+/.test(formData.email)) errors.email = "Invalid email"; return Object.keys(errors).length === 0; }',
      'const handleSubmit = async () => { if (validateForm()) { isSubmitting = true; await new Promise(r => setTimeout(r, 1000)); console.log("Form submitted:", formData); isSubmitting = false; formData = { name: "", email: "", message: "" }; } }',
      'const updateField = (field, value) => { formData[field] = value; errors[field] = ""; }'
    ],
    reactive: '$: isValid = formData.name && formData.email && !Object.keys(errors).length;'
  },
  'tabs': {
    state: 'let activeTab = 0;\nlet tabs = ["Tab 1", "Tab 2", "Tab 3"];',
    handlers: [
      'const selectTab = (index) => { activeTab = index; }',
      'const nextTab = () => { activeTab = (activeTab + 1) % tabs.length; }',
      'const prevTab = () => { activeTab = (activeTab - 1 + tabs.length) % tabs.length; }'
    ],
    reactive: '$: currentTabName = tabs[activeTab];'
  },
  'search': {
    state: 'let searchQuery = "";\nlet items = [];\nlet isLoading = false;',
    handlers: [
      'const search = async () => { isLoading = true; await new Promise(r => setTimeout(r, 500)); items = mockSearch(searchQuery); isLoading = false; }',
      'const mockSearch = (query) => { return query ? [1,2,3,4,5].map(i => ({ id: i, title: `Result ${i} for "${query}"` })) : []; }'
    ],
    reactive: '$: hasResults = items.length > 0;\n$: resultCount = items.length;'
  },
  'calculator': {
    state: 'let display = "0";\nlet previousValue = null;\nlet operation = null;\nlet waitingForOperand = false;',
    handlers: [
      'const inputDigit = (digit) => { if (waitingForOperand) { display = String(digit); waitingForOperand = false; } else { display = display === "0" ? String(digit) : display + digit; } }',
      'const inputDecimal = () => { if (waitingForOperand) { display = "0."; waitingForOperand = false; } else if (display.indexOf(".") === -1) { display += "."; } }',
      'const clear = () => { display = "0"; previousValue = null; operation = null; waitingForOperand = false; }',
      'const performOperation = (nextOperation) => { const inputValue = parseFloat(display); if (previousValue === null) { previousValue = inputValue; } else if (operation) { const newValue = calculate(previousValue, inputValue, operation); display = String(newValue); previousValue = newValue; } waitingForOperand = true; operation = nextOperation; }',
      'const calculate = (firstValue, secondValue, operation) => { switch(operation) { case "+": return firstValue + secondValue; case "-": return firstValue - secondValue; case "*": return firstValue * secondValue; case "/": return firstValue / secondValue; case "=": return secondValue; } }'
    ],
    reactive: '$: displayValue = parseFloat(display);'
  }
};

/**
 * Infer state management needs from component description
 */
function inferStateNeeds(description) {
  const lower = description.toLowerCase();
  const needs = {
    patterns: [],
    customState: [],
    customHandlers: [],
    customReactive: []
  };

  // Check for known patterns
  if (lower.includes('counter') || lower.includes('increment') || lower.includes('decrement')) {
    needs.patterns.push('counter');
  }
  if (lower.includes('toggle') || lower.includes('switch') || lower.includes('on/off')) {
    needs.patterns.push('toggle');
  }
  if (lower.includes('list') || lower.includes('todo') || lower.includes('items')) {
    needs.patterns.push('list');
  }
  if (lower.includes('form') || lower.includes('submit') || lower.includes('input fields')) {
    needs.patterns.push('form');
  }
  if (lower.includes('tabs') || lower.includes('tabbed')) {
    needs.patterns.push('tabs');
  }
  if (lower.includes('search') || lower.includes('filter')) {
    needs.patterns.push('search');
  }
  if (lower.includes('calculator') || lower.includes('calculate')) {
    needs.patterns.push('calculator');
  }

  // Infer custom state needs
  if (lower.includes('timer') || lower.includes('countdown')) {
    needs.customState.push('let timeLeft = 60;');
    needs.customState.push('let timerId = null;');
    needs.customHandlers.push('const startTimer = () => { timerId = setInterval(() => { if (timeLeft > 0) timeLeft--; else stopTimer(); }, 1000); }');
    needs.customHandlers.push('const stopTimer = () => { if (timerId) { clearInterval(timerId); timerId = null; } }');
    needs.customReactive.push('$: minutes = Math.floor(timeLeft / 60);');
    needs.customReactive.push('$: seconds = timeLeft % 60;');
  }

  if (lower.includes('accordion') || lower.includes('collapsible')) {
    needs.customState.push('let expandedItems = new Set();');
    needs.customHandlers.push('const toggleItem = (id) => { if (expandedItems.has(id)) { expandedItems.delete(id); expandedItems = new Set(expandedItems); } else { expandedItems.add(id); expandedItems = new Set(expandedItems); } }');
    needs.customReactive.push('$: isExpanded = (id) => expandedItems.has(id);');
  }

  return needs;
}

/**
 * Generate complete state management code
 */
function generateStateManagement(stateNeeds) {
  const parts = {
    state: [],
    handlers: [],
    reactive: []
  };

  // Add pattern-based state
  stateNeeds.patterns.forEach(pattern => {
    if (STATE_PATTERNS[pattern]) {
      parts.state.push(STATE_PATTERNS[pattern].state);
      parts.handlers.push(...STATE_PATTERNS[pattern].handlers);
      parts.reactive.push(STATE_PATTERNS[pattern].reactive);
    }
  });

  // Add custom state
  parts.state.push(...stateNeeds.customState);
  parts.handlers.push(...stateNeeds.customHandlers);
  parts.reactive.push(...stateNeeds.customReactive);

  return parts;
}

/**
 * Generate control flow templates
 */
function generateControlFlow(stateNeeds) {
  const templates = [];

  if (stateNeeds.patterns.includes('list')) {
    templates.push(`
    #if (isEmpty)
      <p class="empty-state">No items yet</p>
    #else
      <ul class="item-list">
        #each (items as item)
          <li key={item.id}>
            {item.text}
            <button @click="removeItem(item.id)">Remove</button>
          </li>
        #/each
      </ul>
    #/if`);
  }

  if (stateNeeds.patterns.includes('tabs')) {
    templates.push(`
    <div class="tab-navigation">
      #each (tabs as tab, index)
        <button 
          class="tab-button" 
          class:active={activeTab === index}
          @click="selectTab(index)"
        >
          {tab}
        </button>
      #/each
    </div>`);
  }

  if (stateNeeds.patterns.includes('form')) {
    templates.push(`
    #if (errors.name)
      <span class="error">{errors.name}</span>
    #/if
    
    #if (isSubmitting)
      <div class="loading">Submitting...</div>
    #else
      <button type="submit" :disabled={!isValid}>Submit</button>
    #/if`);
  }

  return templates;
}

/**
 * Generate recursive/looping structures for Turing completeness
 */
function generateTuringCompleteStructures() {
  return {
    fibonacci: `
  // Recursive Fibonacci (Turing complete)
  const fibonacci = (n) => {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  };`,
    
    factorial: `
  // Factorial with memoization
  const memo = {};
  const factorial = (n) => {
    if (n in memo) return memo[n];
    if (n <= 1) return 1;
    memo[n] = n * factorial(n - 1);
    return memo[n];
  };`,
    
    while: `
  // While loop simulation with recursion
  const whileLoop = (condition, action) => {
    if (condition()) {
      action();
      requestAnimationFrame(() => whileLoop(condition, action));
    }
  };`,
    
    stateMachine: `
  // Finite state machine
  const stateMachine = {
    states: { idle: 'idle', loading: 'loading', success: 'success', error: 'error' },
    current: 'idle',
    transitions: {
      idle: { start: 'loading' },
      loading: { success: 'success', fail: 'error' },
      success: { reset: 'idle' },
      error: { retry: 'loading', reset: 'idle' }
    },
    transition(action) {
      const nextState = this.transitions[this.current]?.[action];
      if (nextState) this.current = nextState;
      return this.current;
    }
  };`
  };
}

module.exports = {
  inferStateNeeds,
  generateStateManagement,
  generateControlFlow,
  generateTuringCompleteStructures,
  STATE_PATTERNS
};