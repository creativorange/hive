"use client";

import { BattleArena } from "@/components/BattleArena";
import { Stats } from "@/components/Stats";
import { LiveFeed } from "@/components/LiveFeed";
import { EvolutionTimeline } from "@/components/EvolutionTimeline";
import { BreedingLab } from "@/components/BreedingLab";

export default function Home() {
  return (
    <div className="space-y-8">
      <section>
        <Stats />
      </section>

      <section>
        <BattleArena />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EvolutionTimeline />
        </div>
        <div>
          <LiveFeed />
        </div>
      </div>

      <section>
        <BreedingLab />
      </section>
    </div>
  );
}
