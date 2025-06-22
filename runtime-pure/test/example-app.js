/**
 * Example app using pure Eghact runtime
 * Demonstrates components, reactivity, and WASM performance
 */

import { 
  h, 
  Component, 
  reactive, 
  createApp,
  useState,
  useEffect,
  createFunctionComponent
} from '../src/index.js';

// Function component with hooks
const Counter = createFunctionComponent((props) => {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('Click me!');
  
  useEffect(() => {
    console.log(`Count changed to: ${count}`);
    if (count > 5) {
      setMessage('Wow, that\'s a lot of clicks!');
    }
  }, [count]);
  
  return h('div', { class: 'counter' }, [
    h('h2', {}, props.title || 'Counter'),
    h('p', {}, `Count: ${count}`),
    h('p', {}, message),
    h('button', { 
      '@click': () => setCount(count + 1),
      class: 'btn btn-primary'
    }, 'Increment'),
    h('button', { 
      '@click': () => setCount(0),
      class: 'btn btn-secondary'
    }, 'Reset')
  ]);
});

// Class component
class TodoList extends Component {
  constructor(props) {
    super(props);
    this.state = reactive({
      todos: [],
      inputValue: ''
    });
  }
  
  addTodo() {
    if (this.state.inputValue.trim()) {
      this.state.todos.push({
        id: Date.now(),
        text: this.state.inputValue,
        completed: false
      });
      this.state.inputValue = '';
    }
  }
  
  toggleTodo(id) {
    const todo = this.state.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  }
  
  removeTodo(id) {
    const index = this.state.todos.findIndex(t => t.id === id);
    if (index !== -1) {
      this.state.todos.splice(index, 1);
    }
  }
  
  render() {
    return h('div', { class: 'todo-list' }, [
      h('h2', {}, 'Todo List'),
      h('div', { class: 'todo-input' }, [
        h('input', {
          type: 'text',
          value: this.state.inputValue,
          '@input': (e) => this.state.inputValue = e.target.value,
          '@keydown': (e) => e.key === 'Enter' && this.addTodo(),
          placeholder: 'Add a todo...'
        }),
        h('button', {
          '@click': () => this.addTodo(),
          class: 'btn btn-primary'
        }, 'Add')
      ]),
      h('ul', { class: 'todo-items' }, 
        this.state.todos.map(todo => 
          h('li', { 
            key: todo.id,
            class: todo.completed ? 'completed' : ''
          }, [
            h('input', {
              type: 'checkbox',
              checked: todo.completed,
              '@change': () => this.toggleTodo(todo.id)
            }),
            h('span', {}, todo.text),
            h('button', {
              '@click': () => this.removeTodo(todo.id),
              class: 'btn btn-danger btn-sm'
            }, 'Delete')
          ])
        )
      ),
      h('p', {}, `Total: ${this.state.todos.length}, Completed: ${this.state.todos.filter(t => t.completed).length}`)
    ]);
  }
}

// Main App component
class App extends Component {
  render() {
    return h('div', { id: 'app' }, [
      h('h1', {}, 'Eghact Pure Runtime Demo'),
      h('p', {}, 'Zero dependencies, maximum performance!'),
      h(Counter, { title: 'My Counter' }),
      h('hr', {}),
      h(TodoList, {})
    ]);
  }
}

// Create and mount app
async function main() {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }
  
  try {
    const app = await createApp(App, rootElement);
    app.mount();
    
    console.log('Eghact app running in pure mode');
  } catch (error) {
    console.error('Failed to start app:', error);
  }
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}