export interface DtsGeneratorOptions {
    outputDir?: string;
    watch?: boolean;
    verbose?: boolean;
}
export declare class DtsGenerator {
    private analyzer;
    private extractor;
    private options;
    constructor(options?: DtsGeneratorOptions);
    generateForFile(filePath: string): Promise<void>;
    private generateDts;
    private getOutputPath;
    private ensureDirectoryExists;
    generateForDirectory(dir: string, pattern?: string): Promise<void>;
    watch(dir: string, pattern?: string): Promise<void>;
    private handleFileChange;
    private handleFileRemove;
}
//# sourceMappingURL=DtsGenerator.d.ts.map