"use client";

import ModuleSidebar from "@/components/dashboard/ModuleSidebar";
import MainContent from "@/components/dashboard/MainContent";
import ChatInterface from "@/components/dashboard/ChatInterface";
import { useState, useEffect } from "react";

export default function Home() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [activeSubModuleId, setActiveSubModuleId] = useState<number | null>(null);
  const [moduleStructure, setModuleStructure] = useState<string>("");

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleModuleChange = (moduleId: number, subModuleId?: number) => {
    setActiveModuleId(moduleId);
    setActiveSubModuleId(subModuleId ?? null);
  };

  return (
    <div className="flex w-full h-full overflow-hidden ">
      <ModuleSidebar
        progress={scrollProgress}
        onModuleChange={handleModuleChange}
        onModuleStructureLoaded={setModuleStructure}
        activeModuleId={activeModuleId}
        activeSubModuleId={activeSubModuleId}
      />

      {/* ATLAS Column */}
      <div className="flex-1 min-w-0 relative">
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
          <div className="h-12 flex items-center px-8 shrink-0">
            <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
              ATLAS
            </span>
          </div>

          <div className="flex-1 overflow-hidden">
            <MainContent
              onProgressChange={setScrollProgress}
              activeModuleId={activeModuleId}
              activeSubModuleId={activeSubModuleId}
              moduleStructure={moduleStructure}
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
          <div className="h-12 flex items-center px-6 shrink-0">
            <span className="text-xs font-semibold text-gray-500 tracking-wider uppercase">
              LEARNER
            </span>
          </div>

          <div className="flex-1 overflow-hidden">
            <ChatInterface />
          </div>
        </div>
      </div>
    </div>
  );
}
