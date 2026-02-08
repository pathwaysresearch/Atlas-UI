"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";
import type { CalloutGenerationParams, CalloutGenerationResult } from "@/types/content";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
    console.error("GOOGLE_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

const SYSTEM_PROMPT = `You are an expert instructional designer specializing in creating engaging, professionally structured text-based learning modules for enterprise learners.`;

export async function generateCallouts(
    params: CalloutGenerationParams
): Promise<CalloutGenerationResult> {
    console.log('\n🟡 [CALLOUT API] Starting callout generation');
    console.log('🟡 [CALLOUT API] Learner level:', params.learnerLevel);
    console.log('🟡 [CALLOUT API] Number of contexts:', params.calloutContexts.length);

    try {
        const libsDir = path.join(process.cwd(), "libs");

        console.log('🟡 [CALLOUT API] Reading prompt files...');
        const [calloutPrompt, chapterContent, levelClassifications, toneEngagement] = await Promise.all([
            fs.readFile(path.join(libsDir, "Prompt-files", "callout_prompt.md"), "utf-8"),
            fs.readFile(path.join(libsDir, "samples", "05_Chapter_3___Platforms_and_Ecosystems.md"), "utf-8"),
            fs.readFile(path.join(libsDir, "Prompt-files", "level_classifications.md"), "utf-8"),
            fs.readFile(path.join(libsDir, "Prompt-files", "tone_engagment.md"), "utf-8")
        ]);
        console.log('✅ [CALLOUT API] Files loaded successfully');

        // Construct combined prompt content
        let combinedPromptContent = "";
        params.calloutContexts.forEach((context, i) => {
            combinedPromptContent += `\n\n--- CONTEXT_BLOCK_${i + 1} ---\n${context}\n------------------------\n`;
        });

        const instruction = `
You will be provided with ${params.calloutContexts.length} marked context blocks (CONTEXT_BLOCK_X).
For EACH context block, generate ONE relevant callout based on the text provided in that block.

Use the Callout Templates provided below.

**OUTPUT FORMAT:**
For each context, output the callout wrapped in:
<BLOCK_X>
<CALLOUT type="..."> ... </CALLOUT>
</BLOCK_X>

Ensure you generate exactly ${params.calloutContexts.length} callouts, one for each block in order.
`;

        const prompt = `
**IMPORTANT — Learner Profile:**
* Learner Level Classification: **${params.learnerLevel}**
* Context: Business Analyst at Nagarro, Technology Industry.

**Task:**
${instruction}

**Contexts to Process:**
${combinedPromptContent}

**Callout Templates:**
${calloutPrompt}
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
                temperature: 0.3,
            },
            systemInstruction: SYSTEM_PROMPT
        });

        const generatedText = result.response.text();
        console.log('✅ [CALLOUT API] Gemini response received, length:', generatedText.length);
        console.log('🟡 [CALLOUT API] Raw response preview:', generatedText.substring(0, 800));
        console.log('🟡 [CALLOUT API] Parsing callouts...');

        // Parse response to extract callouts
        const extractedCallouts: string[] = [];

        for (let i = 0; i < params.calloutContexts.length; i++) {
            const blockNum = i + 1;
            // Fixed regex - use single backslash in template string
            const pattern = new RegExp(`<BLOCK_${blockNum}>\\s*(.*?)\\s*</BLOCK_${blockNum}>`, "s");
            const match = generatedText.match(pattern);

            console.log(`🟡 [CALLOUT API] Trying to match block ${blockNum}...`);

            if (match) {
                console.log(`✅ [CALLOUT API] Found match for block ${blockNum}, length:`, match[1].length);
                const calloutContent = match[1];
                const calloutMatch = calloutContent.match(/(<CALLOUT.*?>.*?<\/CALLOUT>)/s);

                if (calloutMatch) {
                    console.log(`✅ [CALLOUT API] Extracted CALLOUT tag for block ${blockNum}`);
                    extractedCallouts.push(calloutMatch[1]);
                } else {
                    console.log(`⚠️ [CALLOUT API] No CALLOUT tag found in block ${blockNum}, using raw content`);
                    extractedCallouts.push(calloutContent);
                }
            } else {
                console.log(`⚠️ [CALLOUT API] No match found for block ${blockNum}`);
                extractedCallouts.push(""); // Fallback
            }
        }

        console.log('✅ [CALLOUT API] Extracted', extractedCallouts.length, 'callouts');
        console.log('✅ [CALLOUT API] Callout generation complete\n');

        return {
            success: true,
            callouts: extractedCallouts
        };

    } catch (error) {
        console.error('❌ [CALLOUT API] Error generating callouts:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}
