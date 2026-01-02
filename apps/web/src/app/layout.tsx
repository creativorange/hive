import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "$META - Evolutionary Trading Bot",
  description: "Genetic algorithm-powered autonomous trading system for Pump.fun tokens",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-meta-bg text-meta-green antialiased">
        <div className="relative">
          <header className="sticky top-0 z-50 border-b-2 border-meta-green/30 bg-meta-bg/95 backdrop-blur">
            <div className="container mx-auto flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-4">
                <h1 className="font-pixel text-xl text-glow">$META</h1>
                <span className="hidden font-pixel text-[8px] text-meta-cyan sm:inline">
                  EVOLUTIONARY TRADING
                </span>
              </div>
              <nav className="flex items-center gap-4">
                <a
                  href="/"
                  className="font-pixel text-[8px] text-meta-green hover:text-meta-cyan transition-colors"
                >
                  ARENA
                </a>
                <a
                  href="/agents"
                  className="font-pixel text-[8px] text-meta-green hover:text-meta-cyan transition-colors"
                >
                  AGENTS
                </a>
                <a
                  href="/graveyard"
                  className="font-pixel text-[8px] text-meta-green hover:text-meta-cyan transition-colors"
                >
                  GRAVEYARD
                </a>
                <a
                  href="/lab"
                  className="font-pixel text-[8px] text-meta-green hover:text-meta-cyan transition-colors"
                >
                  LAB
                </a>
                <div className="h-4 w-px bg-meta-green/30" />
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-meta-green animate-pulse" />
                  <span className="font-pixel text-[6px] text-meta-green">LIVE</span>
                </div>
              </nav>
            </div>
          </header>

          <main className="container mx-auto px-4 py-6">{children}</main>

          <footer className="border-t-2 border-meta-green/30 py-4">
            <div className="container mx-auto px-4 text-center">
              <p className="font-pixel text-[6px] text-meta-green/50">
                $META AUTONOMOUS TRADING SYSTEM - GEN 0
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
