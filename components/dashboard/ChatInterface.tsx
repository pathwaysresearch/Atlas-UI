"use client";

import { Mic, Send } from "lucide-react";

export default function ChatInterface() {
    return (
        <aside className="w-full flex flex-col h-full border-l-0">

            <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 relative">

                {/* Chat messages would go here */}
            </div>

            <div className="p-6">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Type here"
                        className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl py-4 pl-4 pr-24 text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gray-500 transition-colors"
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-gray-800">
                            <Mic className="w-5 h-5" />
                        </button>
                        <button className="w-8 h-8 bg-accent-orange hover:bg-orange-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg">
                            <span className="font-bold text-sm">A</span>
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
