"use client";
import { Mic, Send, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { generateChatResponse } from "@/actions/chat";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface ChatInterfaceProps {
    currentScrollTop?: number;
    context?: string | null;
}

export interface Thread {
    id: string;
    top: number;
    userText: string;
    botText: string | null;
    isBotLoading: boolean;
}

interface ChatInterfaceProps {
    currentScrollTop?: number;
    context?: string | null;
    threads: Thread[];
    setThreads: React.Dispatch<React.SetStateAction<Thread[]>>;
}

export default function ChatInterface({ currentScrollTop = 0, context, threads, setThreads }: ChatInterfaceProps) {
    const [inputText, setInputText] = useState("");
    const [globalLoading, setGlobalLoading] = useState(false);

    // Ref to track the lowest point occupied by any thread to prevent overlap
    const [lowestPoint, setLowestPoint] = useState(0);

    // Reset lowestPoint when threads change significantly (e.g. module switch)
    useEffect(() => {
        if (threads.length === 0) {
            setLowestPoint(0);
        }
    }, [threads.length]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const text = inputText;
        setInputText("");
        setGlobalLoading(true);

        const targetTop = Math.max(currentScrollTop, lowestPoint + 20);

        const newThread: Thread = {
            id: Math.random().toString(36).substring(7),
            top: targetTop,
            userText: text,
            botText: null,
            isBotLoading: true
        };

        setThreads(prev => [...prev, newThread]);

        const history = threads.flatMap(t => [
            { role: "user" as const, parts: t.userText },
            ...(t.botText ? [{ role: "model" as const, parts: t.botText }] : [])
        ]);

        const response = await generateChatResponse(
            history,
            text,
            context || "No context provided."
        );

        setThreads(prev => prev.map(t => {
            if (t.id === newThread.id) {
                return {
                    ...t,
                    botText: response.success ? (response.response || "No response") : "Error: Could not generate response.",
                    isBotLoading: false
                };
            }
            return t;
        }));
        setGlobalLoading(false);
    };

    return (
        <div className="relative w-full h-full flex flex-col">
            {/* Messages Area - Absolute Positioning Context */}
            <div className="flex-1 relative w-full min-h-0">
                {threads.map((thread) => (
                    <ThreadItem
                        key={thread.id}
                        thread={thread}
                        onHeightChange={(height, top) => {
                            // When a thread grows (e.g. bot types), update the lowest point
                            const threadBottom = top + height;
                            setLowestPoint(prev => Math.max(prev, threadBottom));
                        }}
                    />
                ))}


                <div style={{ position: 'absolute', top: lowestPoint, height: '1px', width: '1px' }} />
            </div>

            {/* Sticky Input Area */}
            <div className="sticky bottom-0 z-50 p-6 pointer-events-none">
                <div className="relative pointer-events-auto">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={context ? "Ask a question..." : "Waiting..."}
                        disabled={globalLoading}
                        className="w-full bg-[#121212] border border-gray-800 rounded-xl py-4 pl-4 pr-24 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-600 transition-colors shadow-none"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        {globalLoading ? (
                            <div className="p-2">
                                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                            </div>
                        ) : (
                            <>
                                <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-800">
                                    <Mic className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={handleSend}
                                    disabled={!inputText.trim()}
                                    className="w-8 h-8 bg-accent-orange hover:bg-orange-600 text-black rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function ThreadItem({ thread, onHeightChange }: { thread: Thread, onHeightChange: (h: number, t: number) => void }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            onHeightChange(ref.current.offsetHeight, thread.top);
        }
    }, [thread.botText, thread.isBotLoading]); // Re-measure when content changes

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-0 left-0 px-6 py-2"
            style={{ top: thread.top }}
        >
            {/* User Message */}
            <div className="flex justify-end mb-2">
                <div className="bg-gray-800 text-white px-4 py-3 rounded-2xl rounded-tr-sm max-w-[90%] border border-gray-700 shadow-md">
                    <p className="text-sm">{thread.userText}</p>
                </div>
            </div>

            {/* Bot Message */}
            <AnimatePresence>
                {(thread.botText || thread.isBotLoading) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                    >
                        <div className="w-8 h-8 rounded-full bg-accent-orange flex items-center justify-center shrink-0 mr-3 mt-1 shadow-lg border border-orange-600/20">
                            <span className="text-black font-bold text-xs">A</span>
                        </div>
                        <div className="bg-transparent text-gray-300 max-w-[90%]">
                            {thread.isBotLoading ? (
                                <div className="flex gap-1 items-center h-8 px-2">
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                                </div>
                            ) : (
                                <div className="prose prose-invert prose-sm prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800">
                                    <ReactMarkdown>{thread.botText || ""}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
