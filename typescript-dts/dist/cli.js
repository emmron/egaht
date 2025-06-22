#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const DtsGenerator_1 = require("./DtsGenerator");
const fs_1 = __importDefault(require("fs"));
const glob_1 = require("glob");
const chalk_1 = __importDefault(require("chalk"));
const program = new commander_1.Command();
const generator = new DtsGenerator_1.DtsGenerator();
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
        console.log(chalk_1.default.blue('🔍 Starting .d.ts generation...'));
        console.log(chalk_1.default.gray(`Pattern: ${pattern}`));
        console.log(chalk_1.default.gray(`Output dir: ${outdir}`));
    }
    try {
        // Find all .egh files
        const files = await (0, glob_1.glob)(pattern);
        if (files.length === 0) {
            console.log(chalk_1.default.yellow('⚠️  No .egh files found matching pattern:', pattern));
            return;
        }
        console.log(chalk_1.default.green(`✨ Found ${files.length} component(s)`));
        // Generate .d.ts for each file
        let successCount = 0;
        let errorCount = 0;
        for (const file of files) {
            try {
                await generator.generateForFile(file);
                successCount++;
                if (verbose) {
                    console.log(chalk_1.default.green(`✓ ${file}`));
                }
            }
            catch (error) {
                errorCount++;
                console.error(chalk_1.default.red(`✗ ${file}: ${error instanceof Error ? error.message : String(error)}`));
            }
        }
        // Summary
        console.log(chalk_1.default.blue('\n📊 Summary:'));
        console.log(chalk_1.default.green(`✓ ${successCount} succeeded`));
        if (errorCount > 0) {
            console.log(chalk_1.default.red(`✗ ${errorCount} failed`));
        }
        // Watch mode
        if (watch) {
            console.log(chalk_1.default.blue('\n👁️  Watching for changes...'));
            const chokidar = await Promise.resolve().then(() => __importStar(require('chokidar')));
            const watcher = chokidar.watch(pattern, {
                ignored: /node_modules/,
                persistent: true
            });
            watcher.on('change', async (filePath) => {
                console.log(chalk_1.default.yellow(`\n♻️  ${filePath} changed, regenerating...`));
                try {
                    await generator.generateForFile(filePath);
                    console.log(chalk_1.default.green(`✓ Regenerated ${filePath}`));
                }
                catch (error) {
                    console.error(chalk_1.default.red(`✗ Failed to regenerate ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
                }
            });
            watcher.on('add', async (filePath) => {
                if (filePath.endsWith('.egh')) {
                    console.log(chalk_1.default.yellow(`\n➕ New component ${filePath}, generating...`));
                    try {
                        await generator.generateForFile(filePath);
                        console.log(chalk_1.default.green(`✓ Generated ${filePath}`));
                    }
                    catch (error) {
                        console.error(chalk_1.default.red(`✗ Failed to generate ${filePath}: ${error instanceof Error ? error.message : String(error)}`));
                    }
                }
            });
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
program
    .command('check')
    .description('Check if .d.ts files are up to date')
    .option('-p, --pattern <pattern>', 'Glob pattern for .egh files', 'src/**/*.egh')
    .action(async (options) => {
    const { pattern } = options;
    console.log(chalk_1.default.blue('🔍 Checking .d.ts files...'));
    try {
        const files = await (0, glob_1.glob)(pattern);
        let outdatedCount = 0;
        let missingCount = 0;
        for (const file of files) {
            const dtsPath = file.replace('.egh', '.d.ts');
            if (!fs_1.default.existsSync(dtsPath)) {
                missingCount++;
                console.log(chalk_1.default.yellow(`⚠️  Missing: ${dtsPath}`));
            }
            else {
                const eghStats = fs_1.default.statSync(file);
                const dtsStats = fs_1.default.statSync(dtsPath);
                if (eghStats.mtime > dtsStats.mtime) {
                    outdatedCount++;
                    console.log(chalk_1.default.yellow(`⏰ Outdated: ${dtsPath}`));
                }
            }
        }
        if (missingCount === 0 && outdatedCount === 0) {
            console.log(chalk_1.default.green('✨ All .d.ts files are up to date!'));
        }
        else {
            console.log(chalk_1.default.blue('\n📊 Summary:'));
            if (missingCount > 0) {
                console.log(chalk_1.default.yellow(`⚠️  ${missingCount} missing`));
            }
            if (outdatedCount > 0) {
                console.log(chalk_1.default.yellow(`⏰ ${outdatedCount} outdated`));
            }
            console.log(chalk_1.default.gray('\nRun "eghact-dts generate" to update'));
            process.exit(1);
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error instanceof Error ? error.message : String(error));
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
    console.log(chalk_1.default.blue('🧹 Cleaning .d.ts files...'));
    try {
        const files = await (0, glob_1.glob)(pattern);
        if (files.length === 0) {
            console.log(chalk_1.default.yellow('⚠️  No .d.ts files found to clean'));
            return;
        }
        if (dryRun) {
            console.log(chalk_1.default.yellow('🔍 Dry run - would delete:'));
            files.forEach(file => console.log(chalk_1.default.gray(`  - ${file}`)));
        }
        else {
            files.forEach(file => {
                fs_1.default.unlinkSync(file);
                console.log(chalk_1.default.red(`✗ Deleted ${file}`));
            });
            console.log(chalk_1.default.green(`\n✨ Cleaned ${files.length} file(s)`));
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('❌ Error:'), error instanceof Error ? error.message : String(error));
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
        console.log(chalk_1.default.blue('🔨 Pre-build hook: generating .d.ts files...'));
        // In CI mode, check first
        if (ci) {
            await program.parseAsync(['node', 'cli.ts', 'check'], { from: 'user' });
        }
        // Generate all .d.ts files
        await program.parseAsync(['node', 'cli.ts', 'generate'], { from: 'user' });
    }
    if (postBuild) {
        console.log(chalk_1.default.blue('🎯 Post-build hook: verifying .d.ts files...'));
        // Verify all .d.ts files are present and up to date
        await program.parseAsync(['node', 'cli.ts', 'check'], { from: 'user' });
    }
});
program.parse(process.argv);
//# sourceMappingURL=cli.js.map