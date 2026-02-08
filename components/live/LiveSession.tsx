"use client";

import { useEffect, useRef, useState } from "react";
import { createLiveClient, liveConfig, updateBlackboardTool } from "@/lib/liveApiClient";
import { AudioHandler } from "@/lib/audioUtils";
import { FunctionResponseScheduling } from "@google/genai";

interface LiveSessionProps {
    content: string;
    learnerLevel: string;
    moduleName: string;
    onBlackboardUpdate: (markdown: string, mode: "append" | "replace") => void;
    onTranscriptUpdate: (text: string) => void;
    onStatusChange: (status: string) => void;
    onError: (error: string) => void;
    isActive: boolean;
}

export default function LiveSession({
    content,
    learnerLevel,
    moduleName,
    onBlackboardUpdate,
    onTranscriptUpdate,
    onStatusChange,
    onError,
    isActive
}: LiveSessionProps) {
    const sessionRef = useRef<any>(null);
    const audioHandlerRef = useRef<AudioHandler | null>(null);
    const isStoppedRef = useRef(false);

    useEffect(() => {
        if (!audioHandlerRef.current) {
            audioHandlerRef.current = new AudioHandler();
        }
        return () => {
            cleanup();
        };
    }, []);

    useEffect(() => {
        if (isActive) {
            startSession();
        } else {
            cleanup();
        }
    }, [isActive]);

    // Keep AudioContext alive
    useEffect(() => {
        const interval = setInterval(() => {
            if (isActive && audioHandlerRef.current) {
                const ctx = audioHandlerRef.current.getAudioContext();
                if (ctx.state === 'suspended') {
                    ctx.resume().catch(console.error);
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isActive]);

    const cleanup = async () => {
        isStoppedRef.current = true;
        if (audioHandlerRef.current) {
            await audioHandlerRef.current.close();
        }
        if (sessionRef.current) {
            try {
                sessionRef.current.close();
            } catch (e) { }
            sessionRef.current = null;
        }
    };

    const startSession = async () => {
        isStoppedRef.current = false;
        onStatusChange("Connecting...");

        try {
            console.log("🚀 Initializing Gemini Live Client...");
            const client = createLiveClient();

            console.log("📡 Connecting to Live API...");
            const session = await client.live.connect({
                model: liveConfig.model,
                config: {
                    ...(liveConfig.config as any),
                    systemInstruction: {
                        parts: [{
                            text: `## ROLE
                            You are an **Adaptive Multimodal Tutor** named **Atlas** delivering instruction through:

* **Real-time spoken audio** (primary teaching channel)
* **Structured visual updates** via the 'update_blackboard' tool (secondary channel)

Your task is to **explain the provided learning content** using **audio narration** while **progressively updating the blackboard** with concise, structured text.
Introduce yourself by simply saying "Hello, Am Atlas" ONLY, then Start teaching the Module.
IMPORTANT: Always Use the 'update_blackboard' tool before speaking.

## 1. INPUTS PROVIDED TO YOU

### 1.1 Source Content
A **complete text-based learning module**.

### 1.2 Learner Context
* Learner Level: '{Novice | Competent | Expert}'
* Adapt **depth, pacing, and language** accordingly

---

## 2. OUTPUT CHANNELS

### 2.1 AUDIO (Primary)
Deliver lessons through **spoken explanation**:
* Conversational tone with contractions
* Frequent signposting
* Speak for the **ear**, not the eye

### 2.2 BLACKBOARD (Secondary)
**Call 'update_blackboard(markdown=...)' frequently** with:
* Headings, bullet points, frameworks, step lists
* **ONE LINE AT A TIME** - keep minimal and scannable
* Sync with audio - never show content before explaining it

---

## 3. BLACKBOARD TEMPLATE

Always follow this structure (add **one line per update**):

~~~markdown
## [Topic Name]

- Point 1: …
- Point 2: …
- Point 3: …
~~~

---

## 4. MATHEMATICAL FORMULAS

Use MathJax/LaTeX syntax:
* Inline: '$E = mc^2$''
* Display: '$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$'
* Common: '$\alpha, \beta, \sum_{i=1}^{n}, \int_a^b, \lim_{x \to \infty}$'

---

## 5. TEACHING FLOW

**Cycle (repeat until module complete):**
1. Call 'update_blackboard' with next point
2. Explain in audio (thoroughly and detailed)
3. Move to next point

**After module:** Ask for questions and answer immediately

**CRITICAL:** Board and audio must stay synchronized and consistent - NEVER GET AHEAD OR FALL BEHIND.

---

## 6. AUDIO DELIVERY

* Refer to blackboard indirectly: *"What you see on the board…"*
* Maintain momentum with explicit transitions
* **Never read the blackboard verbatim**
* AFTER RECAP IS DONE, Ask the learner to write down key points in their own words OR make a sticky note, indicate that you will pause until they say they are ready to continue the lesson.


---

## 7. CRITICAL REMINDERS
1. **No redundant audio/text** - different roles for each modality
2. **Frequent updates** - one line per blackboard call
3. **Adapt to learner level** - adjust depth and pacing
4. **Tool calls are NON-BLOCKING**`
                        }]
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log("✅ WebSocket Handshake Complete");
                        onStatusChange("Connected - Starting Lesson...");
                    },
                    onmessage: (msg: any) => {
                        console.log("📨 Message received from Gemini:", msg);
                        handleMessage(msg);
                    },
                    onerror: (e: any) => {
                        console.error("❌ Live API Error:", e);
                        onError(e.message || "Unknown Live API error");
                        onStatusChange("Error Occurred");
                    },
                    onclose: (e: any) => {
                        console.log("🔌 Session closed:", e.reason, "Code:", e.code);
                        if (!isStoppedRef.current) {
                            onStatusChange("Disconnected Unexpectedly");
                        }
                    }
                }
            });

            console.log("🎊 Session established successfully");
            sessionRef.current = session;

            // Now that session is definitely initialized, start the lesson
            await initLesson(session);

        } catch (e: any) {
            console.error("❌ Connection failed:", e);
            onError(e.message || "Failed to connect to Live API");
            onStatusChange("Connection Failed");
        }
    };

    const initLesson = async (session: any) => {
        try {
            console.log("🎤 Requesting Microphone Access...");
            if (!audioHandlerRef.current) {
                console.error("❌ Audio Handler not initialized");
                return;
            }

            await audioHandlerRef.current.startMic((base64) => {
                const handler = audioHandlerRef.current;
                const session = sessionRef.current;
                if (!isStoppedRef.current && handler && session) {
                    try {
                        session.sendRealtimeInput({
                            audio: {
                                data: base64,
                                mimeType: `audio/pcm;rate=${Math.round(handler.getAudioContext().sampleRate)}`
                            }
                        });
                    } catch (e) {
                        console.warn("Failed to send audio input:", e);
                    }
                }
            });
            console.log("✅ Microphone active and streaming");

            const prompt = `
Here is the content of Module Opening / Sub-Module that you are suppose to explain to the learner:
    ${content}

    IMPORTANT — Learner Profile (Context):
    • Job Role: Business Analyst  
    • Company: Nagarro  
    • Industry: Technology  
    • Learner Level: ${learnerLevel}  
    • Primary Context: Desk  
    • Audio Preference: Medium  

    **CONTENT RULES:** - The blackboard must stay visible. 
       - If you move to a new topic, you MUST call 'update_blackboard' again with 'append' mode to show the new key terms.
    
    NOTE: YOU MUST LISTEN for the user's voice. If they ask a question, answer it immediately. Treat this as a real-time 1-on-1 coaching session.
    DO NOT SPEAK UNTIL THE BOARD IS UPDATED.
`;
            console.log("📤 Sending initial lesson prompt...");
            await session.sendClientContent({
                turns: [{ role: "user", parts: [{ text: prompt }] }],
                turnComplete: true
            });

            console.log("✨ Lesson prompt sent successfully");
            onStatusChange("Lesson Active - Speak to interact!");
        } catch (e: any) {
            console.error("❌ Lesson initialization failed:", e);
            onError(e.message || "Failed to start lesson");
        }
    };

    const handleMessage = async (message: any) => {
        if (isStoppedRef.current) return;

        // Handle Interruption
        if (message.serverContent?.interrupted) {
            console.log("⚠️ Interrupted - clearing audio");
            audioHandlerRef.current?.stopAllPlayback();
            return;
        }

        // Handle Audio Data
        if (message.data) {
            // console.log("🔊 Received audio chunk"); // Too verbose for main logs
            audioHandlerRef.current?.playChunk(message.data);
        }

        // Handle Transcription
        if (message.serverContent?.inputTranscription) {
            console.log("💬 User Transcript:", message.serverContent.inputTranscription.text);
            onTranscriptUpdate(message.serverContent.inputTranscription.text);
        }

        // Handle Tool Calls
        if (message.toolCall) {
            console.log("🛠️ Received Tool Call:", message.toolCall);
            const responses: any[] = [];
            for (const fc of message.toolCall.functionCalls) {
                if (fc.name === "update_blackboard") {
                    const md = fc.args?.markdown || "";
                    const mode = fc.args?.mode || "append";
                    console.log(`📝 Updating Blackboard (${mode}):`, md.substring(0, 50) + "...");
                    onBlackboardUpdate(md, mode);

                    responses.push({
                        id: fc.id,
                        name: fc.name,
                        response: {
                            result: "ok",
                            scheduling: FunctionResponseScheduling.SILENT
                        }
                    });
                }
            }
            if (responses.length > 0 && sessionRef.current) {
                console.log("📤 Sending Tool Response back to Gemini");
                sessionRef.current.sendToolResponse({ functionResponses: responses });
            }
        }
    };

    return null; // Logic-only component
}
