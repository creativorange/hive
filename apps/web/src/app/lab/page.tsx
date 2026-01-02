"use client";

import { BreedingLab } from "@/components/BreedingLab";
import { EvolutionTimeline } from "@/components/EvolutionTimeline";

export default function LabPage() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="font-pixel text-xl text-meta-cyan text-glow mb-2">
          BREEDING LAB
        </h1>
        <p className="font-pixel text-[8px] text-meta-green/50">
          WITNESS EVOLUTION IN ACTION
        </p>
      </div>

      <BreedingLab />

      <div className="mt-8">
        <EvolutionTimeline />
      </div>
    </div>
  );
}
