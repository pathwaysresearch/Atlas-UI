"use client";

import { FileText, Headphones, Loader2, Mic, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { generateModuleContent } from "@/app/actions/content-generation";
import { generateCallouts } from "@/app/actions/callout-generation";
import { getContent, saveContent, type ContentCache } from "@/lib/indexeddb";
import type { LearnerLevel } from "@/types/content";

import { useGeminiLive } from "@/hooks/useGeminiLive";

interface MainContentProps {
    onProgressChange?: (progress: number) => void;
    activeModuleId?: number | null;
    activeSubModuleId?: number | null;
    moduleStructure?: string;
}

export default function MainContent({
    onProgressChange,
    activeModuleId,
    activeSubModuleId,
    moduleStructure
}: MainContentProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<"read" | "listen">("listen");
    const [content, setContent] = useState<string | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    // Live API State handled via Hook Callbacks
    const [blackboardLines, setBlackboardLines] = useState<{ html: string; id: string }[]>([]);
    const [userTranscript, setUserTranscript] = useState<string>("");
    const [liveStatus, setLiveStatus] = useState<string>("Disconnected");

    // Callbacks for the hook
    const handleBlackboardUpdate = useCallback((html: string, mode: "append" | "replace") => {
        console.log(`🖥️ UI: Blackboard Update Received (Mode: ${mode})`);
        const id = Math.random().toString(36).substring(7);
        if (mode === "replace") {
            setBlackboardLines([{ html, id }]);
        } else {
            setBlackboardLines(prev => [...prev, { html, id }]);
        }

        // Auto-scroll
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: "smooth"
                });
            }
        }, 100);
    }, []);

    const handleTranscriptUpdate = useCallback((text: string) => {
        console.log(`🎤 UI: Transcript Update: "${text}"`);
        setUserTranscript(text);
    }, []);

    // Clear transcript after 5 seconds
    useEffect(() => {
        if (userTranscript) {
            const timer = setTimeout(() => {
                setUserTranscript("");
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [userTranscript]);

    const handleStatusChange = useCallback((status: string) => {
        console.log(`📡 UI: Connection Status Change: ${status}`);
        setLiveStatus(status);
    }, []);

    const { connect, disconnect, isLiveActive, isConnected } = useGeminiLive({
        onBlackboardUpdate: handleBlackboardUpdate,
        onTranscriptUpdate: handleTranscriptUpdate,
        onStatusChange: handleStatusChange
    });

    const handleStartLesson = async () => {
        if (!content) {
            console.warn("⚠️ UI: No content available to start lesson");
            return;
        }
        console.log("🎬 UI: Starting lesson...");
        // Simple heuristic for learner level for now
        await connect(content, "Competent");
    };

    const handleStopLesson = () => {
        console.log("⏹️ UI: Stopping lesson...");
        disconnect();
    };

    // Helper function to check if text is a valid paragraph
    const isValidParagraph = (text: string): boolean => {
        const stripped = text.trim();
        if (!stripped || stripped.startsWith("#")) {
            return false;
        }

        const lines = stripped.split("\n");
        if (lines.length >= 3) {
            return true;
        }

        if (stripped.length > 300) {
            return true;
        }

        return false;
    };

    // Inject callouts into markdown content
    const injectCallouts = async (
        markdownText: string,
        learnerLevel: LearnerLevel,
        moduleName: string
    ): Promise<string> => {
        // Split by double newlines
        const blocks = markdownText.split(/\n\s*\n/);

        const formattedBlocks: string[] = [];
        const paraBuffer: string[] = [];
        const insertionPoints: { index: number; context: string }[] = [];

        let paraCountSinceLast = 0;

        for (const block of blocks) {
            formattedBlocks.push(block);

            if (isValidParagraph(block)) {
                paraBuffer.push(block);
                paraCountSinceLast++;

                // Insert callout every 4 paragraphs
                if (paraCountSinceLast >= 4) {
                    const contextParas = paraBuffer.slice(-4);
                    const contextText = contextParas.join("\n\n");

                    insertionPoints.push({
                        index: formattedBlocks.length,
                        context: contextText
                    });

                    paraCountSinceLast = 0;
                }
            }
        }



        // If no insertion points, return original
        if (insertionPoints.length === 0) {
            console.log('⚠️ [CALLOUT INJECTION] No insertion points found, returning original content');
            return markdownText;
        }

        // Generate callouts batch
        const contexts = insertionPoints.map(item => item.context);

        try {
            const result = await generateCallouts({
                learnerLevel,
                calloutContexts: contexts,
                specificModuleName: moduleName
            });

            if (!result.success || !result.callouts) {
                console.error('❌ [CALLOUT INJECTION] Failed to generate callouts:', result.error);
                return markdownText;
            }



            // Create insertion map
            const insertionMap: Record<number, string> = {};
            insertionPoints.forEach((item, idx) => {
                insertionMap[item.index] = result.callouts![idx];
            });

            // Inject callouts - keep <CALLOUT> tags intact for HTML parsing
            const finalOutputBlocks: string[] = [];

            for (let i = 0; i < formattedBlocks.length; i++) {
                finalOutputBlocks.push(formattedBlocks[i]);

                const targetIdx = i + 1;
                if (insertionMap[targetIdx]) {
                    const calloutText = insertionMap[targetIdx];



                    // Keep the <CALLOUT> tags - they will be parsed by rehype-raw
                    finalOutputBlocks.push(calloutText);
                }
            }

            const finalMarkdown = finalOutputBlocks.join("\n\n");

            return finalMarkdown;

        } catch (error) {
            console.error('❌ [CALLOUT INJECTION] Error injecting callouts:', error);
            return markdownText;
        }
    };

    // Fetch and display content
    const fetchAndDisplayContent = async (
        moduleId: number,
        subModuleId?: number
    ) => {
        setIsLoadingContent(true);

        try {
            // Check IndexedDB first
            const cachedContent = await getContent(moduleId, subModuleId);

            if (cachedContent) {
                setContent(cachedContent);
                setIsLoadingContent(false);
                return;
            }



            // Not cached - generate new content
            const isModuleOpening = subModuleId === undefined || subModuleId === null;

            const result = await generateModuleContent({
                learnerLevel: "Novice", // TODO: Get from user settings
                selectionType: isModuleOpening ? "Module Opening" : "Sub-Module",
                moduleStructure: moduleStructure || "",
                subModuleName: !isModuleOpening ? `${moduleId}.${subModuleId}` : undefined,
                specificModuleName: isModuleOpening ? `Module ${moduleId}` : undefined
            });

            if (!result.success || !result.content) {
                console.error('❌ [CONTENT FETCH] Failed to generate content:', result.error);
                setContent("Failed to load content. Please try again.");
                setIsLoadingContent(false);
                return;
            }



            let finalContent = result.content;

            // If sub-module, inject callouts
            if (!isModuleOpening) {
                finalContent = await injectCallouts(
                    finalContent,
                    "Novice",
                    `Module ${moduleId}, Sub-module ${subModuleId}`
                );
            }

            // Save to IndexedDB
            const cacheId = `${moduleId}_${subModuleId ?? "opening"}`;
            const cacheData: ContentCache = {
                id: cacheId,
                moduleId,
                subModuleId: subModuleId ?? null,
                content: finalContent,
                timestamp: Date.now()
            };

            await saveContent(cacheData);

            setContent(finalContent);

        } catch (error) {
            console.error('❌ [CONTENT FETCH] Error fetching content:', error);
            setContent("An error occurred while loading content.");
        } finally {
            setIsLoadingContent(false);
        }
    };

    // Trigger content fetch when active module/submodule changes
    useEffect(() => {
        if (activeModuleId !== null && activeModuleId !== undefined) {
            // Reset Listen mode state when module changes
            setBlackboardLines([]);
            setUserTranscript("");
            // Disconnect if active? Maybe not automatically, but let's reset status
            // handleStopLesson(); // Optional: stop lesson when changing module

            fetchAndDisplayContent(activeModuleId, activeSubModuleId ?? undefined);
        }
    }, [activeModuleId, activeSubModuleId]);

    useEffect(() => {
        const handleScroll = () => {
            if (scrollRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
                const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
                onProgressChange?.(Math.min(100, Math.max(0, progress)));
            }
        };

        const currentRef = scrollRef.current;
        if (currentRef) {
            currentRef.addEventListener("scroll", handleScroll);
            handleScroll();
        }

        return () => {
            if (currentRef) {
                currentRef.removeEventListener("scroll", handleScroll);
            }
        };
    }, [onProgressChange]);

    // Trigger MathJax typeset when blackboard content changes
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).MathJax && (window as any).MathJax.typesetPromise) {
            (window as any).MathJax.typesetPromise().catch((err: any) => console.warn('MathJax error:', err));
        }
    }, [blackboardLines]);

    return (
        <div
            ref={scrollRef}
            className="flex-1 transparent p-8 overflow-y-auto h-[calc(100vh-112px)] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-700"
        >
            {/* MathJax Script */}
            <script
                dangerouslySetInnerHTML={{
                    __html: `
                    window.MathJax = {
                        tex: {
                        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
                        processEscapes: true
                        },
                        svg: {
                        fontCache: 'global'
                        }
                    };
                    `
                }}
            />
            <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"></script>

            <div className="max-w-3xl mx-auto">
                {/* Toggle Switch */}
                <div className="flex items-center bg-[#1a1a1a] rounded-lg p-1 w-fit mb-8 border border-border-color">
                    <button
                        onClick={() => setMode("listen")}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === "listen" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >
                        {mode === "listen" && (
                            <motion.div
                                layoutId="content-toggle"
                                className="absolute inset-0 bg-accent-orange rounded-md shadow-sm"
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10">I want to Listen</span>
                        <Headphones className="relative z-10 w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setMode("read")}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === "read" ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
                    >
                        {mode === "read" && (
                            <motion.div
                                layoutId="content-toggle"
                                className="absolute inset-0 bg-accent-orange rounded-md shadow-sm"
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10">I want to read</span>
                        <FileText className="relative z-10 w-4 h-4" />
                    </button>
                </div>

                {/* Loading State */}
                {isLoadingContent && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-accent-orange animate-spin mb-4" />
                        <p className="text-gray-400">Generating content...</p>
                    </div>
                )}

                {/* Content Display */}
                {!isLoadingContent && content && (
                    <div className="w-full">
                        {mode === "read" ? (
                            <div className="prose prose-invert max-w-none">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    rehypePlugins={[rehypeRaw]}
                                    components={{
                                        // Custom CALLOUT element renderer
                                        callout: ({ node, children, ...props }: any) => {
                                            return (
                                                <div
                                                    className="bg-accent-orange text-black p-6 rounded-lg my-6 border-l-4 border-orange-600 shadow-lg"
                                                    {...props}
                                                >
                                                    {children}
                                                </div>
                                            );
                                        },
                                        div: ({ node, className, ...props }: any) => {
                                            if (className?.includes('callout-box')) {
                                                return (
                                                    <div
                                                        className="bg-accent-orange text-black p-4 rounded-lg my-6 border-l-4 border-orange-600 shadow-md"
                                                        {...props}
                                                    />
                                                );
                                            }
                                            return <div className={className} {...props} />;
                                        },
                                        h1: ({ node, ...props }: any) => <h1 className="text-3xl font-bold text-white mb-4 uppercase" {...props} />,
                                        h2: ({ node, ...props }: any) => <h2 className="text-2xl font-bold text-white mb-3 mt-8" {...props} />,
                                        h3: ({ node, ...props }: any) => <h3 className="text-accent-orange text-sm font-bold uppercase tracking-wider mb-2 mt-6" {...props} />,
                                        p: ({ node, ...props }: any) => <p className="text-black-400 font-semibold leading-relaxed mb-4" {...props} />,
                                        strong: ({ node, ...props }: any) => <strong className="text-white font-semibold" {...props} />,
                                        ul: ({ node, ...props }: any) => <ul className="text-black-400 font-semibold leading-relaxed mb-4 ml-6 list-disc" {...props} />,
                                        ol: ({ node, ...props }: any) => <ol className="text-black-400 font-semibold leading-relaxed mb-4 ml-6 list-decimal" {...props} />,
                                    } as any}
                                >
                                    {content}
                                </ReactMarkdown>
                            </div>
                        ) : (
                            /* Listen Mode / Blackboard UI */
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center justify-between mb-4 bg-[#1a1a1a] p-4 rounded-lg border border-border-color">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${isLiveActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                                        <span className="text-sm font-medium text-gray-300">{liveStatus}</span>
                                    </div>
                                    <button
                                        onClick={isLiveActive ? handleStopLesson : handleStartLesson}
                                        className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${isLiveActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-accent-orange hover:bg-orange-600 text-black'}`}
                                    >
                                        {isLiveActive ? 'Stop Lesson' : 'Start Lesson'}
                                    </button>
                                </div>

                                {/* Blackboard Content */}
                                <div className="space-y-4 min-h-[400px]">
                                    {blackboardLines.length === 0 && !isLoadingContent && (
                                        <div className="flex flex-col items-center justify-center py-20 bg-[#0d0d0d] rounded-xl border border-dashed border-gray-800">
                                            <MessageSquare className="w-12 h-12 text-gray-700 mb-4" />
                                            <p className="text-gray-500">Wait for Atlas to update the blackboard...</p>
                                        </div>
                                    )}
                                    {blackboardLines.map((line) => (
                                        <motion.div
                                            key={line.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.5 }}
                                            className="prose prose-invert max-w-none bg-[#0d0d0d] p-6 rounded-xl border border-gray-800/50 shadow-sm"
                                            dangerouslySetInnerHTML={{ __html: line.html }}
                                        />
                                    ))}
                                </div>

                                {/* User Transcript Overlay */}
                                {userTranscript && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="fixed bottom-32 left-1/2 -translate-x-1/2 max-w-xl w-full bg-accent-orange/10 backdrop-blur-md border border-accent-orange/30 p-4 rounded-2xl shadow-2xl z-50"
                                    >
                                        <div className="flex items-center gap-3 mb-1">
                                            <Mic className="w-4 h-4 text-accent-orange" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">Atlas is listening...</span>
                                        </div>
                                        <p className="text-white font-medium italic">"{userTranscript}"</p>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Placeholder when no module selected */}
                {!isLoadingContent && !content && activeModuleId === null && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <FileText className="w-16 h-16 text-gray-600 mb-4" />
                        <p className="text-gray-500 text-lg">Select a module or sub-module to begin learning</p>
                    </div>
                )}
            </div>
        </div>
    );
}
