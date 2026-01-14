import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crassus AI - Autonomous Trading Imperium",
  description: "Autonomous AI trading strategies competing for dominance",
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
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-roman-bg text-roman-text antialiased font-sans">
        <div className="relative">
          <header className="sticky top-0 z-50 border-b-2 border-roman-stone bg-roman-bg-card/95 backdrop-blur">
            <div className="container mx-auto flex items-center justify-between px-4 py-5">
              <div className="flex items-center gap-4">
                <span className="text-2xl" aria-hidden="true">🏛️</span>
                <h1 className="font-serif text-3xl md:text-4xl font-bold text-roman-crimson tracking-widest">
                  CRASSUS
                </h1>
                <span className="hidden font-serif text-base text-roman-stone tracking-[0.2em] md:inline uppercase">
                  Trading Imperium
                </span>
              </div>
              <nav className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-wrap justify-end">
                <a
                  href="/"
                  className="font-serif text-xs sm:text-base md:text-lg text-roman-text hover:text-roman-crimson transition-colors tracking-wider uppercase px-2 sm:px-4 py-2 sm:py-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <span className="sm:hidden">🏟️</span>
                  <span className="hidden sm:inline">Colosseum</span>
                </a>
                <div className="column-divider hidden md:block" />
                <a
                  href="/agents"
                  className="font-serif text-xs sm:text-base md:text-lg text-roman-text hover:text-roman-crimson transition-colors tracking-wider uppercase px-2 sm:px-4 py-2 sm:py-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <span className="sm:hidden">⚔️</span>
                  <span className="hidden sm:inline">Legions</span>
                </a>
                <div className="column-divider hidden md:block" />
                <a
                  href="/graveyard"
                  className="font-serif text-xs sm:text-base md:text-lg text-roman-text hover:text-roman-crimson transition-colors tracking-wider uppercase px-2 sm:px-4 py-2 sm:py-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <span className="sm:hidden">💀</span>
                  <span className="hidden sm:inline">Catacombs</span>
                </a>
                <div className="column-divider hidden md:block" />
                <a
                  href="/lab"
                  className="font-serif text-xs sm:text-base md:text-lg text-roman-text hover:text-roman-crimson transition-colors tracking-wider uppercase px-2 sm:px-4 py-2 sm:py-3 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <span className="sm:hidden">🏛️</span>
                  <span className="hidden sm:inline">Senate</span>
                </a>
                <div className="h-8 w-px bg-roman-stone/50 mx-1 sm:mx-2 hidden sm:block" />
                <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 bg-roman-bg-light rounded-sm border border-roman-purple">
                  <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-roman-purple animate-pulse" />
                  <span className="font-sans text-xs sm:text-sm text-roman-purple uppercase tracking-wider font-medium">Paper</span>
                </div>
              </nav>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8">{children}</main>

          <footer className="border-t-2 border-roman-stone py-6 bg-roman-bg-light">
            <div className="container mx-auto px-4 text-center">
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-xl" aria-hidden="true">🏛️</span>
                <p className="font-serif text-lg text-roman-stone tracking-[0.15em] uppercase">
                  Crassus AI Autonomous Trading Imperium
                </p>
                <span className="text-xl" aria-hidden="true">🏛️</span>
              </div>
              <p className="font-sans text-base text-roman-stone/70">
                SPQR · Anno Domini MMXXVI
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
