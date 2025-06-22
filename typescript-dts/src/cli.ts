#!/usr/bin/env node

import { Command } from 'commander';
import { DtsGenerator } from './DtsGenerator';
import fs from 'fs';
import { glob } from 'glob';
import chalk from 'chalk';

const program = new Command();
const generator = new DtsGenerator();

program
  .name('eghact-dts')
  .description('Generate TypeScript declaration files for Eghact components')
  .version('0.1.0');

program
  .command('generate')
  .alias('gen')
  .description('Generate .d.ts files for Eghact components')
  .option('-p, --pattern <pattern>', 'Glob pattern for .egh files', 'src/**/*.egh')
  .option('-o, --outdir <dir>', 'Output directory for .d.ts files (relative to component)', '.')
  .option('-w, --watch', 'Watch mode - regenerate on file changes')
  .option('--verbose', 'Enable verbose logging')
  .action(async (options) => {
    const { pattern, outdir, watch, verbose } = options;
    
    if (verbose) {
      console.log(chalk.blue('🔍 Starting .d.ts generation...'));
      console.log(chalk.gray(`Pattern: ${pattern}`));
      console.log(chalk.gray(`Output dir: ${outdir}`));
    }
    
    try {
      // Find all .egh files
      const files = await glob(pattern);
      
      if (files.length === 0) {
        console.log(chalk.yellow('⚠️  No .egh files found matching pattern:', pattern));
        return;
      }
      
      console.log(chalk.green(`✨ Found ${files.length} component(s)`));
      
      // Generate .d.ts for each file
      let successCount = 0;
      let errorCount = 0;
      
      for (const file of files) {
        try {
          await generator.generateForFile(file);
          successCount++;
          if (verbose) {
            console.log(chalk.green(`✓ ${file}`));
          }
        } catch (error) {
          errorCount++;
          console.error(chalk.red(`✗ ${file}: ${error instanceof Error ? error.message : String(error)}`));
        }
      }
      
      // Summary
      console.log(chalk.blue('\n📊 Summary:'));
      console.log(chalk.green(`✓ ${successCount} succeeded`));
      if (errorCount > 0) {
        console.log(chalk.red(`✗ ${errorCount} failed`));
      }
      
      // Watch mode
      if (watch) {
        console.log(chalk.blue('\n👁️  Watching for changes...'));
        
        const chokidar = await import('chokidar');
        const watcher = chokidar.watch(pattern, {
          ignored: /node_modules/,
          persistent: true
        });
        
        watcher.on('change', async (filePath) => {
          console.log(chalk.yellow(`\n♻️  ${filePath} changed, regenerating...`));
          try {
            await generator.generateForFile(filePath);
            console.log(chalk.green(`✓ Regenerated ${filePath}`));
          } catch (error) {
            console.error(chalk.red(`✗ Failed to regenerate ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
          }
        });
        
        watcher.on('add', async (filePath) => {
          if (filePath.endsWith('.egh')) {
            console.log(chalk.yellow(`\n➕ New component ${filePath}, generating...`));
            try {
              await generator.generateForFile(filePath);
              console.log(chalk.green(`✓ Generated ${filePath}`));
            } catch (error) {
              console.error(chalk.red(`✗ Failed to generate ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
            }
          }
        });
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check if .d.ts files are up to date')
  .option('-p, --pattern <pattern>', 'Glob pattern for .egh files', 'src/**/*.egh')
  .action(async (options) => {
    const { pattern } = options;
    
    console.log(chalk.blue('🔍 Checking .d.ts files...'));
    
    try {
      const files = await glob(pattern);
      let outdatedCount = 0;
      let missingCount = 0;
      
      for (const file of files) {
        const dtsPath = file.replace('.egh', '.d.ts');
        
        if (!fs.existsSync(dtsPath)) {
          missingCount++;
          console.log(chalk.yellow(`⚠️  Missing: ${dtsPath}`));
        } else {
          const eghStats = fs.statSync(file);
          const dtsStats = fs.statSync(dtsPath);
          
          if (eghStats.mtime > dtsStats.mtime) {
            outdatedCount++;
            console.log(chalk.yellow(`⏰ Outdated: ${dtsPath}`));
          }
        }
      }
      
      if (missingCount === 0 && outdatedCount === 0) {
        console.log(chalk.green('✨ All .d.ts files are up to date!'));
      } else {
        console.log(chalk.blue('\n📊 Summary:'));
        if (missingCount > 0) {
          console.log(chalk.yellow(`⚠️  ${missingCount} missing`));
        }
        if (outdatedCount > 0) {
          console.log(chalk.yellow(`⏰ ${outdatedCount} outdated`));
        }
        console.log(chalk.gray('\nRun "eghact-dts generate" to update'));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Remove all generated .d.ts files')
  .option('-p, --pattern <pattern>', 'Glob pattern for .d.ts files', 'src/**/*.egh.d.ts')
  .option('--dry-run', 'Show what would be deleted without deleting')
  .action(async (options) => {
    const { pattern, dryRun } = options;
    
    console.log(chalk.blue('🧹 Cleaning .d.ts files...'));
    
    try {
      const files = await glob(pattern);
      
      if (files.length === 0) {
        console.log(chalk.yellow('⚠️  No .d.ts files found to clean'));
        return;
      }
      
      if (dryRun) {
        console.log(chalk.yellow('🔍 Dry run - would delete:'));
        files.forEach(file => console.log(chalk.gray(`  - ${file}`)));
      } else {
        files.forEach(file => {
          fs.unlinkSync(file);
          console.log(chalk.red(`✗ Deleted ${file}`));
        });
        console.log(chalk.green(`\n✨ Cleaned ${files.length} file(s)`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Build integration hook
program
  .command('hook')
  .description('Hook for build system integration')
  .option('--pre-build', 'Run as pre-build hook')
  .option('--post-build', 'Run as post-build hook')
  .option('--ci', 'CI mode - fail on missing or outdated files')
  .action(async (options) => {
    const { preBuild, postBuild, ci } = options;
    
    if (preBuild) {
      console.log(chalk.blue('🔨 Pre-build hook: generating .d.ts files...'));
      
      // In CI mode, check first
      if (ci) {
        await program.parseAsync(['node', 'cli.ts', 'check'], { from: 'user' });
      }
      
      // Generate all .d.ts files
      await program.parseAsync(['node', 'cli.ts', 'generate'], { from: 'user' });
    }
    
    if (postBuild) {
      console.log(chalk.blue('🎯 Post-build hook: verifying .d.ts files...'));
      
      // Verify all .d.ts files are present and up to date
      await program.parseAsync(['node', 'cli.ts', 'check'], { from: 'user' });
    }
  });

program.parse(process.argv);