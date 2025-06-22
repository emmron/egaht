
export interface ComponentInfo {
  name: string;
  filePath: string;
  imports: ImportInfo[];
  props: PropInfo[];
  events: EventInfo[];
  slots: SlotInfo[];
  state: StateInfo[];
  lifecycle: string[];
  genericParams?: string[];
}

export interface ImportInfo {
  module: string;
  clause: string;
}

export interface PropInfo {
  name: string;
  type?: string;
  defaultValue?: string;
  required: boolean;
  description?: string;
}

export interface EventInfo {
  name: string;
  detail?: string;
}

export interface SlotInfo {
  name: string;
  props?: string;
}

export interface StateInfo {
  name: string;
  type: string;
  reactive: boolean;
}

export class ComponentAnalyzer {
  async analyze(content: string, filePath: string): Promise<ComponentInfo> {
    const info: ComponentInfo = {
      name: this.extractComponentName(filePath),
      filePath,
      imports: [],
      props: [],
      events: [],
      slots: [],
      state: [],
      lifecycle: []
    };

    // Parse different sections of .egh file
    const sections = this.parseSections(content);
    
    if (sections.script) {
      this.analyzeScript(sections.script, info);
    }
    
    if (sections.template) {
      this.analyzeTemplate(sections.template, info);
    }
    
    return info;
  }

  private parseSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    
    // Extract <script> section
    const scriptMatch = content.match(/<script(?:\s+lang="ts")?>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      sections.script = scriptMatch[1];
    }
    
    // Extract <template> section
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      sections.template = templateMatch[1];
    }
    
    // Extract <style> section (for completeness)
    const styleMatch = content.match(/<style(?:\s+scoped)?>([\s\S]*?)<\/style>/);
    if (styleMatch) {
      sections.style = styleMatch[1];
    }
    
    return sections;
  }

  private analyzeScript(script: string, info: ComponentInfo): void {
    // Parse imports
    const importRegex = /import\s+(.+?)\s+from\s+['"](.+?)['"]/g;
    let match: RegExpExecArray | null;
    
    while ((match = importRegex.exec(script)) !== null) {
      info.imports.push({
        clause: match[1],
        module: match[2]
      });
    }
    
    // Parse props (export let)
    const propRegex = /export\s+let\s+(\w+)(?:\s*:\s*([^=\n]+?))?(?:\s*=\s*(.+?))?(?:;|\n)/g;
    
    while ((match = propRegex.exec(script)) !== null) {
      const prop: PropInfo = {
        name: match[1],
        required: !match[3] // No default value means required
      };
      
      if (match[2]) {
        prop.type = match[2].trim();
      }
      
      if (match[3]) {
        prop.defaultValue = match[3].trim();
      }
      
      // Check for JSDoc comments
      const jsdocMatch = script.slice(0, match.index).match(/\/\*\*\s*\n([^*]|\*(?!\/))*\*\/\s*$/);
      if (jsdocMatch) {
        const jsdoc = jsdocMatch[0];
        const descMatch = jsdoc.match(/@description\s+(.+)/);
        if (descMatch) {
          prop.description = descMatch[1].trim();
        }
      }
      
      info.props.push(prop);
    }
    
    // Parse events (dispatch calls)
    const eventRegex = /dispatch(?:<(.+?)>)?\(['"](.+?)['"]/g;
    const foundEvents = new Set<string>();
    
    while ((match = eventRegex.exec(script)) !== null) {
      const eventName = match[2];
      if (!foundEvents.has(eventName)) {
        foundEvents.add(eventName);
        info.events.push({
          name: eventName,
          detail: match[1] || undefined
        });
      }
    }
    
    // Parse state variables
    const stateRegex = /(?:let|const)\s+(\w+)(?:\s*:\s*([^=\n]+?))?(?:\s*=\s*(.+?))?(?:;|\n)/g;
    
    while ((match = stateRegex.exec(script)) !== null) {
      // Skip imports and exports
      if (!script.slice(Math.max(0, match.index - 10), match.index).includes('export')) {
        info.state.push({
          name: match[1],
          type: match[2]?.trim() || 'any',
          reactive: false
        });
      }
    }
    
    // Parse reactive statements ($:)
    const reactiveRegex = /\$:\s*(\w+)\s*=/g;
    
    while ((match = reactiveRegex.exec(script)) !== null) {
      const existing = info.state.find(s => s.name === match![1]);
      if (existing) {
        existing.reactive = true;
      } else {
        info.state.push({
          name: match![1],
          type: 'any',
          reactive: true
        });
      }
    }
    
    // Parse lifecycle hooks
    const lifecycleHooks = ['onMount', 'onDestroy', 'beforeUpdate', 'afterUpdate'];
    lifecycleHooks.forEach(hook => {
      if (script.includes(`${hook}(`)) {
        info.lifecycle.push(hook);
      }
    });
  }

  private analyzeTemplate(template: string, info: ComponentInfo): void {
    // Parse slot usage
    const slotRegex = /<slot(?:\s+name=['"](\w+)['"])?(?:\s+(.+?))?\/>/g;
    let match: RegExpExecArray | null;
    
    while ((match = slotRegex.exec(template)) !== null) {
      const slot: SlotInfo = {
        name: match[1] || 'default'
      };
      
      // Parse slot props if any
      if (match[2]) {
        const propsMatch = match[2].match(/(\w+)=\{(.+?)\}/g);
        if (propsMatch) {
          slot.props = `{ ${propsMatch.map(p => {
            const [key, value] = p.split('=');
            return `${key}: ${value.slice(1, -1)}`;
          }).join(', ')} }`;
        }
      }
      
      info.slots.push(slot);
    }
    
    // Look for additional event dispatches in template
    const templateEventRegex = /@(\w+)(?:\.(\w+))?=/g;
    
    while ((match = templateEventRegex.exec(template)) !== null) {
      const eventName = match[1];
      // Common DOM events that aren't custom events
      const domEvents = ['click', 'change', 'input', 'submit', 'keydown', 'keyup', 'focus', 'blur'];
      
      if (!domEvents.includes(eventName)) {
        const existing = info.events.find(e => e.name === eventName);
        if (!existing) {
          info.events.push({ name: eventName });
        }
      }
    }
  }

  private extractComponentName(filePath: string): string {
    const fileName = filePath.split('/').pop() || '';
    const name = fileName.replace(/\.egh$/, '');
    
    // Convert to PascalCase
    return name
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
}