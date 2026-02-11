"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import type { ContentGenerationParams, ContentGenerationResult } from "@/types/content";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
    console.error("GOOGLE_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const SYSTEM_PROMPT = `You are an expert instructional designer specializing in creating engaging, professionally structured text-based learning modules for enterprise learners.`;

const WRITE_DOWN_PROMPT = `If you like, write down a few key phrases or ideas in your own words. Or, if you prefer, make a sticky note for yourself.\n\n`;

const RECAP_PROMPT = `## **Recap and Reflect**\n\nTake a look at what you wrote down. Now summarize the key ideas in your own words. You can either write them down or speak it out.`;

export async function generateModuleContent(
    params: ContentGenerationParams
): Promise<ContentGenerationResult> {
    try {
        const libsDir = path.join(process.cwd(), "libs");

        // Determine which prompt file to use
        let promptFilePath: string;
        let promptAddition: string;

        if (params.selectionType === "Module Opening") {
            promptFilePath = path.join(libsDir, "Prompt-files", "module_opening.md");
            if (params.specificModuleName) {
                promptAddition = `\nGenerate the Module Opening for **${params.specificModuleName}** based on the Chapter in the provided format.`;
            } else {
                promptAddition = `\nGenerate the Module Opening for the given modules based on the Chapter in the provided format.`;
            }
        } else {
            promptFilePath = path.join(libsDir, "Prompt-files", "sub_module_1.md");
            promptAddition = `\nGenerate the content Sub-Module ${params.subModuleName} based on the Chapter in the provided format.`;
        }

        // Read all required files
        const [promptFormat, chapterContent, levelClassifications, toneEngagement] = await Promise.all([
            fs.readFile(promptFilePath, "utf-8"),
            fs.readFile(path.join(libsDir, "samples", "05_Chapter_3___Platforms_and_Ecosystems.md"), "utf-8"),
            fs.readFile(path.join(libsDir, "Prompt-files", "level_classifications.md"), "utf-8"),
            fs.readFile(path.join(libsDir, "Prompt-files", "tone_engagment.md"), "utf-8")
        ]);

        // Construct the main prompt
        const prompt = `
    
Given here is the module and sub-module names for the chapter:
${params.moduleStructure}

**IMPORTANT — Learner Profile (Context):**

* Job Role: Business Analyst
* Company: Nagarro
* Industry: Technology
* Domain/Specialization: [var]
* Learner Level Classification: **${params.learnerLevel}** *(Novice / Competent / Expert)*


${promptFormat}${promptAddition}

`;

        // Call Gemini API
        const result = await model.generateContent({
            contents: [
                {
                    role: "user", parts: [
                        { text: chapterContent },
                        { text: levelClassifications },
                        { text: toneEngagement },
                        { text: prompt }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.4,
            },
            systemInstruction: SYSTEM_PROMPT
        });

        const responseText = result.response.text();

        // Post-process: Replace <Break> tags
        const processedContent = responseText
            .replace(/<Break>/, RECAP_PROMPT)
            .replace(/<Break>/g, WRITE_DOWN_PROMPT + RECAP_PROMPT);

        return {
            success: true,
            content: processedContent
        };

    } catch (error) {
        console.error("Error generating module content:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
