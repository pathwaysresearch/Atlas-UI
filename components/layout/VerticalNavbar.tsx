"use client";

import { MessageSquare, Paperclip, PenTool, StickyNote } from "lucide-react";

export default function VerticalNavbar() {
    return (
        <nav className="fixed top-24 right-6 bottom-8 w-14 flex flex-col items-center justify-center z-40 pointer-events-none">
            <div className="bg-black border border-gray-800 rounded-lg py-6 flex flex-col items-center gap-8 shadow-2xl pointer-events-auto">
                <button className="p-2.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-full transition-colors group relative">
                    <Paperclip className="w-5 h-5" />
                    <span className="absolute right-full mr-3 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-800">Attachments</span>
                </button>
                <button className="p-2.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-full transition-colors group relative">
                    <MessageSquare className="w-5 h-5" />
                    <span className="absolute right-full mr-3 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-800">Chat</span>
                </button>
                <button className="p-2.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-full transition-colors group relative">
                    <PenTool className="w-5 h-5" />
                    <span className="absolute right-full mr-3 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-800">Draw</span>
                </button>
                <button className="p-2.5 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-full transition-colors group relative">
                    <StickyNote className="w-5 h-5" />
                    <span className="absolute right-full mr-3 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-gray-800">Notes</span>
                </button>
            </div>
        </nav>
    );
}
