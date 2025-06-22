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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DtsGenerator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ComponentAnalyzer_1 = require("./ComponentAnalyzer");
const TypeExtractor_1 = require("./TypeExtractor");
class DtsGenerator {
    constructor(options = {}) {
        this.options = {
            outputDir: 'types',
            watch: false,
            verbose: false,
            ...options
        };
        this.analyzer = new ComponentAnalyzer_1.ComponentAnalyzer();
        this.extractor = new TypeExtractor_1.TypeExtractor();
    }
    async generateForFile(filePath) {
        if (this.options.verbose) {
            console.log(`Generating .d.ts for: ${filePath}`);
        }
        try {
            // Read .egh file
            const content = fs.readFileSync(filePath, 'utf-8');
            // Analyze component
            const componentInfo = await this.analyzer.analyze(content, filePath);
            // Extract types
            const typeInfo = this.extractor.extract(componentInfo);
            // Generate .d.ts content
            const dtsContent = this.generateDts(componentInfo, typeInfo);
            // Write .d.ts file
            const outputPath = this.getOutputPath(filePath);
            this.ensureDirectoryExists(path.dirname(outputPath));
            fs.writeFileSync(outputPath, dtsContent);
            if (this.options.verbose) {
                console.log(`✓ Generated: ${outputPath}`);
            }
        }
        catch (error) {
            console.error(`Error generating .d.ts for ${filePath}:`, error);
            throw error;
        }
    }
    generateDts(componentInfo, typeInfo) {
        const lines = [];
        // Import statements
        lines.push(`import { ComponentType, ComponentProps } from '@eghact/runtime';`);
        if (componentInfo.imports.length > 0) {
            lines.push('');
            componentInfo.imports.forEach((imp) => {
                lines.push(`import ${imp.clause} from '${imp.module}';`);
            });
        }
        lines.push('');
        // Props interface
        if (typeInfo.props.length > 0) {
            lines.push('export interface Props {');
            typeInfo.props.forEach((prop) => {
                const optional = prop.required ? '' : '?';
                const comment = prop.description ? `  /** ${prop.description} */\n` : '';
                lines.push(`${comment}  ${prop.name}${optional}: ${prop.type};`);
            });
            lines.push('}');
            lines.push('');
        }
        else {
            lines.push('export interface Props {}');
            lines.push('');
        }
        // Events interface
        if (typeInfo.events.length > 0) {
            lines.push('export interface Events {');
            typeInfo.events.forEach((event) => {
                const detailType = event.detail || 'any';
                lines.push(`  ${event.name}: CustomEvent<${detailType}>;`);
            });
            lines.push('}');
            lines.push('');
        }
        // Slots interface
        if (typeInfo.slots.length > 0) {
            lines.push('export interface Slots {');
            typeInfo.slots.forEach((slot) => {
                const propsType = slot.props ? slot.props : 'Record<string, any>';
                lines.push(`  ${slot.name}: ${propsType};`);
            });
            lines.push('}');
            lines.push('');
        }
        // Component declaration
        const componentName = componentInfo.name || 'Component';
        lines.push(`declare const ${componentName}: ComponentType<Props>;`);
        lines.push('');
        // Default export
        lines.push(`export default ${componentName};`);
        // Named exports for types
        if (typeInfo.additionalTypes.length > 0) {
            lines.push('');
            lines.push('// Additional exported types');
            typeInfo.additionalTypes.forEach((type) => {
                lines.push(`export type { ${type.name} };`);
            });
        }
        return lines.join('\n');
    }
    getOutputPath(inputPath) {
        // Generate .d.ts in the same directory as the .egh file
        return inputPath.replace(/\.egh$/, '.d.ts');
    }
    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    async generateForDirectory(dir, pattern = '**/*.egh') {
        const glob = await Promise.resolve().then(() => __importStar(require('glob')));
        const files = await glob.glob(pattern, {
            cwd: dir,
            absolute: true,
            ignore: ['**/node_modules/**']
        });
        console.log(`Found ${files.length} .egh files`);
        for (const file of files) {
            await this.generateForFile(file);
        }
    }
    async watch(dir, pattern = '**/*.egh') {
        const chokidar = await Promise.resolve().then(() => __importStar(require('chokidar')));
        console.log(`Watching for .egh file changes in ${dir}...`);
        const watcher = chokidar.watch(pattern, {
            cwd: dir,
            ignored: /node_modules/,
            persistent: true
        });
        watcher
            .on('add', (path) => this.handleFileChange(path, dir))
            .on('change', (path) => this.handleFileChange(path, dir))
            .on('unlink', (path) => this.handleFileRemove(path, dir));
    }
    async handleFileChange(relativePath, baseDir) {
        const absolutePath = path.join(baseDir, relativePath);
        console.log(`File changed: ${relativePath}`);
        try {
            await this.generateForFile(absolutePath);
        }
        catch (error) {
            console.error(`Error processing ${relativePath}:`, error);
        }
    }
    handleFileRemove(relativePath, baseDir) {
        const outputPath = this.getOutputPath(path.join(baseDir, relativePath));
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
            console.log(`Removed: ${outputPath}`);
        }
    }
}
exports.DtsGenerator = DtsGenerator;
//# sourceMappingURL=DtsGenerator.js.map