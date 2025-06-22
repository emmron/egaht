import { ComponentInfo, PropInfo, EventInfo, SlotInfo } from './ComponentAnalyzer';
export interface ExtractedTypes {
    props: TypedProp[];
    events: TypedEvent[];
    slots: TypedSlot[];
    additionalTypes: AdditionalType[];
}
export interface TypedProp extends PropInfo {
    type: string;
}
export interface TypedEvent extends EventInfo {
    detail: string;
}
export interface TypedSlot extends SlotInfo {
    props: string;
}
export interface AdditionalType {
    name: string;
    definition: string;
}
export declare class TypeExtractor {
    extract(componentInfo: ComponentInfo): ExtractedTypes;
    private extractProps;
    private extractEvents;
    private extractSlots;
    private extractAdditionalTypes;
    private normalizeType;
    private inferTypeFromDefault;
    private isBuiltinType;
    private isComplexType;
    private extractComplexType;
}
//# sourceMappingURL=TypeExtractor.d.ts.map