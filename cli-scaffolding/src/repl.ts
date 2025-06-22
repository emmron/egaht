import * as repl from 'repl';
import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { EnhancedCommandParser } from './command-parser';
import { Command } from 'commander';
import { VM } from 'vm2';
import * as readline from 'readline';

interface REPLContext {
  currentProject?: string;
  lastResult?: any;
  debugMode: boolean;
  verboseMode: boolean;
  watchMode: boolean;
  variables: Map<string, any>;
}

interface REPLCommand {
  name: string;
  description: string;
  handler: (args: string[], context: REPLContext) => Promise<any>;
}

export class EghactREPL {
  private parser: EnhancedCommandParser;
  private context: REPLContext;
  private replServer?: repl.REPLServer;
  private commands: Map<string, REPLCommand> = new Map();
  private watchers: Map<string, any> = new Map();
  private vm: VM;
  private historyFile: string;

  constructor(private cliProgram: Command) {
    this.parser = new EnhancedCommandParser();
    this.context = {
      debugMode: false,
      verboseMode: false,
      watchMode: false,
      variables: new Map()
    };
    
    this.vm = new VM({
      timeout: 5000,
      sandbox: {
        console,
        chalk,
        require,
        __dirname: process.cwd()
      }
    });

    this.historyFile = path.join(process.env.HOME || '.', '.eghact_repl_history');
    this.initializeCommands();
  }

  private initializeCommands(): void {
    // REPL-specific commands
    const replCommands: REPLCommand[] = [
      {
        name: '.debug',
        description: 'Toggle debug mode',
        handler: async (args, ctx) => {
          ctx.debugMode = !ctx.debugMode;
          return `Debug mode: ${ctx.debugMode ? 'ON' : 'OFF'}`;
        }
      },
      {
        name: '.verbose',
        description: 'Toggle verbose mode',
        handler: async (args, ctx) => {
          ctx.verboseMode = !ctx.verboseMode;
          return `Verbose mode: ${ctx.verboseMode ? 'ON' : 'OFF'}`;
        }
      },
      {
        name: '.watch',
        description: 'Watch files for changes',
        handler: async (args, ctx) => {
          if (args.length === 0) {
            ctx.watchMode = !ctx.watchMode;
            return `Watch mode: ${ctx.watchMode ? 'ON' : 'OFF'}`;
          }
          
          const filePath = args[0];
          if (this.watchers.has(filePath)) {
            this.watchers.get(filePath).close();
            this.watchers.delete(filePath);
            return `Stopped watching: ${filePath}`;
          } else {
            await this.watchFile(filePath);
            return `Watching: ${filePath}`;
          }
        }
      },
      {
        name: '.exec',
        description: 'Execute JavaScript code',
        handler: async (args, ctx) => {
          const code = args.join(' ');
          try {
            const result = this.vm.run(code);
            ctx.lastResult = result;
            return result;
          } catch (error) {
            throw new Error(`Execution error: ${error instanceof Error ? error.message : error}`);
          }
        }
      },
      {
        name: '.load',
        description: 'Load and execute a file',
        handler: async (args, ctx) => {
          if (args.length === 0) {
            throw new Error('Please provide a file path');
          }
          
          const filePath = path.resolve(args[0]);
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }
          
          const content = fs.readFileSync(filePath, 'utf8');
          const ext = path.extname(filePath);
          
          if (ext === '.js' || ext === '.ts') {
            try {
              const result = this.vm.run(content);
              ctx.lastResult = result;
              return `Loaded and executed: ${filePath}`;
            } catch (error) {
              throw new Error(`Execution error: ${error instanceof Error ? error.message : error}`);
            }
          } else {
            return content;
          }
        }
      },
      {
        name: '.save',
        description: 'Save REPL session to file',
        handler: async (args, ctx) => {
          if (args.length === 0) {
            throw new Error('Please provide a file path');
          }
          
          const filePath = path.resolve(args[0]);
          const history = this.replServer?.history || [];
          const content = history.slice().reverse().join('\n');
          
          fs.writeFileSync(filePath, content, 'utf8');
          return `Session saved to: ${filePath}`;
        }
      },
      {
        name: '.project',
        description: 'Switch to a project directory',
        handler: async (args, ctx) => {
          if (args.length === 0) {
            return `Current project: ${ctx.currentProject || 'none'}`;
          }
          
          const projectPath = path.resolve(args[0]);
          if (!fs.existsSync(projectPath)) {
            throw new Error(`Directory not found: ${projectPath}`);
          }
          
          process.chdir(projectPath);
          ctx.currentProject = projectPath;
          
          // Load project-specific context
          await this.loadProjectContext(projectPath);
          
          return `Switched to project: ${projectPath}`;
        }
      },
      {
        name: '.inspect',
        description: 'Inspect Eghact components',
        handler: async (args, ctx) => {
          if (args.length === 0) {
            throw new Error('Please provide a component path');
          }
          
          const componentPath = path.resolve(args[0]);
          if (!fs.existsSync(componentPath)) {
            throw new Error(`Component not found: ${componentPath}`);
          }
          
          const content = fs.readFileSync(componentPath, 'utf8');
          const analysis = this.analyzeComponent(content);
          
          return this.formatComponentAnalysis(analysis);
        }
      },
      {
        name: '.benchmark',
        description: 'Benchmark a command or code',
        handler: async (args, ctx) => {
          if (args.length === 0) {
            throw new Error('Please provide a command or code to benchmark');
          }
          
          const code = args.join(' ');
          const iterations = 1000;
          
          const start = process.hrtime.bigint();
          
          for (let i = 0; i < iterations; i++) {
            try {
              if (code.startsWith('.')) {
                // REPL command
                await this.executeREPLCommand(code, ctx);
              } else {
                // JavaScript code
                this.vm.run(code);
              }
            } catch (error) {
              // Ignore errors during benchmark
            }
          }
          
          const end = process.hrtime.bigint();
          const duration = Number(end - start) / 1000000; // Convert to milliseconds
          const average = duration / iterations;
          
          return {
            command: code,
            iterations,
            totalTime: `${duration.toFixed(2)}ms`,
            averageTime: `${average.toFixed(4)}ms`
          };
        }
      },
      {
        name: '.clear',
        description: 'Clear the screen',
        handler: async () => {
          process.stdout.write('\x1Bc');
          return 'Screen cleared';
        }
      },
      {
        name: '.variables',
        description: 'List stored variables',
        handler: async (args, ctx) => {
          if (ctx.variables.size === 0) {
            return 'No variables stored';
          }
          
          const vars = Array.from(ctx.variables.entries())
            .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
            .join('\n');
          
          return vars;
        }
      },
      {
        name: '.set',
        description: 'Set a variable',
        handler: async (args, ctx) => {
          if (args.length < 2) {
            throw new Error('Usage: .set <name> <value>');
          }
          
          const name = args[0];
          const value = args.slice(1).join(' ');
          
          try {
            // Try to parse as JSON
            ctx.variables.set(name, JSON.parse(value));
          } catch {
            // Store as string if not valid JSON
            ctx.variables.set(name, value);
          }
          
          return `Variable '${name}' set`;
        }
      },
      {
        name: '.get',
        description: 'Get a variable value',
        handler: async (args, ctx) => {
          if (args.length === 0) {
            throw new Error('Please provide a variable name');
          }
          
          const name = args[0];
          if (!ctx.variables.has(name)) {
            throw new Error(`Variable '${name}' not found`);
          }
          
          return ctx.variables.get(name);
        }
      }
    ];

    replCommands.forEach(cmd => {
      this.commands.set(cmd.name, cmd);
    });
  }

  async start(): Promise<void> {
    console.clear();
    this.printWelcome();

    // Load history
    this.loadHistory();

    this.replServer = repl.start({
      prompt: this.getPrompt(),
      eval: this.evaluate.bind(this),
      writer: this.writer.bind(this),
      completer: this.completer.bind(this)
    });

    // Set up history
    this.setupHistory();

    // Handle exit
    this.replServer.on('exit', () => {
      this.cleanup();
      console.log(chalk.yellow('\n👋 Goodbye!'));
      process.exit(0);
    });

    // Add custom commands
    this.commands.forEach((cmd, name) => {
      this.replServer!.defineCommand(name.substring(1), {
        help: cmd.description,
        action: async (args: string) => {
          try {
            const result = await cmd.handler(args.split(' ').filter(Boolean), this.context);
            console.log(this.writer(result));
          } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
          }
          this.replServer!.displayPrompt();
        }
      });
    });
  }

  private printWelcome(): void {
    console.log(chalk.cyan('╔═══════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.white('   🚀 Eghact Interactive REPL v1.0.0                   ') + chalk.cyan('║'));
    console.log(chalk.cyan('╠═══════════════════════════════════════════════════════╣'));
    console.log(chalk.cyan('║') + chalk.gray(' Type .help for available commands                     ') + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.gray(' Use TAB for autocomplete                              ') + chalk.cyan('║'));
    console.log(chalk.cyan('║') + chalk.gray(' Press Ctrl+C to exit                                  ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════════════╝'));
    console.log();
  }

  private getPrompt(): string {
    const projectName = this.context.currentProject 
      ? path.basename(this.context.currentProject)
      : 'no-project';
    
    const debugIndicator = this.context.debugMode ? chalk.red('[DEBUG]') : '';
    const watchIndicator = this.context.watchMode ? chalk.yellow('[WATCH]') : '';
    
    return `${debugIndicator}${watchIndicator}${chalk.blue(projectName)} ${chalk.green('>')} `;
  }

  private async evaluate(
    cmd: string,
    context: any,
    filename: string,
    callback: (err: Error | null, result: any) => void
  ): Promise<void> {
    try {
      // Remove trailing newline
      const trimmedCmd = cmd.trim();
      
      if (!trimmedCmd) {
        callback(null, undefined);
        return;
      }

      // Check if it's a REPL command
      if (trimmedCmd.startsWith('.')) {
        const result = await this.executeREPLCommand(trimmedCmd, this.context);
        callback(null, result);
        return;
      }

      // Try to parse as Eghact CLI command
      try {
        const parsed = await this.parser.parse(trimmedCmd);
        const result = await this.executeCLICommand(parsed);
        callback(null, result);
      } catch (parseError) {
        // If not a valid CLI command, try to evaluate as JavaScript
        try {
          const result = this.vm.run(trimmedCmd);
          this.context.lastResult = result;
          callback(null, result);
        } catch (jsError) {
          callback(new Error(`Invalid command or expression: ${trimmedCmd}`), undefined);
        }
      }
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)), undefined);
    }
  }

  private async executeREPLCommand(cmd: string, context: REPLContext): Promise<any> {
    const parts = cmd.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    const replCmd = this.commands.get(command);
    if (replCmd) {
      return await replCmd.handler(args, context);
    }

    throw new Error(`Unknown REPL command: ${command}`);
  }

  private async executeCLICommand(parsed: any): Promise<any> {
    const spinner = ora(`Executing: ${parsed.command}`).start();
    
    try {
      // Simulate CLI command execution
      await new Promise(resolve => setTimeout(resolve, 500));
      
      spinner.succeed(`Executed: ${parsed.command}`);
      
      return {
        command: parsed.command,
        args: parsed.args,
        options: parsed.options,
        status: 'success'
      };
    } catch (error) {
      spinner.fail(`Failed: ${parsed.command}`);
      throw error;
    }
  }

  private writer(output: any): string {
    if (output === undefined) {
      return '';
    }

    if (typeof output === 'string') {
      return output;
    }

    if (output instanceof Error) {
      return chalk.red(output.stack || output.message);
    }

    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  }

  private completer(line: string): [string[], string] {
    const completions: string[] = [];

    // Add REPL commands
    this.commands.forEach((cmd, name) => {
      completions.push(name);
    });

    // Add CLI commands
    const cliCommands = this.parser.getAllCommands();
    cliCommands.forEach(cmd => {
      completions.push(cmd.value);
      cmd.aliases?.forEach(alias => completions.push(alias));
    });

    // Add variables
    this.context.variables.forEach((_, name) => {
      completions.push(name);
    });

    const hits = completions.filter(c => c.startsWith(line));
    return [hits.length ? hits : completions, line];
  }

  private async watchFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }

    const watcher = fs.watch(absolutePath, async (eventType, filename) => {
      console.log(chalk.yellow(`\n📝 File ${eventType}: ${filename}`));
      
      if (this.context.debugMode) {
        console.log(chalk.gray(`Full path: ${absolutePath}`));
        console.log(chalk.gray(`Event type: ${eventType}`));
      }

      // Auto-reload if it's a component
      if (absolutePath.endsWith('.egh')) {
        try {
          const content = fs.readFileSync(absolutePath, 'utf8');
          const analysis = this.analyzeComponent(content);
          console.log(chalk.green('Component updated successfully'));
          
          if (this.context.verboseMode) {
            console.log(this.formatComponentAnalysis(analysis));
          }
        } catch (error) {
          console.error(chalk.red(`Error reloading component: ${error instanceof Error ? error.message : error}`));
        }
      }

      this.replServer?.displayPrompt();
    });

    this.watchers.set(filePath, watcher);
  }

  private analyzeComponent(content: string): any {
    // Simple component analysis
    const lines = content.split('\n');
    const analysis = {
      template: false,
      script: false,
      style: false,
      props: [],
      methods: [],
      lineCount: lines.length
    };

    let inTemplate = false;
    let inScript = false;
    let inStyle = false;

    lines.forEach(line => {
      if (line.includes('<template>')) {
        inTemplate = true;
        analysis.template = true;
      } else if (line.includes('</template>')) {
        inTemplate = false;
      } else if (line.includes('<script>')) {
        inScript = true;
        analysis.script = true;
      } else if (line.includes('</script>')) {
        inScript = false;
      } else if (line.includes('<style>')) {
        inStyle = true;
        analysis.style = true;
      } else if (line.includes('</style>')) {
        inStyle = false;
      }

      // Extract props and methods (simplified)
      if (inScript) {
        if (line.includes('function ')) {
          const match = line.match(/function\s+(\w+)/);
          if (match) {
            analysis.methods.push(match[1]);
          }
        }
      }
    });

    return analysis;
  }

  private formatComponentAnalysis(analysis: any): string {
    let output = chalk.blue('\nComponent Analysis:\n');
    output += chalk.gray('─'.repeat(30)) + '\n';
    output += `Template: ${analysis.template ? chalk.green('✓') : chalk.red('✗')}\n`;
    output += `Script:   ${analysis.script ? chalk.green('✓') : chalk.red('✗')}\n`;
    output += `Style:    ${analysis.style ? chalk.green('✓') : chalk.red('✗')}\n`;
    output += `Lines:    ${analysis.lineCount}\n`;
    
    if (analysis.methods.length > 0) {
      output += `Methods:  ${analysis.methods.join(', ')}\n`;
    }

    return output;
  }

  private async loadProjectContext(projectPath: string): Promise<void> {
    try {
      // Load package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        this.context.variables.set('package', packageJson);
      }

      // Load eghact.config.js
      const configPath = path.join(projectPath, 'eghact.config.js');
      if (fs.existsSync(configPath)) {
        // In real implementation, would dynamically import the config
        this.context.variables.set('config', { loaded: true });
      }
    } catch (error) {
      if (this.context.debugMode) {
        console.error(chalk.red(`Error loading project context: ${error}`));
      }
    }
  }

  private loadHistory(): void {
    try {
      if (fs.existsSync(this.historyFile)) {
        const history = fs.readFileSync(this.historyFile, 'utf8')
          .split('\n')
          .filter(Boolean);
        
        // Will be applied to REPL server after creation
      }
    } catch (error) {
      // Ignore history errors
    }
  }

  private setupHistory(): void {
    if (!this.replServer) return;

    // Save history on exit
    const originalClose = this.replServer.close.bind(this.replServer);
    this.replServer.close = () => {
      this.saveHistory();
      originalClose();
    };
  }

  private saveHistory(): void {
    if (!this.replServer) return;

    try {
      const history = this.replServer.history.slice(0, 1000); // Keep last 1000 entries
      fs.writeFileSync(this.historyFile, history.join('\n'), 'utf8');
    } catch (error) {
      // Ignore history save errors
    }
  }

  private cleanup(): void {
    // Close all watchers
    this.watchers.forEach(watcher => watcher.close());
    this.watchers.clear();

    // Save history
    this.saveHistory();

    // Clean up VM
    this.vm = null as any;
  }
}