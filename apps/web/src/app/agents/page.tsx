"use client";

import { AgentsDashboard } from "@/components/AgentsDashboard";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-pixel text-xl text-meta-cyan text-glow">AGENT CONTROL CENTER</h1>
        <span className="font-pixel text-[8px] text-meta-green/50">
          REAL-TIME MONITORING
        </span>
      </div>
      
      <AgentsDashboard />
    </div>
  );
}
