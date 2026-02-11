"use client";

import ModuleSidebar from "@/components/dashboard/ModuleSidebar";
import MainContent from "@/components/dashboard/MainContent";
import ChatInterface, { type Thread } from "@/components/dashboard/ChatInterface";
import { useState, useEffect, useRef } from "react";

export default function Home() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [activeSubModuleId, setActiveSubModuleId] = useState<number | null>(null);
  const [moduleStructure, setModuleStructure] = useState<string>("");

  // Shared state for scrolling and content
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [currentContent, setCurrentContent] = useState<string | null>(null);

  // Chat Persistence State
  // Map key format: "moduleId-subModuleId" or "moduleId-null"
  const [chatHistory, setChatHistory] = useState<Record<string, Thread[]>>({});

  const getChatKey = (mId: number | null, sId: number | null) => {
    if (mId === null) return "opening";
    return `${mId}-${sId ?? "opening"}`;
  };

  const activeChatKey = getChatKey(activeModuleId, activeSubModuleId);
  const activeThreads = chatHistory[activeChatKey] || [];

  const handleThreadsChange = (newThreadsOrUpdater: any) => {
    setChatHistory(prev => {
      const currentThreads = prev[activeChatKey] || [];
      const newThreads = typeof newThreadsOrUpdater === 'function'
        ? newThreadsOrUpdater(currentThreads)
        : newThreadsOrUpdater;

      return {
        ...prev,
        [activeChatKey]: newThreads
      };
    });
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleModuleChange = (moduleId: number, subModuleId?: number) => {
    setActiveModuleId(moduleId);
    setActiveSubModuleId(subModuleId ?? null);
    setCurrentContent(null);
    setScrollProgress(0);
    // Reset scroll when module changes
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setScrollTop(scrollTop);
      const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    }
  };

  return (
    <div className="flex w-full h-full overflow-hidden ">
      <ModuleSidebar
        progress={scrollProgress}
        hasContent={!!currentContent}
        onModuleChange={handleModuleChange}
        onModuleStructureLoaded={setModuleStructure}
        activeModuleId={activeModuleId}
        activeSubModuleId={activeSubModuleId}
      />

      {/* Shared Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative h-full scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-gray-700"
      >
        <div className="flex min-h-full relative">
          {/* ATLAS Column */}
          <div className="flex-1 min-w-0 relative border-r border-dashed border-gray-800">
            {mounted && (
              <div
                className="
                    absolute inset-0 pointer-events-none opacity-[0.1]
                    bg-[linear-gradient(var(--color-border-color)_1px,transparent_1px),linear-gradient(90deg,var(--color-border-color)_1px,transparent_1px)]
                    bg-[length:20px_20px]
                    "
              />
            )}

            <div className="relative z-10 flex flex-col h-full">
              <div className="h-12 flex items-center px-8 shrink-0 sticky top-0 bg-background/80 backdrop-blur-sm z-20 border-b border-gray-800/50">
                <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
                  ATLAS
                </span>
              </div>

              <div className="flex-1 overflow-hidden">
                <MainContent
                  activeModuleId={activeModuleId}
                  activeSubModuleId={activeSubModuleId}
                  moduleStructure={moduleStructure}
                  onContentLoaded={setCurrentContent}
                />
              </div>
            </div>
          </div>

          {/* LEARNER Column */}
          <div className="flex-1 min-w-0 relative border-l border-dashed">
            {mounted && (
              <div
                className="
                    absolute inset-0 pointer-events-none opacity-[0.1]
                    bg-[linear-gradient(var(--color-border-color)_1px,transparent_1px),linear-gradient(90deg,var(--color-border-color)_1px,transparent_1px)]
                    bg-[length:20px_20px]
                    "
              />
            )}

            <div className="relative z-10 flex flex-col h-full">
              <div className="h-12 flex items-center px-6 shrink-0 sticky top-0 bg-background/80 backdrop-blur-sm z-20 border-b border-gray-800/50">
                <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
                  LEARNER
                </span>
              </div>

              <div className="flex-1 flex flex-col h-full">
                <ChatInterface
                  currentScrollTop={scrollTop}
                  context={currentContent}
                  threads={activeThreads}
                  setThreads={handleThreadsChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}