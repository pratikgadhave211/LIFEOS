import { useEffect, useMemo, useState } from "react";

import { categoryColors } from "./data";
import type { GoalCategory } from "./types";
import { Card, SectionTitle } from "./ui";

type ApiGoal = {
  id: number;
  title: string;
  category: string;
  priority: string;
  status: string;
  progress: number;
};

type ApiPlanBlock = {
  start_time: string;
  end_time: string;
  goal_id: number | null;
  title: string;
  reason: string;
  confidence: number;
};

type ApiPlanResponse = {
  date: string;
  summary: string;
  blocks: ApiPlanBlock[];
  sources: string[];
};

type BlockedRange = {
  start_hour: number;
  end_hour: number;
};

type UiBlock = {
  id: string;
  startMinute: number;
  endMinute: number;
  title: string;
  reason: string;
  confidence: number;
  category: GoalCategory;
};

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const API_ROOT = RAW_API_BASE.endsWith("/api") ? RAW_API_BASE : `${RAW_API_BASE}/api`;
const USER_ID_KEY = "lifeos_user_id";
const ROW_HEIGHT = 40;

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

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return 0;
  }
  return h * 60 + m;
}

function hasOverlap(blocks: UiBlock[]): boolean {
  if (blocks.length <= 1) {
    return false;
  }

  const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].startMinute < sorted[i - 1].endMinute) {
      return true;
    }
  }
  return false;
}

export default function PlannerPage() {
  const [userId, setUserId] = useState(() => {
    if (typeof window === "undefined") {
      return "demo";
    }
    return window.localStorage.getItem(USER_ID_KEY) || "demo";
  });
  const [availableHours, setAvailableHours] = useState(7);
  const [startHour, setStartHour] = useState(6);
  const [endHour, setEndHour] = useState(22);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [useLlm, setUseLlm] = useState(true);
  const [blockedStart, setBlockedStart] = useState(13);
  const [blockedEnd, setBlockedEnd] = useState(14);

  const [goals, setGoals] = useState<ApiGoal[]>([]);
  const [planBlocks, setPlanBlocks] = useState<ApiPlanBlock[]>([]);
  const [planSummary, setPlanSummary] = useState("No plan generated yet.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goalMap = useMemo(() => {
    const map = new Map<number, ApiGoal>();
    goals.forEach((goal) => map.set(goal.id, goal));
    return map;
  }, [goals]);

  const uiBlocks = useMemo<UiBlock[]>(() => {
    return planBlocks
      .map((block, index) => {
        const goal = block.goal_id ? goalMap.get(block.goal_id) : undefined;
        return {
          id: `${block.start_time}-${block.end_time}-${index}`,
          startMinute: toMinutes(block.start_time),
          endMinute: toMinutes(block.end_time),
          title: block.title,
          reason: block.reason,
          confidence: block.confidence,
          category: normalizeCategory(goal?.category || "personal"),
        };
      })
      .sort((a, b) => a.startMinute - b.startMinute);
  }, [goalMap, planBlocks]);

  const unscheduledGoals = useMemo(() => {
    const plannedGoalIds = new Set(
      planBlocks
        .map((block) => block.goal_id)
        .filter((value): value is number => typeof value === "number")
    );

    return goals.filter((goal) => goal.status !== "completed" && !plannedGoalIds.has(goal.id));
  }, [goals, planBlocks]);

  const conflictDetected = useMemo(() => hasOverlap(uiBlocks), [uiBlocks]);

  const hourLabels = useMemo(() => {
    const start = Math.max(0, Math.min(23, startHour));
    const end = Math.max(start + 1, Math.min(24, endHour));
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [endHour, startHour]);

  const scheduleMinHeight = Math.max((hourLabels.length - 1) * ROW_HEIGHT + 20, 360);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_ID_KEY, userId);
    }
  }, [userId]);

  async function fetchGoals(currentUserId: string): Promise<ApiGoal[]> {
    const response = await fetch(`${API_ROOT}/goals?user_id=${encodeURIComponent(currentUserId)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch goals from backend.");
    }
    const payload = (await response.json()) as ApiGoal[];
    setGoals(payload);
    return payload;
  }

  async function fetchTodayPlan(currentUserId: string): Promise<void> {
    const response = await fetch(`${API_ROOT}/planner/today?user_id=${encodeURIComponent(currentUserId)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch today's plan.");
    }
    const payload = (await response.json()) as ApiPlanBlock[];
    setPlanBlocks(payload);
    if (payload.length > 0) {
      setPlanSummary("Loaded today's generated plan from backend.");
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchGoals(userId), fetchTodayPlan(userId)]);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load planner data.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [userId]);

  async function handleGeneratePlan(): Promise<void> {
    setLoading(true);
    setError(null);

    const safeStart = Math.max(0, Math.min(23, startHour));
    const safeEnd = Math.max(safeStart + 1, Math.min(24, endHour));
    const safeBlockedStart = Math.max(safeStart, Math.min(safeEnd - 1, blockedStart));
    const safeBlockedEnd = Math.max(safeBlockedStart + 1, Math.min(safeEnd, blockedEnd));

    const blockedRanges: BlockedRange[] = [
      {
        start_hour: safeBlockedStart,
        end_hour: safeBlockedEnd,
      },
    ];

    try {
      const response = await fetch(`${API_ROOT}/planner/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          available_hours: availableHours,
          start_hour: safeStart,
          end_hour: safeEnd,
          session_minutes: sessionMinutes,
          break_minutes: breakMinutes,
          blocked_ranges: blockedRanges,
          use_llm: useLlm,
        }),
      });

      if (!response.ok) {
        throw new Error("Planner generation failed. Check backend logs and env config.");
      }

      const payload = (await response.json()) as ApiPlanResponse;
      setPlanBlocks(payload.blocks || []);

      const latestGoals = await fetchGoals(userId);
      const activeGoalCount = latestGoals.filter((goal) => goal.status !== "completed" && goal.progress < 100).length;

      if ((payload.blocks || []).length === 0 && activeGoalCount === 0) {
        setPlanSummary("No active goals found for this user. Add goals in Goals page using the same User ID, then generate.");
      } else if ((payload.blocks || []).length > 0 && activeGoalCount === 1) {
        setPlanSummary(`${payload.summary || "Plan generated."} Only one active goal found, so all blocks use that goal name.`);
      } else {
        setPlanSummary(payload.summary || "Plan generated.");
      }
    } catch (err) {
      if (err instanceof TypeError) {
        setError("Could not reach planner API. Start backend server and verify VITE_API_BASE_URL or Vite proxy.");
      } else {
        setError(err instanceof Error ? err.message : "Plan generation failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="col-span-2">
        <SectionTitle sub="Generated from backend planner API">Daily Schedule</SectionTitle>
        <div className="relative mt-2" style={{ minHeight: scheduleMinHeight }}>
          {hourLabels.map((h) => (
            <div key={h} className="flex items-start gap-3 border-t border-slate-50 py-1" style={{ height: ROW_HEIGHT }}>
              <span className="text-xs text-slate-300 w-12 pt-0.5 flex-shrink-0">{h}:00</span>
              <div className="flex-1 relative" />
            </div>
          ))}

          {uiBlocks.map((block) => (
            <div
              key={block.id}
              className="absolute left-16 right-2 rounded-xl px-3 py-1.5 transition-all"
              style={{
                top: ((block.startMinute - startHour * 60) / 60) * ROW_HEIGHT + 4,
                height: ((block.endMinute - block.startMinute) / 60) * ROW_HEIGHT - 4,
                background: `${categoryColors[block.category]}22`,
                borderLeft: `3px solid ${categoryColors[block.category]}`,
              }}
            >
              <p className="text-xs font-semibold" style={{ color: categoryColors[block.category] }}>
                {block.title}
              </p>
            </div>
          ))}

          {!loading && uiBlocks.length === 0 && (
            <div className="absolute left-16 right-2 top-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">
                {goals.length === 0
                  ? "No goals found for this user. Add goals in Goals page with the same User ID, then generate plan."
                  : "No plan blocks found for today. Generate a plan from the panel on the right."}
              </p>
            </div>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle sub="Configure and generate from FastAPI">AI Planner Controls</SectionTitle>
          <div className="flex flex-col gap-2.5">
            <label className="text-xs text-slate-500">
              User ID
              <input
                className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-500">
              Available Hours
              <input
                type="number"
                min={1}
                max={16}
                className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                value={availableHours}
                onChange={(e) => setAvailableHours(Number(e.target.value) || 1)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                Start Hour
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                  value={startHour}
                  onChange={(e) => setStartHour(Number(e.target.value) || 0)}
                />
              </label>
              <label className="text-xs text-slate-500">
                End Hour
                <input
                  type="number"
                  min={1}
                  max={24}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                  value={endHour}
                  onChange={(e) => setEndHour(Number(e.target.value) || 24)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                Session (min)
                <input
                  type="number"
                  min={15}
                  max={180}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(Number(e.target.value) || 60)}
                />
              </label>
              <label className="text-xs text-slate-500">
                Break (min)
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                  value={breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value) || 0)}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-500">
                Block Start
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                  value={blockedStart}
                  onChange={(e) => setBlockedStart(Number(e.target.value) || 0)}
                />
              </label>
              <label className="text-xs text-slate-500">
                Block End
                <input
                  type="number"
                  min={1}
                  max={24}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                  value={blockedEnd}
                  onChange={(e) => setBlockedEnd(Number(e.target.value) || 1)}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} />
              Enable LLM rebalancing
            </label>
            <button
              onClick={() => void handleGeneratePlan()}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
            >
              {loading ? "Generating..." : "Generate AI Plan"}
            </button>
            <p className="text-[11px] text-slate-500">{planSummary}</p>
            {error && <p className="text-[11px] text-red-600">{error}</p>}
          </div>
        </Card>

        <Card>
          <SectionTitle sub="Goals not allocated in today's plan">Unscheduled Goals</SectionTitle>
          {unscheduledGoals.length === 0 && <p className="text-xs text-slate-400">All active goals are scheduled.</p>}
          {unscheduledGoals.map((goal) => (
            <div key={goal.id} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
              <span className="text-slate-300">⊕</span>
              <span className="text-xs text-slate-600 truncate">{goal.title}</span>
            </div>
          ))}
        </Card>

        <Card>
          <SectionTitle>Conflict Alert</SectionTitle>
          <div className={`rounded-xl p-3 border ${conflictDetected ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
            <p className={`text-xs font-medium mb-1 ${conflictDetected ? "text-red-700" : "text-emerald-700"}`}>
              {conflictDetected ? "⚠ Overlap detected" : "✓ No overlaps found"}
            </p>
            <p className="text-xs text-slate-600">
              {conflictDetected
                ? "Generated blocks overlap. Re-run planner with different settings or blocked ranges."
                : "Current generated plan has no time conflicts."}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
