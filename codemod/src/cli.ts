#!/usr/bin/env node

import { Command } from 'commander';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ReactToEghactMigrator } from './index';

const program = new Command();

program
  .name('eghact-migrate')
  .description('Migrate React components to Eghact framework')
  .version('1.0.0');

program
  .command('convert')
  .description('Convert React files to Eghact components')
  .argument('<input>', 'Input file or glob pattern')
  .option('-o, --output <dir>', 'Output directory')
  .option('-a, --analyze', 'Analyze only, don\'t convert')
  .option('-v, --verbose', 'Verbose output')
  .action(async (input: string, options: any) => {
    const spinner = ora('Finding React components...').start();
    
    try {
      // Find all matching files
      const files = await glob(input, {
        ignore: ['node_modules/**', 'dist/**', 'build/**']
      });
      
      if (files.length === 0) {
        spinner.fail('No files found matching pattern');
        return;
      }
      
      spinner.succeed(`Found ${files.length} file(s)`);
      
      const migrator = new ReactToEghactMigrator();
      let successCount = 0;
      let warningCount = 0;
      let errorCount = 0;
      
      for (const file of files) {
        const fileSpinner = ora(`Processing ${file}...`).start();
        
        try {
          const code = await fs.readFile(file, 'utf-8');
          const result = await migrator.migrate(code, {
            input: file,
            output: options.output ? 
              path.join(options.output, path.basename(file).replace(/\.(jsx?|tsx?)$/, '.egh')) :
              undefined,
            analyze: options.analyze,
            verbose: options.verbose
          });
          
          if (result.success && !options.analyze) {
            await fs.writeFile(result.outputPath, code);
            fileSpinner.succeed(chalk.green(`✓ ${file} → ${result.outputPath}`));
            successCount++;
          } else if (result.success) {
            fileSpinner.succeed(chalk.blue(`✓ ${file} (analysis complete)`));
            successCount++;
          } else {
            fileSpinner.fail(chalk.red(`✗ ${file}`));
            errorCount++;
          }
          
          // Show warnings
          if (result.warnings.length > 0) {
            warningCount += result.warnings.length;
            result.warnings.forEach(w => {
              console.log(chalk.yellow(`  ⚠ Line ${w.line}: ${w.message}`));
            });
          }
          
          // Show manual steps
          if (result.manualSteps.length > 0 && options.verbose) {
            console.log(chalk.cyan('  Manual steps required:'));
            result.manualSteps.forEach((step, i) => {
              console.log(chalk.cyan(`    ${i + 1}. ${step}`));
            });
          }
        } catch (error) {
          fileSpinner.fail(chalk.red(`✗ ${file}: ${error}`));
          errorCount++;
        }
      }
      
      // Summary
      console.log('\n' + chalk.bold('Migration Summary:'));
      console.log(chalk.green(`  ✓ Success: ${successCount}`));
      console.log(chalk.yellow(`  ⚠ Warnings: ${warningCount}`));
      console.log(chalk.red(`  ✗ Errors: ${errorCount}`));
      
      if (successCount > 0 && !options.analyze) {
        console.log('\n' + chalk.bold('Next steps:'));
        console.log('  1. Review the generated .egh files');
        console.log('  2. Fix any compilation errors');
        console.log('  3. Test your components');
        console.log('  4. Remove the original React files');
      }
    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze React codebase for migration complexity')
  .argument('<input>', 'Input directory or glob pattern')
  .action(async (input: string) => {
    const spinner = ora('Analyzing React codebase...').start();
    
    try {
      const files = await glob(input, {
        ignore: ['node_modules/**', 'dist/**', 'build/**']
      });
      
      const stats = {
        totalFiles: files.length,
        functionalComponents: 0,
        classComponents: 0,
        hooks: new Map<string, number>(),
        libraries: new Set<string>()
      };
      
      for (const file of files) {
        const code = await fs.readFile(file, 'utf-8');
        
        // Simple analysis (would be more sophisticated in production)
        if (code.includes('extends Component') || code.includes('extends React.Component')) {
          stats.classComponents++;
        } else if (code.match(/function\s+[A-Z]\w*\s*\(|const\s+[A-Z]\w*\s*=/)) {
          stats.functionalComponents++;
        }
        
        // Count hooks
        const hookMatches = code.matchAll(/use[A-Z]\w*/g);
        for (const match of hookMatches) {
          const hook = match[0];
          stats.hooks.set(hook, (stats.hooks.get(hook) || 0) + 1);
        }
        
        // Detect libraries
        const importMatches = code.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
        for (const match of importMatches) {
          stats.libraries.add(match[1]);
        }
      }
      
      spinner.succeed('Analysis complete');
      
      console.log('\n' + chalk.bold('Codebase Analysis:'));
      console.log(`  Total files: ${stats.totalFiles}`);
      console.log(`  Functional components: ${stats.functionalComponents}`);
      console.log(`  Class components: ${stats.classComponents}`);
      
      console.log('\n' + chalk.bold('Hook Usage:'));
      Array.from(stats.hooks.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([hook, count]) => {
          console.log(`  ${hook}: ${count}`);
        });
      
      console.log('\n' + chalk.bold('Detected Libraries:'));
      Array.from(stats.libraries)
        .filter(lib => !lib.startsWith('.'))
        .slice(0, 10)
        .forEach(lib => {
          console.log(`  - ${lib}`);
        });
      
      const complexity = stats.classComponents > stats.functionalComponents ? 'High' :
                        stats.hooks.size > 10 ? 'Medium' : 'Low';
      
      console.log('\n' + chalk.bold(`Migration Complexity: ${complexity}`));
      
      if (stats.classComponents > 0) {
        console.log(chalk.yellow('\n⚠ Class components will require more manual work'));
      }
    } catch (error) {
      spinner.fail(chalk.red(`Error: ${error}`));
      process.exit(1);
    }
  });

program.parse();