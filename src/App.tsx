import { useEffect, useState, type ReactNode } from "react";
import Navbar from "./components/Navbar";
import { categoryColors } from "./components/data";
import DashboardPage from "./components/dashboard.tsx";
import GoalsPage from "./components/goals.tsx";
import InsightsPage from "./components/insights.tsx";
import PlannerPage from "./components/planner.tsx";
import type { Goal, GoalCategory, GoalPriority, NavItem } from "./components/types";
import { Card } from "./components/ui";

type ApiGoal = {
  id: number;
  title: string;
  category: string;
  priority: string;
  progress: number;
  hours_per_week: number;
  duration_weeks: number;
  logged_hours: number;
  created_at: string;
};

type ApiGoalStreak = {
  streak_days: number;
  total_completed_goals: number;
  last_completion_date: string | null;
};

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const API_ROOT = RAW_API_BASE.endsWith("/api") ? RAW_API_BASE : `${RAW_API_BASE}/api`;
const USER_ID_KEY = "lifeos_user_id";

function normalizeCategory(raw: string): GoalCategory {
  const value = raw.toLowerCase();
  if (value === "fitness") {
    return "Fitness";
  }
  if (value === "academics") {
    return "Academics";
  }
  if (value === "finance") {
    return "Finance";
  }
  return "Personal";
}

function normalizePriority(raw: string): GoalPriority {
  const value = raw.toLowerCase();
  if (value === "high") {
    return "High";
  }
  if (value === "low") {
    return "Low";
  }
  return "Medium";
}

function toUiGoal(goal: ApiGoal): Goal {
  const category = normalizeCategory(goal.category);
  return {
    id: goal.id,
    title: goal.title,
    category,
    priority: normalizePriority(goal.priority),
    deadline: `${goal.duration_weeks} week${goal.duration_weeks === 1 ? "" : "s"}`,
    progress: goal.progress,
    color: categoryColors[category],
    hoursPerWeek: goal.hours_per_week,
    durationWeeks: goal.duration_weeks,
    loggedHours: goal.logged_hours,
    createdAt: goal.created_at,
  };
}

export default function App() {
  const [activePage, setActivePage] = useState<NavItem>("Dashboard");
  const [search, setSearch] = useState("");
  const [goalItems, setGoalItems] = useState<Goal[]>([]);
  const [refreshingGoals, setRefreshingGoals] = useState(false);
  const [completionStreakDays, setCompletionStreakDays] = useState(0);
  const [totalCompletedGoals, setTotalCompletedGoals] = useState(0);

  function getCurrentUserId(): string {
    return typeof window === "undefined" ? "demo" : window.localStorage.getItem(USER_ID_KEY) || "demo";
  }

  async function fetchGoalsForCurrentUser(): Promise<Goal[]> {
    const userId = getCurrentUserId();
    const response = await fetch(`${API_ROOT}/goals?user_id=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch goals.");
    }
    const payload = (await response.json()) as ApiGoal[];
    return payload.map(toUiGoal);
  }

  async function fetchCompletionStreakForCurrentUser(): Promise<void> {
    const userId = getCurrentUserId();
    const response = await fetch(`${API_ROOT}/goals-completion-streak?user_id=${encodeURIComponent(userId)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch goal streak.");
    }

    const payload = (await response.json()) as ApiGoalStreak;
    setCompletionStreakDays(payload.streak_days);
    setTotalCompletedGoals(payload.total_completed_goals);
  }

  useEffect(() => {
    let mounted = true;

    async function loadGoals(): Promise<void> {
      const [goalsResult, streakResult] = await Promise.allSettled([
        fetchGoalsForCurrentUser(),
        fetchCompletionStreakForCurrentUser(),
      ]);

      if (!mounted) {
        return;
      }

      if (goalsResult.status === "fulfilled") {
        setGoalItems(goalsResult.value);
      } else {
        setGoalItems([]);
      }

      if (streakResult.status === "rejected") {
        setCompletionStreakDays(0);
        setTotalCompletedGoals(0);
      }
    }

    void loadGoals().catch(() => {
      if (mounted) {
        setGoalItems([]);
        setCompletionStreakDays(0);
        setTotalCompletedGoals(0);
      }
    });

    return () => {
      mounted = false;
    };
  }, [activePage]);

  async function handleRefreshDashboard(): Promise<void> {
    setRefreshingGoals(true);

    try {
      const [goalsResult, streakResult] = await Promise.allSettled([
        fetchGoalsForCurrentUser(),
        fetchCompletionStreakForCurrentUser(),
      ]);

      if (goalsResult.status === "fulfilled") {
        setGoalItems(goalsResult.value);
      } else {
        setGoalItems([]);
      }

      if (streakResult.status === "rejected") {
        setCompletionStreakDays(0);
        setTotalCompletedGoals(0);
      }
    } catch {
      setGoalItems([]);
      setCompletionStreakDays(0);
      setTotalCompletedGoals(0);
    } finally {
      setRefreshingGoals(false);
    }
  }

  function handleGoalsChanged(nextGoals: Goal[]): void {
    setGoalItems(nextGoals);
    void fetchCompletionStreakForCurrentUser().catch(() => {
      setCompletionStreakDays(0);
      setTotalCompletedGoals(0);
    });
  }

  const pages: Record<NavItem, ReactNode> = {
    Dashboard: <DashboardPage goalItems={goalItems} />,
    Planner: <PlannerPage />,
    Goals: <GoalsPage onGoalsChanged={handleGoalsChanged} />,
    Insights: <InsightsPage goalItems={goalItems} />,
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
            {goalItems
              .filter((g) => g.priority === "High")
              .filter((g) => g.title.toLowerCase().includes(search.toLowerCase()))
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
            <p className="text-2xl font-bold text-blue-600">{completionStreakDays} {completionStreakDays === 1 ? "day" : "days"}</p>
            <p className="text-[10px] text-slate-400">
              {totalCompletedGoals > 0 ? `${totalCompletedGoals} goals completed` : "Complete a goal to start streak"}
            </p>
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
              <button
                type="button"
                onClick={() => {
                  void handleRefreshDashboard();
                }}
                disabled={refreshingGoals}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              >
                {refreshingGoals ? "Refreshing..." : "⚡ Re-optimize"}
              </button>
            )}
          </div>
          {currentPage}
        </main>
      </div>
    </div>
  );
}
