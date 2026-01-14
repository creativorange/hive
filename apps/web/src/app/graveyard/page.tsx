"use client";

import { Graveyard } from "@/components/Graveyard";

export default function GraveyardPage() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="font-serif text-xl text-roman-blood text-glow mb-2">
          THE CATACOMBS
        </h1>
        <p className="font-serif text-[8px] text-roman-marble/50">
          WHERE LEGIONS COME TO REST
        </p>
      </div>

      <Graveyard />
    </div>
  );
}
