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
export declare class ComponentAnalyzer {
    analyze(content: string, filePath: string): Promise<ComponentInfo>;
    private parseSections;
    private analyzeScript;
    private analyzeTemplate;
    private extractComponentName;
}
//# sourceMappingURL=ComponentAnalyzer.d.ts.map