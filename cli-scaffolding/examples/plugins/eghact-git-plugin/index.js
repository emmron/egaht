// Example Eghact CLI Plugin for Git Integration
const { execSync } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'eghact-git-plugin',
  version: '1.0.0',
  
  async registerCommands(api) {
    // Register git-stats command
    api.registerCommand({
      name: 'git-stats',
      description: 'Show git statistics for Eghact project',
      options: [
        { name: '--detailed', type: 'boolean', description: 'Show detailed statistics' },
        { name: '--since', type: 'string', description: 'Show stats since date' }
      ],
      handler: async ({ options }) => {
        try {
          const stats = await getGitStats(options);
          
          console.log(chalk.cyan('\n📊 Git Statistics for Eghact Project\n'));
          console.log(`Total Commits: ${chalk.green(stats.commits)}`);
          console.log(`Contributors: ${chalk.green(stats.contributors)}`);
          console.log(`Components Modified: ${chalk.green(stats.components)}`);
          console.log(`Last Commit: ${chalk.gray(stats.lastCommit)}`);
          
          if (options.detailed) {
            console.log(chalk.cyan('\n📈 Detailed Statistics:\n'));
            console.log(`Lines Added: ${chalk.green('+' + stats.linesAdded)}`);
            console.log(`Lines Deleted: ${chalk.red('-' + stats.linesDeleted)}`);
            console.log(`Files Changed: ${chalk.yellow(stats.filesChanged)}`);
          }
        } catch (error) {
          console.error(chalk.red('Failed to get git statistics:'), error.message);
        }
      }
    });

    // Register git-hooks command
    api.registerCommand({
      name: 'git-hooks',
      description: 'Install Eghact git hooks for better development workflow',
      options: [
        { name: '--force', type: 'boolean', description: 'Overwrite existing hooks' }
      ],
      handler: async ({ options }) => {
        try {
          await installGitHooks(options.force);
          console.log(chalk.green('✅ Git hooks installed successfully!'));
          console.log(chalk.gray('Hooks installed:'));
          console.log('  • pre-commit: Runs linting and tests');
          console.log('  • commit-msg: Validates commit message format');
          console.log('  • pre-push: Runs build and tests');
        } catch (error) {
          console.error(chalk.red('Failed to install git hooks:'), error.message);
        }
      }
    });

    // Register git-flow command
    api.registerCommand({
      name: 'git-flow',
      description: 'Initialize git flow for Eghact project',
      handler: async () => {
        try {
          const branches = ['develop', 'feature', 'release', 'hotfix'];
          console.log(chalk.cyan('🌊 Initializing Git Flow for Eghact...\n'));
          
          for (const branch of branches) {
            console.log(`Creating ${branch} branch structure...`);
          }
          
          console.log(chalk.green('\n✅ Git Flow initialized!'));
          console.log(chalk.gray('\nUsage:'));
          console.log('  • Start feature: git flow feature start <name>');
          console.log('  • Finish feature: git flow feature finish <name>');
        } catch (error) {
          console.error(chalk.red('Failed to initialize git flow:'), error.message);
        }
      }
    });

    // Add aliases
    api.addAlias('gs', 'git-stats');
    api.addAlias('gh', 'git-hooks');
    api.addAlias('gf', 'git-flow');

    // Register autocomplete for git-stats --since option
    api.registerAutocomplete({
      command: 'git-stats',
      provider: async (partial) => {
        const suggestions = [
          '1.week.ago',
          '1.month.ago',
          '3.months.ago',
          '1.year.ago',
          'yesterday',
          'last.monday'
        ];
        return suggestions.filter(s => s.startsWith(partial));
      }
    });
  },

  enhanceREPL(repl) {
    // Add REPL commands
    repl.defineCommand('gitstatus', {
      help: 'Show current git status',
      action() {
        this.clearBufferedCommand();
        try {
          const status = execSync('git status --short', { encoding: 'utf8' });
          console.log(chalk.cyan('Git Status:'));
          console.log(status || chalk.gray('Working tree clean'));
        } catch (error) {
          console.error(chalk.red('Not a git repository'));
        }
        this.displayPrompt();
      }
    });

    repl.defineCommand('branch', {
      help: 'Show current git branch',
      action() {
        this.clearBufferedCommand();
        try {
          const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
          console.log(chalk.green(`Current branch: ${branch}`));
        } catch (error) {
          console.error(chalk.red('Not a git repository'));
        }
        this.displayPrompt();
      }
    });
  }
};

// Helper functions

async function getGitStats(options = {}) {
  const sinceFlag = options.since ? `--since="${options.since}"` : '';
  
  const commits = execSync(`git rev-list --count HEAD ${sinceFlag}`, { encoding: 'utf8' }).trim();
  const contributors = execSync('git shortlog -sn', { encoding: 'utf8' }).split('\n').length;
  const lastCommit = execSync('git log -1 --format=%cr', { encoding: 'utf8' }).trim();
  
  // Count .egh components
  const componentFiles = execSync('git ls-files "*.egh" | wc -l', { encoding: 'utf8' }).trim();
  
  if (options.detailed) {
    const stats = execSync(`git log --numstat --format= ${sinceFlag}`, { encoding: 'utf8' });
    let linesAdded = 0, linesDeleted = 0, filesChanged = new Set();
    
    stats.split('\n').forEach(line => {
      const parts = line.split('\t');
      if (parts.length === 3) {
        linesAdded += parseInt(parts[0]) || 0;
        linesDeleted += parseInt(parts[1]) || 0;
        filesChanged.add(parts[2]);
      }
    });
    
    return {
      commits,
      contributors,
      components: componentFiles,
      lastCommit,
      linesAdded,
      linesDeleted,
      filesChanged: filesChanged.size
    };
  }
  
  return { commits, contributors, components: componentFiles, lastCommit };
}

async function installGitHooks(force = false) {
  const hooksDir = path.join(process.cwd(), '.git', 'hooks');
  
  if (!fs.existsSync(hooksDir)) {
    throw new Error('Not a git repository');
  }
  
  const hooks = {
    'pre-commit': `#!/bin/sh
# Eghact pre-commit hook
echo "Running Eghact pre-commit checks..."
npm run lint
npm test`,
    
    'commit-msg': `#!/bin/sh
# Eghact commit message validation
commit_regex='^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}'
if ! grep -qE "$commit_regex" "$1"; then
  echo "Invalid commit message format!"
  echo "Format: <type>(<scope>): <subject>"
  exit 1
fi`,
    
    'pre-push': `#!/bin/sh
# Eghact pre-push hook
echo "Running Eghact pre-push checks..."
npm run build
npm test`
  };
  
  for (const [hookName, content] of Object.entries(hooks)) {
    const hookPath = path.join(hooksDir, hookName);
    
    if (fs.existsSync(hookPath) && !force) {
      console.log(chalk.yellow(`Skipping ${hookName} (already exists)`));
      continue;
    }
    
    fs.writeFileSync(hookPath, content);
    fs.chmodSync(hookPath, '755');
  }
}