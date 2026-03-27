import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import type { Goal } from "./types";
import { Card, SectionTitle } from "./ui";

type ProgressInsightItem = {
  icon: string;
  type: "warning" | "success" | "info";
  text: string;
};

type ProgressInsightsResponse = {
  summary: string;
  source: string;
  insights: ProgressInsightItem[];
};

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
const API_ROOT = RAW_API_BASE.endsWith("/api") ? RAW_API_BASE : `${RAW_API_BASE}/api`;
const USER_ID_KEY = "lifeos_user_id";

type TimePeriod = "daily" | "weekly" | "monthly";

type GoalContribution = {
  id: number;
  title: string;
  category: string;
  progress: number;
  contribution: number;
  color: string;
};

type PeriodData = {
  daily: GoalContribution[];
  weekly: GoalContribution[];
  monthly: GoalContribution[];
};

// Calculate contribution data based on actual logged hours
const generatePeriodData = (goalItems: Goal[]): PeriodData => {
  const toContribution = (items: Goal[], weightSelector: (goal: Goal) => number): GoalContribution[] => {
    const totalWeight = items.reduce((sum, goal) => sum + Math.max(weightSelector(goal), 0), 0);

    return items.map((goal) => {
      const weight = Math.max(weightSelector(goal), 0);
      return {
        id: goal.id,
        title: goal.title,
        category: goal.category,
        progress: goal.progress,
        contribution: totalWeight > 0 ? (weight / totalWeight) * 100 : 0,
        color: goal.color,
      };
    });
  };

  const getDailyContribution = (): GoalContribution[] => {
    return toContribution(goalItems, (goal) => goal.loggedHours);
  };

  const getWeeklyContribution = (): GoalContribution[] => {
    return toContribution(goalItems, (goal) => goal.hoursPerWeek);
  };

  const getMonthlyContribution = (): GoalContribution[] => {
    return toContribution(goalItems, (goal) => goal.hoursPerWeek * goal.durationWeeks);
  };

  return {
    daily: getDailyContribution(),
    weekly: getWeeklyContribution(),
    monthly: getMonthlyContribution(),
  };
};

function OverallProgressSection({ timePeriod, data }: { timePeriod: TimePeriod; data: GoalContribution[] }) {
  const overallProgress = data.length > 0 ? Math.round(data.reduce((sum, g) => sum + g.progress, 0) / data.length) : 0;

  return (
    <Card>
      <SectionTitle sub={`Overall progress for ${timePeriod} view`}>Overall Goal Progress</SectionTitle>
      <div className="flex items-center gap-8">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="8"
              strokeDasharray={`${(overallProgress / 100) * 314.159} 314.159`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-slate-800">{overallProgress}%</p>
            <p className="text-xs text-slate-500">Complete</p>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <p className="text-sm text-slate-600 mb-2">
              You've made excellent progress across all your goals this {timePeriod}! Your average completion rate stands at <span className="font-bold text-slate-800">{overallProgress}%</span>.
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Performance by Category:</p>
            <div className="grid grid-cols-2 gap-2">
              {["Fitness", "Academics", "Finance", "Personal"].map(cat => {
                const categoryGoals = data.filter(g => g.category === cat);
                const avgProgress = categoryGoals.length ? Math.round(categoryGoals.reduce((sum, g) => sum + g.progress, 0) / categoryGoals.length) : 0;
                return (
                  <div key={cat} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{cat}</span>
                    <span className="font-semibold text-slate-800">{avgProgress}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function GoalContributionChart({ data }: { data: GoalContribution[] }) {
  const chartData = data.map(g => ({
    name: g.title.substring(0, 15),
    contribution: Math.round(g.contribution * 10) / 10,
    color: g.color,
  }));

  return (
    <Card>
      <SectionTitle sub="Percentage contribution to overall progress">Goal Contribution Breakdown</SectionTitle>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
          />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} label={{ value: "%", angle: -90, position: "insideLeft" }} />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              fontSize: 11,
            }}
            formatter={(value: any) => `${value}%`}
          />
          <Bar dataKey="contribution" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function GoalContributionPie({ data }: { data: GoalContribution[] }) {
  const chartData = data.map(g => ({
    name: g.title.substring(0, 20),
    value: Math.round(g.contribution * 10) / 10,
    color: g.color,
  }));

  return (
    <Card>
      <SectionTitle sub="Share of total progress">Contribution Distribution</SectionTitle>
      <div className="flex items-center gap-6 justify-center">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={chartData}
              cx={70}
              cy={70}
              innerRadius={40}
              outerRadius={65}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any) => `${value}%`}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
        {chartData.map((entry, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
              <span className="text-slate-600 truncate">{entry.name}</span>
            </div>
            <span className="font-semibold text-slate-800">{entry.value}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DetailedContributionTable({ data, timePeriod }: { data: GoalContribution[]; timePeriod: TimePeriod }) {
  const sorted = [...data].sort((a, b) => b.progress - a.progress);

  return (
    <Card>
      <SectionTitle sub={`Detailed breakdown for ${timePeriod} period`}>Contribution Details</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left p-2 text-slate-600 font-medium">Goal</th>
              <th className="text-center p-2 text-slate-600 font-medium">Category</th>
              <th className="text-center p-2 text-slate-600 font-medium">Progress</th>
              <th className="text-center p-2 text-slate-600 font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((goal, i) => (
              <tr key={goal.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2 h-2 rounded-full flex-shrink-0" 
                      style={{ background: goal.color }}
                    />
                    <span className="text-slate-700 truncate">{goal.title}</span>
                  </div>
                </td>
                <td className="p-2 text-center text-slate-600">{goal.category}</td>
                <td className="p-2">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${goal.progress}%`,
                          background: goal.color,
                        }}
                      />
                    </div>
                    <span className="font-semibold text-slate-800 w-8 text-right">{goal.progress}%</span>
                  </div>
                </td>
                <td className="p-2 text-center">
                  <span className="inline-block px-2.5 py-1 rounded-lg font-semibold text-slate-800" style={{ background: `${goal.color}15` }}>
                    {Math.round(goal.contribution * 10) / 10}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SmartProgressInsightsCard({
  loading,
  error,
  summary,
  source,
  items,
}: {
  loading: boolean;
  error: string | null;
  summary: string;
  source: string;
  items: ProgressInsightItem[];
}) {
  const colorMap: Record<ProgressInsightItem["type"], string> = {
    warning: "border-amber-200 bg-amber-50",
    success: "border-emerald-200 bg-emerald-50",
    info: "border-blue-100 bg-blue-50",
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <SectionTitle sub="Generated from goal progress and planner intelligence">Smart Insights</SectionTitle>
        <span className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{source}</span>
      </div>
      {loading && <p className="text-xs text-slate-500">Generating insights...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!loading && !error && <p className="text-xs text-slate-600 mb-2">{summary}</p>}
      <div className="flex flex-col gap-2">
        {!loading && !error && items.length === 0 && <p className="text-xs text-slate-400">No insights available yet.</p>}
        {items.map((ins, i) => (
          <div key={`${ins.type}-${i}`} className={`rounded-xl border p-3 flex gap-2.5 items-start ${colorMap[ins.type]}`}>
            <span className="text-base mt-0.5">{ins.icon}</span>
            <p className="text-xs text-slate-700 leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function InsightsPage({ goalItems = [] }: { goalItems?: Goal[] }) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("daily");
  const [insightsSummary, setInsightsSummary] = useState("Loading progress insights...");
  const [insightsSource, setInsightsSource] = useState("pending");
  const [smartInsights, setSmartInsights] = useState<ProgressInsightItem[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const periodData = useMemo(() => generatePeriodData(goalItems), [goalItems]);
  const currentData = periodData[timePeriod];

  useEffect(() => {
    let mounted = true;

    async function loadProgressInsights(): Promise<void> {
      const userId = typeof window === "undefined" ? "demo" : window.localStorage.getItem(USER_ID_KEY) || "demo";
      setInsightsLoading(true);
      setInsightsError(null);

      try {
        const response = await fetch(`${API_ROOT}/insights/progress?user_id=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          throw new Error("Failed to fetch smart insights from backend.");
        }

        const payload = (await response.json()) as ProgressInsightsResponse;
        if (!mounted) {
          return;
        }

        setInsightsSummary(payload.summary);
        setInsightsSource(payload.source);
        setSmartInsights(payload.insights || []);
      } catch (err) {
        if (!mounted) {
          return;
        }

        setInsightsError(err instanceof Error ? err.message : "Unable to load smart insights.");
        setInsightsSource("fallback");
        setInsightsSummary("Showing local progress summary while backend insight generation is unavailable.");
        setSmartInsights([
          {
            icon: "💡",
            type: "info",
            text: `You currently have ${goalItems.length} goals in your active progress view.`,
          },
        ]);
      } finally {
        if (mounted) {
          setInsightsLoading(false);
        }
      }
    }

    void loadProgressInsights();

    return () => {
      mounted = false;
    };
  }, [goalItems]);

  return (
    <div className="space-y-4">
      {/* Time Period Filter */}
      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle>Time Period Analysis</SectionTitle>
          <div className="flex gap-2">
            {["daily", "weekly", "monthly"].map((period) => (
              <button
                key={period}
                onClick={() => setTimePeriod(period as TimePeriod)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  timePeriod === period
                    ? "bg-blue-500 text-white shadow-lg"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Overall Progress */}
      <OverallProgressSection timePeriod={timePeriod} data={currentData} />

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-4">
        <GoalContributionChart data={currentData} />
        <GoalContributionPie data={currentData} />
      </div>

      {/* Detailed Table */}
      <DetailedContributionTable data={currentData} timePeriod={timePeriod} />

      {/* Smart Insights */}
      <SmartProgressInsightsCard
        loading={insightsLoading}
        error={insightsError}
        summary={insightsSummary}
        source={insightsSource}
        items={smartInsights}
      />
    </div>
  );
}