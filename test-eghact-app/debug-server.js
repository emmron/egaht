import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join } from 'path';

const server = createServer(async (req, res) => {
  console.log(`Request: ${req.url}`);
  
  try {
    if (req.url === '/') {
      const html = await readFile('index.html', 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } else if (req.url === '/@eghact/runtime') {
      // Serve the runtime
      const runtime = await readFile('../runtime-pure/dist/eghact-runtime.dev.js', 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(runtime);
    } else if (req.url === '/src/main.js') {
      const main = await readFile('src/main.js', 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(main);
    } else if (req.url === '/src/App.js') {
      // Compile App.egh on the fly
      console.log('Compiling App.egh...');
      
      // For now, return a simple compiled version
      const compiled = `
import { h, Component, reactive, effect, computed } from '/@eghact/runtime';

export class App extends Component {
  constructor(props) {
    super(props);
    this.state = reactive({
      count: 0,
      message: "Hello Eghact!"
    });
    this.doubled = computed(() => this.state.count * 2);
  }

  onMount() {
    this._effects.push(effect(() => {
      console.log("Count changed to:", this.state.count);
    }));
  }

  render() {
    const { count, message } = this.state;
    return h('div', { 
      style: 'text-align: center; padding: 2rem;' 
    }, [
      h('h1', {}, message),
      h('p', {}, \`You clicked \${count} times\`),
      h('p', {}, \`Doubled: \${this.doubled.value}\`),
      h('div', { style: 'margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;' }, [
        h('button', { 
          onclick: () => this.state.count++,
          style: 'padding: 10px 20px; font-size: 16px; cursor: pointer;'
        }, 'Click me'),
        h('button', { 
          onclick: () => this.state.count = 0,
          style: 'padding: 10px 20px; font-size: 16px; cursor: pointer;'
        }, 'Reset')
      ]),
      count > 5 ? h('p', { 
        style: 'color: green; margin-top: 1rem;' 
      }, 'Great job! Keep clicking!') : null
    ]);
  }
}

export default App;
`;
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(compiled);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Server error: ' + err.message);
  }
});

const PORT = 3002;
server.listen(PORT, () => {
  console.log(`Debug server running at http://localhost:${PORT}`);
});