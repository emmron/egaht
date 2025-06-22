import { Option, Argument } from 'commander';
import chalk from 'chalk';
import fuzzy from 'fuzzy';
import autocomplete from 'inquirer-autocomplete-prompt';
import inquirer from 'inquirer';

inquirer.registerPrompt('autocomplete', autocomplete);

interface CommandSuggestion {
  value: string;
  description: string;
  aliases?: string[];
  options?: string[];
}

interface ParsedCommand {
  command: string;
  args: string[];
  options: Record<string, any>;
  raw: string;
}

export class EnhancedCommandParser {
  private commands: Map<string, CommandSuggestion> = new Map();
  private aliases: Map<string, string> = new Map();
  private history: string[] = [];
  private abbreviations: Map<string, string> = new Map();

  constructor() {
    this.initializeCommands();
    this.initializeAbbreviations();
  }

  private initializeCommands(): void {
    const commands: CommandSuggestion[] = [
      {
        value: 'create',
        description: 'Create a new Eghact project',
        aliases: ['c', 'new', 'init'],
        options: ['--template', '--directory', '--typescript', '--skip-install']
      },
      {
        value: 'generate',
        description: 'Generate a new component or resource',
        aliases: ['g', 'gen'],
        options: ['--type', '--directory', '--typescript', '--tests', '--stories']
      },
      {
        value: 'dev',
        description: 'Start development server',
        aliases: ['d', 'serve', 'start'],
        options: ['--port', '--host', '--open', '--https']
      },
      {
        value: 'build',
        description: 'Build for production',
        aliases: ['b', 'compile'],
        options: ['--output', '--analyze', '--prerender', '--sourcemap']
      },
      {
        value: 'test',
        description: 'Run tests',
        aliases: ['t'],
        options: ['--watch', '--coverage', '--update-snapshots']
      },
      {
        value: 'lint',
        description: 'Run linter',
        aliases: ['l'],
        options: ['--fix', '--format']
      },
      {
        value: 'format',
        description: 'Format code',
        aliases: ['f', 'fmt'],
        options: ['--write', '--check']
      },
      {
        value: 'deploy',
        description: 'Deploy application',
        aliases: ['d'],
        options: ['--environment', '--preview']
      },
      {
        value: 'info',
        description: 'Show project information',
        aliases: ['i'],
        options: ['--json', '--markdown']
      },
      {
        value: 'templates',
        description: 'List available templates',
        aliases: ['t', 'list-templates'],
        options: ['--category', '--json', '--official']
      },
      {
        value: 'help',
        description: 'Show help',
        aliases: ['h', '?'],
        options: []
      },
      {
        value: 'version',
        description: 'Show version',
        aliases: ['v', '-v', '--version'],
        options: []
      }
    ];

    // Register commands and aliases
    commands.forEach(cmd => {
      this.commands.set(cmd.value, cmd);
      cmd.aliases?.forEach(alias => {
        this.aliases.set(alias, cmd.value);
      });
    });
  }

  private initializeAbbreviations(): void {
    // Common abbreviations for faster typing
    this.abbreviations.set('cr', 'create');
    this.abbreviations.set('gc', 'generate component');
    this.abbreviations.set('gp', 'generate page');
    this.abbreviations.set('gs', 'generate store');
    this.abbreviations.set('bd', 'build');
    this.abbreviations.set('bda', 'build --analyze');
    this.abbreviations.set('dv', 'dev');
    this.abbreviations.set('dvo', 'dev --open');
    this.abbreviations.set('tst', 'test');
    this.abbreviations.set('tstw', 'test --watch');
    this.abbreviations.set('lnt', 'lint');
    this.abbreviations.set('lntf', 'lint --fix');
  }

  async parse(input: string): Promise<ParsedCommand> {
    // Store in history
    if (input.trim()) {
      this.history.push(input);
    }

    // Expand abbreviations
    const expandedInput = this.expandAbbreviations(input);

    // Split into parts
    const parts = this.tokenize(expandedInput);
    if (parts.length === 0) {
      throw new Error('No command provided');
    }

    // Extract command
    const commandPart = parts[0].toLowerCase();
    const resolvedCommand = this.resolveCommand(commandPart);

    // Parse arguments and options
    const { args, options } = this.parseArguments(parts.slice(1));

    return {
      command: resolvedCommand,
      args,
      options,
      raw: input
    };
  }

  private expandAbbreviations(input: string): string {
    const trimmed = input.trim();
    
    // Check if the entire input matches an abbreviation
    if (this.abbreviations.has(trimmed)) {
      return this.abbreviations.get(trimmed)!;
    }

    // Check if the first word matches an abbreviation
    const parts = trimmed.split(/\s+/);
    if (parts.length > 0 && this.abbreviations.has(parts[0])) {
      parts[0] = this.abbreviations.get(parts[0])!;
      return parts.join(' ');
    }

    return input;
  }

  private tokenize(input: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if (inQuotes) {
        if (char === quoteChar && input[i - 1] !== '\\') {
          inQuotes = false;
          tokens.push(current);
          current = '';
        } else {
          current += char;
        }
      } else {
        if ((char === '"' || char === "'") && current === '') {
          inQuotes = true;
          quoteChar = char;
        } else if (char === ' ' || char === '\t') {
          if (current) {
            tokens.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }

  private resolveCommand(command: string): string {
    // Direct match
    if (this.commands.has(command)) {
      return command;
    }

    // Check aliases
    if (this.aliases.has(command)) {
      return this.aliases.get(command)!;
    }

    // Fuzzy matching
    const suggestions = this.getSuggestions(command);
    if (suggestions.length === 1) {
      return suggestions[0].value;
    } else if (suggestions.length > 1) {
      throw new Error(`Ambiguous command '${command}'. Did you mean one of: ${suggestions.map(s => s.value).join(', ')}?`);
    }

    throw new Error(`Unknown command '${command}'`);
  }

  private parseArguments(parts: string[]): { args: string[], options: Record<string, any> } {
    const args: string[] = [];
    const options: Record<string, any> = {};
    
    let i = 0;
    while (i < parts.length) {
      const part = parts[i];
      
      if (part.startsWith('--')) {
        // Long option
        const [key, value] = this.parseOption(part.substring(2));
        if (value !== undefined) {
          options[key] = value;
        } else if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
          options[key] = parts[++i];
        } else {
          options[key] = true;
        }
      } else if (part.startsWith('-') && part.length > 1) {
        // Short options (can be combined like -abc)
        for (let j = 1; j < part.length; j++) {
          const shortOpt = part[j];
          if (j === part.length - 1 && i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
            options[shortOpt] = parts[++i];
          } else {
            options[shortOpt] = true;
          }
        }
      } else {
        // Regular argument
        args.push(part);
      }
      
      i++;
    }
    
    return { args, options };
  }

  private parseOption(option: string): [string, any] {
    const equalIndex = option.indexOf('=');
    if (equalIndex > -1) {
      const key = option.substring(0, equalIndex);
      const value = option.substring(equalIndex + 1);
      
      // Try to parse as number or boolean
      if (value === 'true') return [key, true];
      if (value === 'false') return [key, false];
      if (!isNaN(Number(value))) return [key, Number(value)];
      
      return [key, value];
    }
    
    return [option, undefined];
  }

  getSuggestions(partial: string): CommandSuggestion[] {
    const allCommands = Array.from(this.commands.values());
    
    if (!partial) {
      return allCommands;
    }

    // Use fuzzy matching
    const results = fuzzy.filter(partial, allCommands, {
      extract: (cmd) => cmd.value
    });

    return results.map(r => r.original);
  }

  async autocomplete(partial: string): Promise<string> {
    const suggestions = this.getSuggestions(partial);
    
    if (suggestions.length === 0) {
      return partial;
    }
    
    if (suggestions.length === 1) {
      return suggestions[0].value;
    }

    // Use inquirer for interactive selection
    const { selected } = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selected',
        message: 'Select command:',
        source: async (_: any, input: string) => {
          const filtered = this.getSuggestions(input || partial);
          return filtered.map(cmd => ({
            name: `${cmd.value} - ${chalk.gray(cmd.description)}`,
            value: cmd.value
          }));
        }
      }
    ]);

    return selected;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  getCommandHelp(command: string): string {
    const cmd = this.commands.get(this.resolveCommand(command));
    if (!cmd) {
      return `Unknown command: ${command}`;
    }

    let help = `${chalk.bold(cmd.value)} - ${cmd.description}\n`;
    
    if (cmd.aliases && cmd.aliases.length > 0) {
      help += `  Aliases: ${cmd.aliases.join(', ')}\n`;
    }
    
    if (cmd.options && cmd.options.length > 0) {
      help += `  Options:\n`;
      cmd.options.forEach(opt => {
        help += `    ${opt}\n`;
      });
    }

    return help;
  }

  getAllCommands(): CommandSuggestion[] {
    return Array.from(this.commands.values());
  }
}