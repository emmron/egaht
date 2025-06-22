import * as fs from 'fs';
import * as path from 'path';
import { ComponentAnalyzer } from './ComponentAnalyzer';
import { TypeExtractor } from './TypeExtractor';

export interface DtsGeneratorOptions {
  outputDir?: string;
  watch?: boolean;
  verbose?: boolean;
}

export class DtsGenerator {
  private analyzer: ComponentAnalyzer;
  private extractor: TypeExtractor;
  private options: DtsGeneratorOptions;

  constructor(options: DtsGeneratorOptions = {}) {
    this.options = {
      outputDir: 'types',
      watch: false,
      verbose: false,
      ...options
    };
    
    this.analyzer = new ComponentAnalyzer();
    this.extractor = new TypeExtractor();
  }

  async generateForFile(filePath: string): Promise<void> {
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
    } catch (error) {
      console.error(`Error generating .d.ts for ${filePath}:`, error);
      throw error;
    }
  }

  private generateDts(componentInfo: any, typeInfo: any): string {
    const lines: string[] = [];
    
    // Import statements
    lines.push(`import { ComponentType, ComponentProps } from '@eghact/runtime';`);
    
    if (componentInfo.imports.length > 0) {
      lines.push('');
      componentInfo.imports.forEach((imp: any) => {
        lines.push(`import ${imp.clause} from '${imp.module}';`);
      });
    }
    
    lines.push('');
    
    // Props interface
    if (typeInfo.props.length > 0) {
      lines.push('export interface Props {');
      typeInfo.props.forEach((prop: any) => {
        const optional = prop.required ? '' : '?';
        const comment = prop.description ? `  /** ${prop.description} */\n` : '';
        lines.push(`${comment}  ${prop.name}${optional}: ${prop.type};`);
      });
      lines.push('}');
      lines.push('');
    } else {
      lines.push('export interface Props {}');
      lines.push('');
    }
    
    // Events interface
    if (typeInfo.events.length > 0) {
      lines.push('export interface Events {');
      typeInfo.events.forEach((event: any) => {
        const detailType = event.detail || 'any';
        lines.push(`  ${event.name}: CustomEvent<${detailType}>;`);
      });
      lines.push('}');
      lines.push('');
    }
    
    // Slots interface
    if (typeInfo.slots.length > 0) {
      lines.push('export interface Slots {');
      typeInfo.slots.forEach((slot: any) => {
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
      typeInfo.additionalTypes.forEach((type: any) => {
        lines.push(`export type { ${type.name} };`);
      });
    }
    
    return lines.join('\n');
  }

  private getOutputPath(inputPath: string): string {
    // Generate .d.ts in the same directory as the .egh file
    return inputPath.replace(/\.egh$/, '.d.ts');
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async generateForDirectory(dir: string, pattern: string = '**/*.egh'): Promise<void> {
    const glob = await import('glob');
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

  async watch(dir: string, pattern: string = '**/*.egh'): Promise<void> {
    const chokidar = await import('chokidar');
    
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

  private async handleFileChange(relativePath: string, baseDir: string): Promise<void> {
    const absolutePath = path.join(baseDir, relativePath);
    console.log(`File changed: ${relativePath}`);
    
    try {
      await this.generateForFile(absolutePath);
    } catch (error) {
      console.error(`Error processing ${relativePath}:`, error);
    }
  }

  private handleFileRemove(relativePath: string, baseDir: string): void {
    const outputPath = this.getOutputPath(path.join(baseDir, relativePath));
    
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log(`Removed: ${outputPath}`);
    }
  }
}