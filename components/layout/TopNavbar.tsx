"use client";

import { ArrowLeft, Download, Settings, Ticket } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

export default function TopNavbar() {
  const [mode, setMode] = useState<"apply" | "learn">("learn");

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-[#141414] border-b border-border-color flex items-center justify-between px-4 z-50 shadow-sm">
      <div className="flex items-center gap-8">
        {/* Logo Area */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center border border-gray-600 shadow-inner">
            {/* Logo placeholder - simple geometric shape */}
            <div className="w-4 h-4 border-2 border-white transform rotate-45"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold tracking-wider leading-none mb-0.5">LEARNING</span>
            <span className="text-sm font-bold tracking-wide leading-none text-white">PATHWAYS</span>
          </div>
        </div>

        {/* Separator */}
        <div className="h-6 w-px bg-border-color"></div>


      </div>

      <div className="flex items-center gap-6">
        {/* Action Buttons Toggle */}
        <div className="flex items-center bg-[#1a1a1a] rounded-lg p-1 border border-border-color relative">
          <button
            onClick={() => setMode("apply")}
            className={`relative px-4 py-1.5 text-xs font-medium transition-colors z-10 ${mode === "apply" ? "text-white" : "text-gray-400 hover:text-gray-300"}`}
          >
            {mode === "apply" && (
              <motion.div
                layoutId="nav-toggle"
                className="absolute inset-0 bg-accent-orange rounded shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-20">Apply</span>
          </button>
          <button
            onClick={() => setMode("learn")}
            className={`relative px-4 py-1.5 text-xs font-medium transition-colors z-10 flex items-center gap-2 ${mode === "learn" ? "text-white" : "text-gray-400 hover:text-gray-300"}`}
          >
            {mode === "learn" && (
              <motion.div
                layoutId="nav-toggle"
                className="absolute inset-0 bg-accent-orange rounded shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <span className="relative z-20">Learn</span>
            <Ticket className="relative z-20 w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-l border-border-color pl-6">
          {/* Icons */}
          <button className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-[#1a1a1a] rounded-full">
            <Download className="w-5 h-5" />
          </button>
          <button className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-[#1a1a1a] rounded-full">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-300 font-medium">John Doe</span>
          <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-gray-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            JD
          </div>
        </div>
      </div>
    </nav>
  );
}
