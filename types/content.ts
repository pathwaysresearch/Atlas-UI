export type LearnerLevel = "Novice" | "Competent" | "Expert";
export type SelectionType = "Module Opening" | "Sub-Module";

export interface ContentGenerationParams {
    learnerLevel: LearnerLevel;
    selectionType: SelectionType;
    moduleStructure: string;
    subModuleName?: string;
    specificModuleName?: string;
}

export interface ContentGenerationResult {
    success: boolean;
    content?: string;
    error?: string;
}

export interface CalloutGenerationParams {
    learnerLevel: LearnerLevel;
    calloutContexts: string[];
    specificModuleName?: string;
}

export interface CalloutGenerationResult {
    success: boolean;
    callouts?: string[];
    error?: string;
}
