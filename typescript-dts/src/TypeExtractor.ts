import { ComponentInfo, PropInfo, EventInfo, SlotInfo } from './ComponentAnalyzer';

export interface ExtractedTypes {
  props: TypedProp[];
  events: TypedEvent[];
  slots: TypedSlot[];
  additionalTypes: AdditionalType[];
}

export interface TypedProp extends PropInfo {
  type: string; // Ensured to have a type
}

export interface TypedEvent extends EventInfo {
  detail: string; // Ensured to have detail type
}

export interface TypedSlot extends SlotInfo {
  props: string; // Ensured to have props type
}

export interface AdditionalType {
  name: string;
  definition: string;
}

export class TypeExtractor {
  extract(componentInfo: ComponentInfo): ExtractedTypes {
    return {
      props: this.extractProps(componentInfo),
      events: this.extractEvents(componentInfo),
      slots: this.extractSlots(componentInfo),
      additionalTypes: this.extractAdditionalTypes(componentInfo)
    };
  }

  private extractProps(info: ComponentInfo): TypedProp[] {
    return info.props.map(prop => ({
      ...prop,
      type: this.normalizeType(prop.type || this.inferTypeFromDefault(prop.defaultValue))
    }));
  }

  private extractEvents(info: ComponentInfo): TypedEvent[] {
    return info.events.map(event => ({
      ...event,
      detail: event.detail || 'any'
    }));
  }

  private extractSlots(info: ComponentInfo): TypedSlot[] {
    return info.slots.map(slot => ({
      ...slot,
      props: slot.props || 'Record<string, any>'
    }));
  }

  private extractAdditionalTypes(info: ComponentInfo): AdditionalType[] {
    const types: AdditionalType[] = [];
    
    // Extract custom types from imports
    info.imports.forEach(imp => {
      // Look for type imports
      const typeMatch = imp.clause.match(/type\s*\{([^}]+)\}/);
      if (typeMatch) {
        const typeNames = typeMatch[1].split(',').map(t => t.trim());
        typeNames.forEach(typeName => {
          if (!this.isBuiltinType(typeName)) {
            types.push({
              name: typeName,
              definition: `import { ${typeName} } from '${imp.module}';`
            });
          }
        });
      }
    });
    
    // Extract inline interfaces or types from state
    const complexTypes = new Set<string>();
    
    [...info.props, ...info.state].forEach(item => {
      const type = item.type;
      if (type && this.isComplexType(type)) {
        const extracted = this.extractComplexType(type);
        if (extracted) {
          complexTypes.add(extracted);
        }
      }
    });
    
    complexTypes.forEach(type => {
      types.push({
        name: `${info.name}${type}`,
        definition: `interface ${info.name}${type} ${type}`
      });
    });
    
    return types;
  }

  private normalizeType(type: string): string {
    // Map common Eghact/Svelte types to TypeScript
    const typeMap: Record<string, string> = {
      'String': 'string',
      'Number': 'number',
      'Boolean': 'boolean',
      'Array': 'any[]',
      'Object': 'object',
      'Function': '(...args: any[]) => any',
      'Date': 'Date',
      'RegExp': 'RegExp',
      'Promise': 'Promise<any>',
      'void': 'void',
      'undefined': 'undefined',
      'null': 'null'
    };
    
    // Check if it's a mapped type
    if (typeMap[type]) {
      return typeMap[type];
    }
    
    // Handle array types
    if (type.endsWith('[]')) {
      const baseType = type.slice(0, -2);
      return `${this.normalizeType(baseType)}[]`;
    }
    
    // Handle generic types
    if (type.includes('<')) {
      const genericMatch = type.match(/^(\w+)<(.+)>$/);
      if (genericMatch) {
        const base = genericMatch[1];
        const params = genericMatch[2].split(',').map(p => this.normalizeType(p.trim()));
        return `${base}<${params.join(', ')}>`;
      }
    }
    
    // Handle union types
    if (type.includes('|')) {
      return type.split('|').map(t => this.normalizeType(t.trim())).join(' | ');
    }
    
    // Handle intersection types
    if (type.includes('&')) {
      return type.split('&').map(t => this.normalizeType(t.trim())).join(' & ');
    }
    
    // Return as-is for custom types
    return type;
  }

  private inferTypeFromDefault(defaultValue?: string): string {
    if (!defaultValue) return 'any';
    
    // Remove whitespace
    const value = defaultValue.trim();
    
    // Boolean
    if (value === 'true' || value === 'false') {
      return 'boolean';
    }
    
    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return 'number';
    }
    
    // String
    if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) {
      return 'string';
    }
    
    // Array
    if (value.startsWith('[')) {
      // Try to infer array element type
      if (value === '[]') return 'any[]';
      
      // Simple heuristics for common cases
      if (value.includes('"') || value.includes("'")) return 'string[]';
      if (/\d/.test(value) && !value.includes('"') && !value.includes("'")) return 'number[]';
      
      return 'any[]';
    }
    
    // Object
    if (value.startsWith('{')) {
      return 'object';
    }
    
    // Function
    if (value.includes('=>') || value.startsWith('function')) {
      return '(...args: any[]) => any';
    }
    
    // null/undefined
    if (value === 'null') return 'null';
    if (value === 'undefined') return 'undefined';
    
    // Default
    return 'any';
  }

  private isBuiltinType(type: string): boolean {
    const builtins = [
      'string', 'number', 'boolean', 'any', 'void', 'never', 'unknown',
      'object', 'symbol', 'bigint', 'undefined', 'null',
      'Array', 'Object', 'Function', 'String', 'Number', 'Boolean',
      'Date', 'RegExp', 'Error', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet'
    ];
    
    return builtins.includes(type);
  }

  private isComplexType(type: string): boolean {
    // Check if it's an inline object type
    return type.startsWith('{') && type.endsWith('}');
  }

  private extractComplexType(type: string): string | null {
    // Extract inline object types
    if (type.startsWith('{') && type.endsWith('}')) {
      // Generate a name based on properties
      const props = type.slice(1, -1).split(',').map(p => p.trim().split(':')[0].trim());
      const typeName = props.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
      return typeName || 'CustomType';
    }
    
    return null;
  }
}