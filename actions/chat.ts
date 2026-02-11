"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
    console.error("GOOGLE_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");

export async function generateChatResponse(
    history: { role: "user" | "model"; parts: string }[],
    userMessage: string,
    context: string
) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const systemPrompt = `You are an AI tutor named Atlas, embedded within a learning module. 
Your goal is to help the learner understand the content provided in the CONTEXT.
Answer the user's questions based PRIMARILY on the provided CONTEXT. 
If the answer is not in the context, say that you cannot answer the question as it is outside the scope of the current module.
Keep your answers concise, encouraging, and helpful. Use markdown for formatting.

CONTEXT:
${context}
`;

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: "Understood. I am Atlas, your AI tutor. I will answer questions based on the provided context." }] },
                ...history.map(msg => ({ role: msg.role, parts: [{ text: msg.parts }] }))
            ],
            generationConfig: {
                maxOutputTokens: 500,
            },
        });

        const result = await chat.sendMessage(userMessage);
        const response = result.response.text();

        return { success: true, response };
    } catch (error) {
        console.error("Chat Error:", error);
        return { success: false, error: "Failed to generate response." };
    }
}
