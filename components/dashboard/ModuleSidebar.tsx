"use client";

import { ChevronDown,Play, ChevronRight, Circle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { generateLearningPath } from "@/app/actions/learning-path";
import { getModuleHeadings, saveModuleHeadings, type Module } from "@/lib/indexeddb";

interface ModuleSidebarProps {
    progress?: number;
    onModuleChange?: (moduleId: number, subModuleId?: number) => void;
    onModuleStructureLoaded?: (structure: string) => void;
    activeModuleId?: number | null;
    activeSubModuleId?: number | null;
}

export default function ModuleSidebar({
    progress = 0,
    onModuleChange,
    onModuleStructureLoaded,
    activeModuleId,
    activeSubModuleId
}: ModuleSidebarProps) {
    const safeProgress =
  Number.isFinite(progress) && progress > 0 ? Math.min(progress, 100) : 100;

    const [isOpen, setIsOpen] = useState(true);
    const [expandedModule, setExpandedModule] = useState<number | null>(null);
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchContent() {
            // Check IndexedDB first
            const cachedModules = await getModuleHeadings();

            if (cachedModules && Array.isArray(cachedModules) && cachedModules.length > 0) {
                setModules(cachedModules);
                setLoading(false);
                return;
            }

            // Fetch if no cache or invalid
            try {
                const data = await generateLearningPath("Novice");
                if (data && data.modules) {
                    setModules(data.modules);
                    await saveModuleHeadings(data.modules);
                }
            } catch (err) {
                console.error("Failed to fetch learning path", err);
            } finally {
                setLoading(false);
            }
        }

        fetchContent();
    }, []);

    // Notify parent when modules are loaded
    useEffect(() => {
        if (modules.length > 0 && onModuleStructureLoaded) {
            // Convert modules to string format for API
            const structure = modules.map((module, idx) => {
                const subModulesList = module.subModules.map((sub, subIdx) => `${idx}.${subIdx} ${sub}`).join('\n');
                return `MODULE ${idx}: ${module.title}\n${subModulesList}`;
            }).join('\n\n');
            onModuleStructureLoaded(structure);
        }
    }, [modules, onModuleStructureLoaded]);

    const handleModuleClick = (idx: number) => {
        if (!isOpen) return;
        setExpandedModule(idx === expandedModule ? null : idx);
        // Notify parent - module opening (no submodule)
        onModuleChange?.(idx);
    };

    const handleSubModuleClick = (e: React.MouseEvent, modIdx: number, subIdx: number) => {
        e.stopPropagation(); // Prevent toggling accordion when clicking sub
        // Notify parent - sub-module selected
        onModuleChange?.(modIdx, subIdx);
    };

    return (
        <aside
            className={`${isOpen ? 'w-[300px]' : 'w-[64px]'} border-r border-[#27272a] flex flex-col h-[calc(100vh-64px)] transition-all duration-300 relative group`}
        >

            {/* Toggle */}
            <div
                className={`
                absolute top-4 z-20 h-10 flex items-center cursor-pointer
                group/toggle transition-all duration-300

                ${isOpen
                        ? 'right-3'
                        : 'left-1/2 -translate-x-1/2 translate-x-[3px]'}
                `}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div
                className={`
                    flex items-center h-full transition-all  gap-[1px] duration-300
                    ${isOpen ? 'flex-row' : 'flex-row-reverse'}
                `}
                >
                {/* Triangle */}
                <svg
                    viewBox="0 0 24 24"
                    className={`
                    w-4 h-4  
                    fill-gray-400
                    group-hover/toggle:fill-white
                    transition-transform duration-300
                    ${isOpen ? 'rotate-180' : 'rotate-0'}
                    `}
                >
                    <path d="M9 6l6 6-6 6z" />
                </svg>

                {/* Vertical Bar */}
                <div
                    className="
                    w-[3px] h-4 bg-gray-500 rounded-full -m-[5px]
                    group-hover/toggle:bg-gray-300
                    transition-colors
                    "
                />
                </div>
            </div>


            <div className="flex-1 overflow-y-auto bg-sidebar-bg overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent py-2 px-1.5">
                {/* Header */}
                <div className={`px-4 py-4 mb-2 flex items-center justify-between transition-opacity duration-300 ${!isOpen && 'opacity-0 h-0 p-0 pointer-events-none'}`}>
                    <h2 className="text-[15px] font-medium text-white/90">Learning Path</h2>
                </div>

                <div className="space-y-3">
                    {loading && isOpen && (
                        <div className="p-10 flex flex-col items-center justify-center space-y-3">
                            <div className="w-5 h-5 border-2 border-accent-orange border-t-transparent rounded-full animate-spin"></div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Mapping Path</div>
                        </div>
                    )}

                    {!loading && modules.map((module, idx) => {
                        const isExpanded = expandedModule === idx;
                        const isModuleActive = activeModuleId === idx;
                        const hasActiveSub = activeSubModuleId !== null && isModuleActive;
                        const isHeadingOrange = isModuleActive && !hasActiveSub;

                        return (
                            <div
                                key={idx}
                                className={`rounded-xl transition-all duration-300 group/card cursor-pointer overflow-hidden ${isModuleActive
                                    ? 'bg-[#1a1a1a] shadow-lg border border-white/5 ring-1 ring-white/5 shadow-black/50'
                                    : 'bg-transparent hover:bg-white/[0.03] border border-transparent'
                                    } ${isOpen ? 'mx-1' : 'mx-0.5 flex flex-col items-center'}`}
                                onClick={() => handleModuleClick(idx)}
                            >
                                {isOpen ? (
                                    <div className="p-4">
                                        <div className="flex items-start gap-3.5">
                                            {/* Concentric Circle Indicator from Image */}
                                            <div className="mt-1 shrink-0 relative flex items-center justify-center">
                                                {isModuleActive ? (
                                                    // Active state: Thick orange border + solid orange center
                                                    <div className="w-5 h-5 rounded-full border-[2.5px] border-accent-orange flex items-center justify-center bg-transparent">
                                                        <div className="w-[9px] h-[9px] bg-accent-orange rounded-full"></div>
                                                    </div>
                                                ) : (
                                                    // Inactive state: Thin grey/transparent ring
                                                    <div className="w-5 h-5 rounded-full border border-gray-600 flex items-center justify-center bg-transparent transition-colors group-hover/card:border-gray-500"></div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className={`text-[13px] leading-[1.4] transition-colors duration-200 ${isHeadingOrange ? 'text-accent-orange font-semibold' : isModuleActive ? 'text-white font-semibold' : 'text-gray-400 font-medium group-hover/card:text-gray-300'
                                                    }`}>
                                                    {module.title.replace(/^MODULE \d+: /, '')}
                                                </h3>
                                            </div>
                                            <div className="mt-1">
                                                <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-gray-300' : ''}`} />
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="space-y-1 mt-4 pl-[38px]">
                                                {module.subModules.map((sub, sIdx) => {
                                                    const isSubActive = isModuleActive && activeSubModuleId === sIdx;
                                                    return (
                                                        <div
                                                            key={sIdx}
                                                            className={`flex items-start gap-3 text-[12px] group/sub cursor-pointer transition-all py-1.5 ${isSubActive ? 'text-white font-medium' : 'text-gray-400 hover:text-white'
                                                                }`}
                                                            onClick={(e) => handleSubModuleClick(e, idx, sIdx)}
                                                        >
                                                            <div className={`mt-1.5 w-[3px] h-[3px] rounded-full transition-all shrink-0 ${isSubActive ? 'bg-white scale-125 shadow-[0_0_8px_rgba(255,255,255,0.7)]' : 'bg-gray-700 group-hover/sub:bg-gray-500'
                                                                }`}></div>
                                                            <span className="leading-tight">{sub}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {isModuleActive && (
                                            <div className="mt-5 space-y-2">
                                                <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold text-gray-400/80 px-0.5">
                                                    <span>Session Progress</span>
                                                    <span>{Math.round(safeProgress)}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-white/[0.05] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-accent-orange rounded-full transition-all duration-700 ease-out"
                                                        style={{ width: `${safeProgress}%`, boxShadow: '0 0 8px rgba(255, 112, 67, 0.3)' }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-4">
                                        {isModuleActive ? (
                                            <div className="w-5 h-5 rounded-full border-[2.5px] border-accent-orange flex items-center justify-center bg-transparent">
                                                <div className="w-[9px] h-[9px] bg-accent-orange rounded-full"></div>
                                            </div>
                                        ) : (
                                            <div className="w-5 h-5 rounded-full border border-gray-600 transition-colors group-hover/card:border-gray-500"></div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
