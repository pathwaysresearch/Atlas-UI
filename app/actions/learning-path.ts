"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import path from "path";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
    console.error("GOOGLE_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export interface Module {
    title: string;
    subModules: string[];
}

export interface LearningPathData {
    modules: Module[];
}

export async function generateLearningPath(learnerLevel: string = "Novice"): Promise<LearningPathData | null> {
    try {
        const libsDir = path.join(process.cwd(), "libs");

        // Read context files
        const [chapterContent, levelClassifications, toneEngagement] = await Promise.all([
            fs.readFile(path.join(libsDir, "samples", "05_Chapter_3___Platforms_and_Ecosystems.md"), "utf-8"),
            fs.readFile(path.join(libsDir, "Prompt-files", "level_classifications.md"), "utf-8"),
            fs.readFile(path.join(libsDir, "Prompt-files", "tone_engagment.md"), "utf-8")
        ]);

        const prompt = `
        You will be given a chapter in markdown.
        Your task is to generate **module headings and sub-module headings only**, tailored to the learner profile and expertise level.

        **Context:**
        
        **Level Classifications:**
        ${levelClassifications}
        
        **Tone & Engagement:**
        ${toneEngagement}
        
        **Chapter Content:**
        ${chapterContent}
        
        ---

        **IMPORTANT — Learner Profile (Context):**
            * Job Role: Business Analyst
            * Company: Nagarro
            * Industry: Technology
            * Domain/Specialization: [var]
            * Learner Level Classification: **{learner_level}** *(Novice / Competent / Expert)*

        Adapt the **number, depth, and phrasing** of modules and sub-modules to this learner level.

        
        **OUTPUT FORMAT (STRICT JSON)**:
        Returns a JSON object with a "modules" array. Each module has a "title" and "subModules" array of strings.
        
        Example:
        {
            "modules": [
                {
                    "title": "MODULE 1: Platform Business Models",
                    "subModules": ["1.1 Introduction to Platforms", "1.2 Network Effects"]
                }
            ]
        }
        
        Do not acknowledge or explain, just return valid JSON.
        `;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });

        const responseText = result.response.text();
        const data = JSON.parse(responseText) as LearningPathData;

        return data;

    } catch (error) {
        console.error("Error generating learning path:", error);
        return null;
    }
}
