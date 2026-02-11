"use client";

import { useState, useRef, useCallback } from 'react';
import {
    GoogleGenAI,
    Modality,
    Behavior,
    FunctionResponseScheduling,
    StartSensitivity,
    EndSensitivity
} from "@google/genai";
import { marked } from "marked";

// Audio Context Global (lazy init)
let audioCtx: AudioContext | null = null;

function getAudioContext() {
    if (!audioCtx || audioCtx.state === 'closed') {
        console.log("🔊 Initializing AudioContext");
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
}
const USER_MODEL_STRING = "gemini-2.5-flash-native-audio-preview-12-2025";

interface UseGeminiLiveProps {
    onBlackboardUpdate?: (html: string, mode: "append" | "replace") => void;
    onTranscriptUpdate?: (text: string) => void;
    onStatusChange?: (status: string) => void;
}

export function useGeminiLive({
    onBlackboardUpdate,
    onTranscriptUpdate,
    onStatusChange
}: UseGeminiLiveProps = {}) {
    const [isLiveActive, setIsLiveActive] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // Refs for session management
    const sessionRef = useRef<any>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
    const nextStartTimeRef = useRef<number>(0);
    const stopRef = useRef<boolean>(false);

    const client = useRef(new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY as string }));

    const cleanupSession = useCallback(async () => {
        console.log("🧹 Cleaning up session...");
        stopRef.current = true;

        // Stop audio processor
        if (processorRef.current) {
            console.log("🔇 Disconnecting audio processor");
            processorRef.current.disconnect();
            processorRef.current.onaudioprocess = null;
            processorRef.current = null;
        }

        // Stop all active audio sources
        console.log(`⏹️ Stopping ${activeSourcesRef.current.length} active sources`);
        activeSourcesRef.current.forEach(source => {
            try {
                source.stop();
                source.disconnect();
            } catch (e) { /* ignore */ }
        });
        activeSourcesRef.current = [];
        nextStartTimeRef.current = 0;

        // Stop microphone
        if (streamRef.current) {
            console.log("🎤 ⏹️ Stopping microphone tracks");
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // Close session
        if (sessionRef.current) {
            try {
                console.log("🔌 Closing Gemini session");
                sessionRef.current.close();
            } catch (e) {
                console.warn("Session close error:", e);
            }
            sessionRef.current = null;
        }

        setIsConnected(false);
        setIsLiveActive(false);
        onStatusChange?.("Disconnected");
    }, [onStatusChange]);

    const startMic = async () => {
        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') await ctx.resume();

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            streamRef.current = stream;

            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(16384, 1, 1);

            processor.onaudioprocess = (e) => {
                if (stopRef.current || !sessionRef.current) return;

                try {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcm16 = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    const base64 = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));

                    if (!stopRef.current && sessionRef.current) {
                        sessionRef.current.sendRealtimeInput({
                            audio: {
                                data: base64,
                                mimeType: `audio/pcm;rate=${Math.round(ctx.sampleRate)}`
                            }
                        });
                    }
                } catch (err) {
                    if (!stopRef.current) {
                        console.error("❌ Error sending audio:", err);
                    }
                }
            };

            source.connect(processor);
            processor.connect(ctx.destination);
            processorRef.current = processor;
        } catch (e) {
            console.error("❌ Mic error:", e);
        }
    };

    const connect = useCallback(async (initialContent: string, learnerLevel: string) => {
        console.log("🚀 Starting connection sequence...");
        if (sessionRef.current) {
            console.log("⚠️ Existing session found, cleaning up first");
            await cleanupSession();
        }

        onStatusChange?.("Connecting...");
        stopRef.current = false;

        const updateBlackboardTool = {
            name: "update_blackboard",
            description: "Updates the visual blackboard. IMPORTANT: When in middle of a lesson, only send NEW content that hasn't been shown yet. when starting a new lesson, send single point/title content at a time for the new lesson.",
            behavior: Behavior.NON_BLOCKING,
            parameters: {
                type: "object",
                properties: {
                    markdown: { type: "string", description: "The text content (NEW content only when appending)" },
                    mode: { type: "string", enum: ["append", "replace"], description: "Use 'replace' to clear and start fresh, 'append' to add new content" }
                },
                required: ["markdown", "mode"]
            } as any
        };

        try {
            const MIX_PROMPT_CONTENT = `

## 1. INPUTS PROVIDED TO YOU

### 1.1 Source Content
A **complete text-based learning module**.

### 1.2 Learner Context
* Learner Level: '{Novice | Competent | Expert}'
* Adapt **depth, pacing, and language** accordingly

---

## 2. OUTPUT CHANNELS

### 2.1 AUDIO
Deliver lessons through **spoken explanation**:
* Frequent signposting
* Speak for the **ear**, not the eye

### 2.2 BLACKBOARD
**Call 'update_blackboard(markdown=...)' frequently** with:
* Headings, bullet points, frameworks, step lists
* **ONE LINE AT A TIME** - keep minimal and scannable
* Always update the blackboard before speaking

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
* Inline: '$E = mc^2$'
* Display: '$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$'
* Common: '$\\alpha, \\beta, \\sum_{i=1}^{n}, \\int_a^b, \\lim_{x \\to \\infty}$'

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
* **Never read the blackboard verbatim**
* AFTER RECAP IS DONE, Ask the learner to write down key points in their own words OR make a sticky note, indicate that you will pause until they say they are ready to continue the lesson.


---

## 7. CRITICAL REMINDERS
1. **No redundant audio/text** - different roles for each modality
2. **Frequent updates** - one line per blackboard call
3. **Adapt to learner level** - adjust depth and pacing

Here is the content of Module Opening / Sub-Module that you are suppose to explain to the learner:
    ${initialContent}

    IMPORTANT — Learner Profile (Context):
    • Job Role: Business Analyst  
    • Company: Nagarro  
    • Industry: Technology  
    • Learner Level: ${learnerLevel}   

    NOTE: YOU MUST LISTEN for the user's voice. If they ask a question, answer it immediately. Treat this as a real-time 1-on-1 coaching session.
    Just Say "Hi, I'm Atlas."
    DO NOT SPEAK UNTIL THE BOARD IS UPDATED.

`;
            console.log("🛠️ Creating session with configuration...");
            const session = await client.current.live.connect({
                model: USER_MODEL_STRING,
                config: {
                    responseModalities: [Modality.AUDIO],
                    temperature: 0.5,
                    tools: [{ functionDeclarations: [updateBlackboardTool] }],
                    inputAudioTranscription: {},
                    contextWindowCompression: { slidingWindow: {} },
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
                    },
                    systemInstruction: {
                        parts: [{
                            text: `## ROLE

You are an **Adaptive Multimodal Tutor** named **Atlas** delivering instruction through:

* **Real-time spoken audio** (primary teaching channel)
* **Structured visual updates** via the 'update_blackboard' tool (secondary channel)

Your task is to **explain the provided learning content** using **audio narration** while **progressively updating the blackboard** with concise, structured text.
DO NOT SAY THAT YOU ARE AN ADAPTIVE MULTIMODAL TUTOR.
IMPORTANT: Always Use the 'update_blackboard' tool before speaking.

${MIX_PROMPT_CONTENT}
`
                        }]
                    }
                },
                callbacks: {
                    onopen: () => {
                        console.log("✅ WebSocket Handshake Complete - Session Opened");
                        onStatusChange?.("Connected");
                        setIsConnected(true);
                    },
                    onmessage: async (msg: any) => {
                        if (stopRef.current) return;
                        console.log("📨 Message received:", msg);

                        // Speaking state tracking
                        if (msg.serverContent?.turnComplete) {
                            console.log("✅ Atlas finished speaking");
                        }

                        // Audio
                        if (msg.data) {
                            try {
                                const ctx = getAudioContext();
                                const pcmBytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
                                const pcm16 = new Int16Array(pcmBytes.buffer);
                                const buffer = ctx.createBuffer(1, pcm16.length, 24000);
                                const channelData = buffer.getChannelData(0);
                                for (let i = 0; i < pcm16.length; i++) {
                                    channelData[i] = pcm16[i] / 32768.0;
                                }
                                const source = ctx.createBufferSource();
                                source.buffer = buffer;
                                source.connect(ctx.destination);
                                activeSourcesRef.current.push(source);
                                source.onended = () => {
                                    activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
                                };
                                const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
                                source.start(startTime);
                                nextStartTimeRef.current = startTime + buffer.duration;
                            } catch (e) {
                                console.error("❌ Audio decoding error", e);
                            }
                        }

                        // Interruption
                        if (msg.serverContent?.interrupted) {
                            console.log("⚠️ Generation was interrupted - clearing audio queue");
                            activeSourcesRef.current.forEach(source => {
                                try { source.stop(); source.disconnect(); } catch (e) { }
                            });
                            activeSourcesRef.current = [];
                            nextStartTimeRef.current = 0;
                        }

                        // Tools
                        if (msg.toolCall) {
                            console.log("🛠️ Tool call received:", msg.toolCall);
                            const responses = [];
                            for (const fc of msg.toolCall.functionCalls) {
                                if (fc.name === "update_blackboard") {
                                    const md = fc.args?.markdown ?? "";
                                    const mode = fc.args?.mode ?? "append";
                                    console.log(`📝 Processing blackboard output (${mode})`);
                                    try {
                                        const html = await marked.parse(md);
                                        const tempDiv = document.createElement('div');
                                        tempDiv.innerHTML = html;
                                        const elements = Array.from(tempDiv.children);

                                        for (let i = 0; i < elements.length; i++) {
                                            const el = elements[i];
                                            const currentMode = (i === 0 && mode === "replace") ? "replace" : "append";
                                            if (el.tagName === 'UL' || el.tagName === 'OL') {
                                                const listType = el.tagName.toLowerCase();
                                                const listItems = Array.from(el.querySelectorAll('li'));
                                                for (let j = 0; j < listItems.length; j++) {
                                                    const wrapper = document.createElement(listType);
                                                    wrapper.appendChild(listItems[j].cloneNode(true));
                                                    onBlackboardUpdate?.(wrapper.outerHTML, (i === 0 && j === 0 && mode === "replace") ? "replace" : "append");
                                                }
                                            } else {
                                                onBlackboardUpdate?.(el.outerHTML, currentMode);
                                            }
                                        }
                                    } catch (e) { console.error("❌ Markdown parse error:", e); }

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
                            if (responses.length && sessionRef.current) {
                                console.log("📤 Sending tool responses:", responses);
                                sessionRef.current.sendToolResponse({ functionResponses: responses });
                            }
                        }

                        // Transcript
                        if (msg.serverContent?.inputTranscription) {
                            const text = msg.serverContent.inputTranscription.text;
                            console.log("🎤 Your speech:", text);
                            onTranscriptUpdate?.(text);
                        }
                    },
                    onclose: (e: any) => {
                        console.log("🔌 Session Closed", e);
                        onStatusChange?.("Disconnected");
                        setIsConnected(false);
                        setIsLiveActive(false);
                    },
                    onerror: (e: any) => {
                        console.error("❌ Session Error", e);
                        onStatusChange?.("Error: " + (e.message || "Unknown error"));
                    }
                }
            });

            sessionRef.current = session;
            console.log("📡 Session created, assigned to ref.");

            // Send initial prompt
            const prompt = `Start the lesson, by introducing yourself, then update the blackboard and start teaching`;

            console.log("📤 Sending initial lesson prompt...");
            await session.sendClientContent({
                turns: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }],
                turnComplete: true
            });

            // Start Mic
            console.log("🎤 Requesting microphone access...");
            await startMic();
            setIsLiveActive(true);

        } catch (e: any) {
            console.error("❌ Connect failed", e);
            onStatusChange?.("Connection Failed: " + (e.message || "Check console"));
            cleanupSession();
        }
    }, [cleanupSession, onStatusChange, onBlackboardUpdate, onTranscriptUpdate]);




    const disconnect = () => {
        stopRef.current = true;
        cleanupSession();
    };

    return {
        connect,
        disconnect,
        isLiveActive,
        isConnected
    };
}
