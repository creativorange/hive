"use client";

import { Graveyard } from "@/components/Graveyard";

export default function GraveyardPage() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="font-pixel text-xl text-meta-red text-glow mb-2">
          THE GRAVEYARD
        </h1>
        <p className="font-pixel text-[8px] text-meta-green/50">
          WHERE STRATEGIES COME TO REST
        </p>
      </div>

      <Graveyard />
    </div>
  );
}
