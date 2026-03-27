import { useState, type ReactNode } from "react";
import Navbar from "./components/Navbar";
import { categoryColors, goals } from "./components/data";
import DashboardPage from "./components/dashboard";
import GoalsPage from "./components/goals";
import InsightsPage from "./components/insights";
import PlannerPage from "./components/planner";
import type { NavItem } from "./components/types";
import { Card } from "./components/ui";

export default function App() {
  const [activePage, setActivePage] = useState<NavItem>("Dashboard");
  const [search, setSearch] = useState("");

  const pages: Record<NavItem, ReactNode> = {
    Dashboard: <DashboardPage />,
    Planner: <PlannerPage />,
    Goals: <GoalsPage />,
    Insights: <InsightsPage />,
  };

  const currentPage = pages[activePage] || (
    <Card>
      <p className="text-slate-500 text-sm">🚧 {activePage} page coming soon.</p>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "'DM Sans', 'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <Navbar active={activePage} setActive={setActivePage} />
      <div className="flex pt-14">
        <aside className="w-56 flex-shrink-0 fixed top-14 bottom-0 left-0 border-r border-slate-100 bg-white px-4 py-5 flex flex-col gap-4 overflow-y-auto">
          <div>
            <div className="relative">
              <span className="absolute left-2.5 top-2.5 text-slate-300 text-sm">🔍</span>
              <input
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:border-blue-300 transition-colors"
                placeholder="Search goals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2">Categories</p>
            {Object.entries(categoryColors).map(([cat, color]) => (
              <button
                key={cat}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-xs text-slate-600">{cat}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2">Today's Focus</p>
            {goals
              .filter((g) => g.priority === "High")
              .slice(0, 3)
              .map((g) => (
                <div key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: categoryColors[g.category] }} />
                  <span className="text-xs text-slate-500 truncate">{g.title}</span>
                </div>
              ))}
          </div>
          <div className="mt-auto bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">🏆 Streak</p>
            <p className="text-2xl font-bold text-blue-600">14 days</p>
            <p className="text-[10px] text-slate-400">Keep going!</p>
          </div>
        </aside>

        <main className="ml-56 flex-1 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                {activePage === "Dashboard" ? "Adaptive Schedule" : activePage}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Friday, March 27, 2026 - AI-optimized for your priorities</p>
            </div>
            {activePage === "Dashboard" && (
              <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5">
                ⚡ Re-optimize
              </button>
            )}
          </div>
          {currentPage}
        </main>
      </div>
    </div>
  );
}
