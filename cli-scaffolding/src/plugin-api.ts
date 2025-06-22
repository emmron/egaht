import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { 
  CLIPluginAPI, 
  CLICommand, 
  AutocompleteProvider,
  CommandOption 
} from './plugin-loader';
import { EnhancedCommandParser } from './command-parser';

interface PluginCommand extends CLICommand {
  pluginName?: string;
}

export class PluginAPI implements CLIPluginAPI {
  private registeredCommands = new Map<string, PluginCommand>();
  private commandAliases = new Map<string, string>();
  private autocompleteProviders = new Map<string, AutocompleteProvider[]>();
  private logger = console;

  constructor(
    private program: Command,
    private parser: EnhancedCommandParser,
    private config: any = {}
  ) {}

  registerCommand(command: CLICommand): void {
    if (this.registeredCommands.has(command.name)) {
      throw new Error(`Command '${command.name}' is already registered`);
    }

    // Store command metadata
    this.registeredCommands.set(command.name, command);

    // Create commander command
    const cmd = this.program
      .command(command.name)
      .description(command.description);

    // Add options
    if (command.options) {
      for (const option of command.options) {
        const flags = this.buildOptionFlags(option);
        const description = option.description || '';
        
        if (option.default !== undefined) {
          cmd.option(flags, description, option.default);
        } else {
          cmd.option(flags, description);
        }
      }
    }

    // Set action handler
    cmd.action(async (...args) => {
      try {
        // Extract options from last argument
        const options = args[args.length - 1];
        const commandArgs = args.slice(0, -1);

        // Call plugin handler
        await command.handler({
          args: commandArgs,
          options: options.opts ? options.opts() : options
        });
      } catch (error) {
        console.error(chalk.red(`Plugin command error: ${error instanceof Error ? error.message : error}`));
        process.exit(1);
      }
    });

    // Update parser suggestions
    this.updateParserSuggestions();
  }

  addAlias(alias: string, command: string): void {
    if (this.commandAliases.has(alias)) {
      throw new Error(`Alias '${alias}' is already registered`);
    }

    this.commandAliases.set(alias, command);
    
    // Register alias with commander
    const cmd = this.program.commands.find(c => c.name() === command);
    if (cmd) {
      cmd.alias(alias);
    }

    // Update parser
    this.updateParserSuggestions();
  }

  registerAutocomplete(provider: AutocompleteProvider): void {
    if (!this.autocompleteProviders.has(provider.command)) {
      this.autocompleteProviders.set(provider.command, []);
    }
    
    this.autocompleteProviders.get(provider.command)!.push(provider);
  }

  getConfig(): any {
    return { ...this.config };
  }

  getLogger(): any {
    return this.logger;
  }

  async prompt(question: string): Promise<string> {
    const { answer } = await inquirer.prompt([
      {
        type: 'input',
        name: 'answer',
        message: question
      }
    ]);
    return answer;
  }

  // Internal methods

  private buildOptionFlags(option: CommandOption): string {
    const shortFlag = option.name.charAt(0);
    const longFlag = option.name.replace(/^--?/, '');
    
    let flags = `-${shortFlag}, --${longFlag}`;
    
    if (option.type && option.type !== 'boolean') {
      flags += ` <${option.type}>`;
    }
    
    return flags;
  }

  private updateParserSuggestions(): void {
    // This would integrate with the command parser
    // to update autocomplete suggestions
    // For now, it's a placeholder
  }

  // Methods for plugin management

  getRegisteredCommands(): Map<string, PluginCommand> {
    return new Map(this.registeredCommands);
  }

  getCommandAliases(): Map<string, string> {
    return new Map(this.commandAliases);
  }

  async getAutocompleteOptions(command: string, partial: string): Promise<string[]> {
    const providers = this.autocompleteProviders.get(command);
    if (!providers || providers.length === 0) {
      return [];
    }

    const allOptions: string[] = [];
    
    for (const provider of providers) {
      try {
        const options = await provider.provider(partial);
        allOptions.push(...options);
      } catch (error) {
        // Ignore provider errors
      }
    }

    // Deduplicate
    return [...new Set(allOptions)];
  }

  // Check if a command is from a plugin
  isPluginCommand(command: string): boolean {
    return this.registeredCommands.has(command) || 
           this.commandAliases.has(command);
  }

  // Get the actual command name (resolve aliases)
  resolveCommand(command: string): string {
    if (this.commandAliases.has(command)) {
      return this.commandAliases.get(command)!;
    }
    return command;
  }
}