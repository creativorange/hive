"use client";

import { AgentsDashboard } from "@/components/AgentsDashboard";

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-roman-text">PRAETORIAN COMMAND</h1>
        <span className="font-sans text-sm text-roman-stone">
          REAL-TIME MONITORING
        </span>
      </div>
      
      <AgentsDashboard />
    </div>
  );
}
