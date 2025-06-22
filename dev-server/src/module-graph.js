/**
 * Module dependency graph for tracking file relationships
 */

export class ModuleGraph {
  constructor() {
    this.modules = new Map();
    this.dependencies = new Map();
    this.invalidatedModules = new Set();
  }
  
  addModule(id, module) {
    this.modules.set(id, {
      id,
      timestamp: Date.now(),
      ...module
    });
  }
  
  updateModule(id, updates) {
    const existing = this.modules.get(id) || {};
    this.modules.set(id, {
      ...existing,
      ...updates,
      timestamp: Date.now()
    });
  }
  
  getModule(id) {
    return this.modules.get(id);
  }
  
  getModulesByFile(filePath) {
    const modules = [];
    for (const [id, module] of this.modules) {
      if (module.filePath === filePath) {
        modules.push(module);
      }
    }
    return modules;
  }
  
  invalidate(filePath) {
    const modules = this.getModulesByFile(filePath);
    for (const module of modules) {
      this.invalidatedModules.add(module.id);
      this.invalidateDependents(module.id);
    }
  }
  
  invalidateModule(id) {
    this.invalidatedModules.add(id);
    this.invalidateDependents(id);
  }
  
  invalidateDependents(id) {
    for (const [moduleId, deps] of this.dependencies) {
      if (deps.includes(id)) {
        this.invalidatedModules.add(moduleId);
        this.invalidateDependents(moduleId);
      }
    }
  }
  
  setDependencies(id, deps) {
    this.dependencies.set(id, deps);
  }
  
  getDependencies(id) {
    return this.dependencies.get(id) || [];
  }
  
  isInvalidated(id) {
    return this.invalidatedModules.has(id);
  }
  
  markValid(id) {
    this.invalidatedModules.delete(id);
  }
  
  clear() {
    this.modules.clear();
    this.dependencies.clear();
    this.invalidatedModules.clear();
  }
}