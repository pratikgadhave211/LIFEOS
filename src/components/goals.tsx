import { useEffect, useState, type FormEvent } from "react";
import { categoryColors, priorityBadge } from "./data";
import type { Goal, GoalCategory, GoalForm, GoalPriority } from "./types";
import { Card, SectionTitle } from "./ui";

type ApiGoal = {
  id: number;
  user_id: string;
  title: string;
  category: string;
  priority: string;
  hours_per_week: number;
  duration_weeks: number;
  logged_hours: number;
  progress: number;
  status: string;
  created_at: string;
};

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const API_ROOT = RAW_API_BASE.endsWith("/api") ? RAW_API_BASE : `${RAW_API_BASE}/api`;
const USER_ID_KEY = "lifeos_user_id";

type GoalsListProps = {
  goalItems: Goal[];
};

type GoalsPageProps = {
  onGoalsChanged?: (goalItems: Goal[]) => void;
};

type DailyHoursByGoal = Record<number, string>;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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
    currentStreak: 0,
    bestStreak: 0,
    lastLoggedDate: null,
  };
}

function getTargetHours(goal: Goal) {
  return goal.hoursPerWeek * goal.durationWeeks;
}

function getRemainingHours(goal: Goal) {
  return Math.max(getTargetHours(goal) - goal.loggedHours, 0);
}

function getRemainingDays(goal: Goal) {
  const totalDays = Math.max(goal.durationWeeks * 7, 1);
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(goal.createdAt).getTime()) / DAY_IN_MS));
  return Math.max(totalDays - elapsedDays, 1);
}

function getRequiredDailyHours(goal: Goal) {
  return getRemainingHours(goal) / getRemainingDays(goal);
}

function getExpectedHoursByNow(goal: Goal) {
  const totalDays = Math.max(goal.durationWeeks * 7, 1);
  const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(goal.createdAt).getTime()) / DAY_IN_MS));
  const cappedElapsed = Math.min(elapsedDays, totalDays);
  return (cappedElapsed / totalDays) * getTargetHours(goal);
}

type DailyGoalProgressProps = {
  goalItems: Goal[];
  dailyHours: DailyHoursByGoal;
  onDailyHoursChange: (goalId: number, value: string) => void;
  onLogHours: (goalId: number) => void;
  busy: boolean;
};

function DailyGoalProgress({ goalItems, dailyHours, onDailyHoursChange, onLogHours, busy }: DailyGoalProgressProps) {
  return (
    <Card>
      <SectionTitle sub="Log today's effort and auto-update completion">Daily Goal Progress</SectionTitle>
      <div className="flex flex-col gap-3">
        {goalItems.length === 0 && <p className="text-xs text-slate-400">All goals are completed. Add a new goal to continue tracking.</p>}
        {goalItems.map((goal) => {
          const targetHours = getTargetHours(goal);
          const remainingHours = getRemainingHours(goal);
          const requiredDailyHours = getRequiredDailyHours(goal);
          const onTrack = goal.loggedHours >= getExpectedHoursByNow(goal);

          return (
            <div key={goal.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-slate-800 truncate">{goal.title}</span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ml-auto ${
                    onTrack
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {onTrack ? "On Track" : "Needs Catch-up"}
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-2">
                Planned: {goal.hoursPerWeek}h/week x {goal.durationWeeks} weeks = {targetHours.toFixed(1)}h total
              </p>
              <p className="text-xs text-slate-500 mb-2">
                Done: {goal.loggedHours.toFixed(1)}h | Remaining: {remainingHours.toFixed(1)}h | Needed/day: {requiredDailyHours.toFixed(2)}h
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  className="w-28 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
                  placeholder="Hours today"
                  value={dailyHours[goal.id] || ""}
                  onChange={(e) => onDailyHoursChange(goal.id, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => onLogHours(goal.id)}
                  disabled={busy}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  Log Daily Update
                </button>
                <span className="text-xs text-slate-400 ml-auto">Progress: {goal.progress}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function GoalsList({ goalItems }: GoalsListProps) {
  return (
    <Card>
      <SectionTitle sub="Active goals with progress">Current Goals</SectionTitle>
      <div className="flex flex-col gap-2">
        {goalItems.length === 0 && <p className="text-xs text-slate-400">No active goals right now.</p>}
        {goalItems.map((g) => (
          <div
            key={g.id}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: categoryColors[g.category] }}
            >
              {g.category[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-800 truncate">{g.title}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${priorityBadge[g.priority]}`}>
                  {g.priority}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${g.progress}%`, background: categoryColors[g.category] }}
                  />
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{g.progress}%</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-slate-400">{g.deadline}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

type CompletedGoalsProps = {
  goalItems: Goal[];
};

type ManageGoalsProps = {
  goalItems: Goal[];
  editingGoalId: number | null;
  editForm: GoalForm;
  onStartEdit: (goal: Goal) => void;
  onCancelEdit: () => void;
  onEditFormChange: (patch: Partial<GoalForm>) => void;
  onSaveEdit: (goalId: number) => void;
  onDeleteGoal: (goalId: number) => void;
  busy: boolean;
};

function CompletedGoals({ goalItems }: CompletedGoalsProps) {
  return (
    <Card>
      <SectionTitle sub="Auto-moved after 100% completion">Completed Goals</SectionTitle>
      <div className="flex flex-col gap-2">
        {goalItems.length === 0 && <p className="text-xs text-slate-400">No completed goals yet.</p>}
        {goalItems.map((g) => (
          <div key={g.id} className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-700 truncate">{g.title}</span>
              <span className="text-[10px] font-semibold text-emerald-700 ml-auto">100%</span>
            </div>
            <p className="text-[10px] text-emerald-600 mt-0.5">Completed target: {getTargetHours(g).toFixed(1)}h</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ManageGoals({
  goalItems,
  editingGoalId,
  editForm,
  onStartEdit,
  onCancelEdit,
  onEditFormChange,
  onSaveEdit,
  onDeleteGoal,
  busy,
}: ManageGoalsProps) {
  return (
    <Card>
      <SectionTitle sub="Edit or delete active goals">Manage Goals</SectionTitle>
      <div className="flex flex-col gap-2">
        {goalItems.length === 0 && <p className="text-xs text-slate-400">No active goals to manage.</p>}
        {goalItems.map((goal) => {
          const isEditing = editingGoalId === goal.id;

          if (isEditing) {
            return (
              <div key={goal.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-500 col-span-2">
                    Title
                    <input
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                      value={editForm.title}
                      onChange={(e) => onEditFormChange({ title: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Category
                    <select
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                      value={editForm.category}
                      onChange={(e) => onEditFormChange({ category: e.target.value as GoalCategory })}
                    >
                      {["Fitness", "Academics", "Finance", "Personal"].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    Priority
                    <select
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                      value={editForm.priority}
                      onChange={(e) => onEditFormChange({ priority: e.target.value as GoalPriority })}
                    >
                      {["Low", "Medium", "High"].map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    Hours/Week
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                      value={editForm.hoursPerWeek}
                      onChange={(e) => onEditFormChange({ hoursPerWeek: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Deadline (Weeks)
                    <input
                      type="number"
                      min="1"
                      className="mt-1 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700"
                      value={editForm.durationWeeks}
                      onChange={(e) => onEditFormChange({ durationWeeks: e.target.value })}
                    />
                  </label>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSaveEdit(goal.id)}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onCancelEdit}
                    className="bg-slate-200 hover:bg-slate-300 disabled:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={goal.id} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2.5">
              <span className="text-xs text-slate-700 truncate flex-1">{goal.title}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onStartEdit(goal)}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800 disabled:text-blue-300"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDeleteGoal(goal.id)}
                className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:text-red-300"
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function GoalsPage({ onGoalsChanged }: GoalsPageProps) {
  const [userId, setUserId] = useState(() => {
    if (typeof window === "undefined") {
      return "demo";
    }
    return window.localStorage.getItem(USER_ID_KEY) || "demo";
  });
  const [goalItems, setGoalItems] = useState<Goal[]>([]);
  const [form, setForm] = useState<GoalForm>({
    title: "",
    category: "Fitness",
    priority: "Medium",
    hoursPerWeek: "6",
    durationWeeks: "2",
  });
  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<GoalForm>({
    title: "",
    category: "Fitness",
    priority: "Medium",
    hoursPerWeek: "6",
    durationWeeks: "2",
  });
  const [dailyHours, setDailyHours] = useState<DailyHoursByGoal>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(USER_ID_KEY, userId);
    }
  }, [userId]);

  async function fetchGoals(currentUserId: string): Promise<void> {
    const response = await fetch(`${API_ROOT}/goals?user_id=${encodeURIComponent(currentUserId)}`);
    if (!response.ok) {
      throw new Error("Failed to fetch goals from backend.");
    }
    const payload = (await response.json()) as ApiGoal[];
    const mapped = payload.map(toUiGoal);
    setGoalItems(mapped);
    onGoalsChanged?.(mapped);
  }

  useEffect(() => {
    let mounted = true;

    async function loadGoals(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        await fetchGoals(userId);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load goals.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadGoals();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const activeGoals = goalItems.filter((goal) => goal.progress < 100);
  const completedGoals = goalItems.filter((goal) => goal.progress >= 100);

  const handleAddGoal = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const title = form.title.trim();
    const hoursPerWeek = Number(form.hoursPerWeek);
    const durationWeeks = Number(form.durationWeeks);

    if (!title || !Number.isFinite(hoursPerWeek) || !Number.isFinite(durationWeeks) || hoursPerWeek <= 0 || durationWeeks <= 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_ROOT}/goals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          title,
          category: form.category,
          priority: form.priority,
          hours_per_week: hoursPerWeek,
          duration_weeks: durationWeeks,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create goal in backend.");
      }

      await fetchGoals(userId);
      setForm({
        title: "",
        category: "Fitness",
        priority: "Medium",
        hoursPerWeek: "6",
        durationWeeks: "2",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogDailyHours = async (goalId: number) => {
    const hours = Number(dailyHours[goalId]);
    if (!Number.isFinite(hours) || hours <= 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_ROOT}/goals/${goalId}/log-hours`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hours_logged: hours,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to log daily hours in backend.");
      }

      await fetchGoals(userId);
      setDailyHours((prev) => ({ ...prev, [goalId]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log daily hours.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEdit = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setEditForm({
      title: goal.title,
      category: goal.category,
      priority: goal.priority,
      hoursPerWeek: String(goal.hoursPerWeek),
      durationWeeks: String(goal.durationWeeks),
    });
  };

  const handleCancelEdit = () => {
    setEditingGoalId(null);
  };

  const handleSaveEdit = async (goalId: number) => {
    const title = editForm.title.trim();
    const hoursPerWeek = Number(editForm.hoursPerWeek);
    const durationWeeks = Number(editForm.durationWeeks);

    if (!title || !Number.isFinite(hoursPerWeek) || !Number.isFinite(durationWeeks) || hoursPerWeek <= 0 || durationWeeks <= 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_ROOT}/goals/${goalId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          title,
          category: editForm.category,
          priority: editForm.priority,
          hours_per_week: hoursPerWeek,
          duration_weeks: durationWeeks,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update goal.");
      }

      await fetchGoals(userId);
      setEditingGoalId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update goal.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goalId: number) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete this goal?");
      if (!ok) {
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${API_ROOT}/goals/${goalId}?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete goal.");
      }

      await fetchGoals(userId);
      if (editingGoalId === goalId) {
        setEditingGoalId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete goal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <SectionTitle sub="Add a new goal">Create Goal</SectionTitle>
        <form className="flex flex-col gap-3" onSubmit={handleAddGoal}>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">User ID (must match Planner page)</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Title</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
              placeholder="e.g. Run 5km daily"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Category</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as GoalCategory })}
            >
              {["Fitness", "Academics", "Finance", "Personal"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Priority</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as GoalPriority })}
            >
              {["Low", "Medium", "High"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Target Hours Per Week</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
              value={form.hoursPerWeek}
              onChange={(e) => setForm({ ...form, hoursPerWeek: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Deadline (Weeks)</label>
            <input
              type="number"
              min="1"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
              placeholder="e.g. 2"
              value={form.durationWeeks}
              onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })}
            />
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors mt-1">
            {submitting ? "Saving..." : "+ Add Goal"}
          </button>
          {loading && <p className="text-[11px] text-slate-500">Loading goals from backend...</p>}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </form>
      </Card>
      <div className="col-span-2 grid grid-cols-3 gap-4 items-start">
        <div className="col-span-2">
          <GoalsList goalItems={activeGoals} />
        </div>
        <div className="col-span-1">
          <CompletedGoals goalItems={completedGoals} />
        </div>
        <div className="col-span-3">
          <ManageGoals
            goalItems={activeGoals}
            editingGoalId={editingGoalId}
            editForm={editForm}
            onStartEdit={handleStartEdit}
            onCancelEdit={handleCancelEdit}
            onEditFormChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
            onSaveEdit={handleSaveEdit}
            onDeleteGoal={handleDeleteGoal}
            busy={submitting}
          />
        </div>
        <div className="col-span-3">
          <DailyGoalProgress
            goalItems={activeGoals}
            dailyHours={dailyHours}
            onDailyHoursChange={(goalId, value) => setDailyHours((prev) => ({ ...prev, [goalId]: value }))}
            onLogHours={handleLogDailyHours}
            busy={submitting}
          />
        </div>
      </div>
    </div>
  );
}
