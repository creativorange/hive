"use client";

import { BreedingLab } from "@/components/BreedingLab";
import { EvolutionTimeline } from "@/components/EvolutionTimeline";

export default function LabPage() {
  return (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h1 className="font-serif text-xl text-roman-text mb-2">
          THE COLOSSEUM
        </h1>
        <p className="font-serif text-lg text-roman-stone">
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
