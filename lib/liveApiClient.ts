import {
    GoogleGenAI,
    Modality,
    Behavior,
    StartSensitivity,
    EndSensitivity,
    Type
} from "@google/genai";

export const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
export const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";

export const updateBlackboardTool = {
    name: "update_blackboard",
    description: "Updates the visual blackboard. IMPORTANT: When in middle of a lesson, only send NEW content that hasn't been shown yet. when starting a new lesson, send single point/title content at a time for the new lesson.",
    behavior: Behavior.NON_BLOCKING,
    parameters: {
        type: Type.OBJECT,
        properties: {
            markdown: { type: Type.STRING, description: "The text content (NEW content only when appending)" },
            mode: { type: Type.STRING, enum: ["append", "replace"], description: "Use 'replace' to clear and start fresh, 'append' to add new content" }
        },
        required: ["markdown", "mode"]
    }
};

export const liveConfig = {
    model: MODEL,
    config: {
        responseModalities: [Modality.AUDIO],
        tools: [{ functionDeclarations: [updateBlackboardTool] }],
        inputAudioTranscription: {},
        thinkingConfig: {
            thinkingBudget: 256,
        },
        realtimeInputConfig: {
            automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
                endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
                prefixPaddingMs: 50,
                silenceDurationMs: 200,
            }
        }
    }
};

export const createLiveClient = () => {
    if (!API_KEY) {
        throw new Error("NEXT_PUBLIC_GOOGLE_API_KEY is not defined");
    }
    return new GoogleGenAI({ apiKey: API_KEY });
};
