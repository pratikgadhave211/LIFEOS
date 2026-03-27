import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { insightColors, insights } from "./data";
import type { InsightType, Goal } from "./types";
import { Card, SectionTitle } from "./ui";

// Helper function to generate dynamic data from goalItems
const generateDashboardData = (goalItems: Goal[]) => {
  // Calculate category-based progress
  const categoryProgress: Record<string, number[]> = {
    fitness: [],
    academics: [],
    finance: [],
    personal: [],
  };

  goalItems.forEach((goal) => {
    const category = goal.category.toLowerCase() as keyof typeof categoryProgress;
    if (categoryProgress[category]) {
      categoryProgress[category].push(goal.progress);
    }
  });

  const categoryAverages = {
    fitness: Math.round(categoryProgress.fitness.reduce((a, b) => a + b, 0) / Math.max(1, categoryProgress.fitness.length)),
    academics: Math.round(categoryProgress.academics.reduce((a, b) => a + b, 0) / Math.max(1, categoryProgress.academics.length)),
    finance: Math.round(categoryProgress.finance.reduce((a, b) => a + b, 0) / Math.max(1, categoryProgress.finance.length)),
    personal: Math.round(categoryProgress.personal.reduce((a, b) => a + b, 0) / Math.max(1, categoryProgress.personal.length)),
  };

  // Build a 7-day consistency curve anchored to actual category averages.
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayFactors = [0.86, 0.9, 0.94, 0.98, 1.0, 1.03, 1.05];
  const consistencyData = dayLabels.map((day, index) => ({
    day,
    fitness: Math.max(0, Math.min(100, Math.round(categoryAverages.fitness * dayFactors[index]))),
    academics: Math.max(0, Math.min(100, Math.round(categoryAverages.academics * dayFactors[index]))),
    finance: Math.max(0, Math.min(100, Math.round(categoryAverages.finance * dayFactors[index]))),
    personal: Math.max(0, Math.min(100, Math.round(categoryAverages.personal * dayFactors[index]))),
  }));

  // Calculate average per category for radar
  const radarData = [
    { subject: "Academics", A: categoryAverages.academics },
    { subject: "Fitness", A: categoryAverages.fitness },
    { subject: "Finance", A: categoryAverages.finance },
    { subject: "Personal", A: categoryAverages.personal },
  ];

  // Calculate completion ratios
  const completed = goalItems.filter((g) => g.progress >= 100).length;
  const inProgress = goalItems.filter((g) => g.progress > 0 && g.progress < 100).length;
  const pending = goalItems.filter((g) => g.progress === 0).length;
  const total = goalItems.length;

  const completionData = [
    { name: "Completed", value: total > 0 ? Math.round((completed / total) * 100) : 0, color: "#3b82f6" },
    { name: "In Progress", value: total > 0 ? Math.round((inProgress / total) * 100) : 0, color: "#8b5cf6" },
    { name: "Pending", value: total > 0 ? Math.round((pending / total) * 100) : 100, color: "#e2e8f0" },
  ];

  const progressData = [0.25, 0.5, 0.75, 1].map((factor, index) => {
    const completedValue = Math.round(completed * factor);
    const pendingValue = Math.max(0, pending + Math.round((1 - factor) * inProgress));
    const missedValue = Math.max(0, total - completedValue - pendingValue);

    return {
      week: `W${index + 1}`,
      completed: completedValue,
      pending: pendingValue,
      missed: missedValue,
    };
  });

  return {
    consistencyData,
    radarData,
    completionData,
    progressData,
    stats: {
      totalGoals: total,
      completedToday: completed,
      consistencyScore: total > 0 ? Math.round(goalItems.reduce((sum, g) => sum + g.progress, 0) / total) : 0,
      avgProgress: total > 0 ? Math.round(goalItems.reduce((sum, g) => sum + g.progress, 0) / total) : 0,
    },
  };
};

type ConsistencyData = {
  day: string;
  fitness: number;
  academics: number;
  finance: number;
  personal: number;
};

type RadarData = {
  subject: string;
  A: number;
};

type ProgressData = {
  week: string;
  completed: number;
  pending: number;
  missed: number;
};

type CompletionData = {
  name: string;
  value: number;
  color: string;
};

type ScheduleLog = {
  id: number;
  trigger: string;
  before: string;
  after: string;
  impact: string;
};

function buildScheduleLogs(goalItems: Goal[]): ScheduleLog[] {
  const activeGoals = goalItems.filter((goal) => goal.progress < 100);

  if (activeGoals.length === 0) {
    return [
      {
        id: 1,
        trigger: "No active goals",
        before: "No active goals found for this user",
        after: "Create goals in Goals page to generate adaptive scheduling",
        impact: "Waiting for input",
      },
    ];
  }

  return activeGoals
    .slice()
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 3)
    .map((goal, index) => {
      const totalDays = Math.max(goal.durationWeeks * 7, 1);
      const elapsedDays = Math.max(0, Math.floor((Date.now() - new Date(goal.createdAt).getTime()) / (24 * 60 * 60 * 1000)));
      const remainingDays = Math.max(totalDays - elapsedDays, 1);
      const targetHours = goal.hoursPerWeek * goal.durationWeeks;
      const remainingHours = Math.max(targetHours - goal.loggedHours, 0);
      const neededPerDay = remainingHours / remainingDays;

      return {
        id: goal.id,
        trigger: `${goal.category} progress at ${goal.progress}%`,
        before: `${goal.title}\nLogged: ${goal.loggedHours.toFixed(1)}h / ${targetHours.toFixed(1)}h`,
        after: `Allocate ${neededPerDay.toFixed(2)}h/day for next ${remainingDays} day(s)\nPriority: ${goal.priority}`,
        impact: `${remainingHours.toFixed(1)}h remaining`,
      };
    });
}

function GoalConsistencyChart({ consistencyData }: { consistencyData: any[] }) {
  return (
    <Card>
      <SectionTitle sub="Past 7 days - all categories">Goal Consistency</SectionTitle>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={consistencyData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              fontSize: 11,
            }}
          />
          <Line type="monotone" dataKey="fitness" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="academics" stroke="#8b5cf6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="finance" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="personal" stroke="#f59e0b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-2 flex-wrap">
        {[
          ["fitness", "#3b82f6"],
          ["academics", "#8b5cf6"],
          ["finance", "#10b981"],
          ["personal", "#f59e0b"],
        ].map(([k, c]) => (
          <span key={k} className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
            {k}
          </span>
        ))}
      </div>
    </Card>
  );
}

function GoalBalanceRadar({ radarData }: { radarData: any[] }) {
  return (
    <Card>
      <SectionTitle sub="Balance across life areas">Goal Balance</SectionTitle>
      <ResponsiveContainer width="100%" height={180}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "#64748b" }} />
          <Radar dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function ProgressTrendsChart({ progressData }: { progressData: ProgressData[] }) {
  return (
    <Card>
      <SectionTitle sub="Weekly goal completion vs pending">Progress Trends</SectionTitle>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={progressData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              fontSize: 11,
            }}
          />
          <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="pending" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
          <Bar dataKey="missed" fill="#fca5a5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-2">
        {[
          ["completed", "#3b82f6"],
          ["pending", "#e2e8f0"],
          ["missed", "#fca5a5"],
        ].map(([k, c]) => (
          <span key={k} className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
            {k}
          </span>
        ))}
      </div>
    </Card>
  );
}

function GoalCompletionChart({ completionData }: { completionData: any[] }) {
  return (
    <Card>
      <SectionTitle sub="This week's snapshot">Goal Completion</SectionTitle>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie data={completionData} cx={55} cy={55} innerRadius={32} outerRadius={52} dataKey="value" strokeWidth={0}>
              {completionData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-2">
          {completionData.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
              <span className="text-xs text-slate-600">{d.name}</span>
              <span className="text-xs font-semibold text-slate-800 ml-auto">{d.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function SchedulingLog({ logs }: { logs: ScheduleLog[] }) {
  return (
    <Card className="max-h-[420px] overflow-y-auto">
      <SectionTitle sub="AI-triggered adjustments to your plan">Adaptive Scheduling Log</SectionTitle>
      <div className="flex flex-col gap-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                ⚙ {log.trigger}
              </span>
              <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full ml-auto">
                {log.impact}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Before</p>
                <div className="bg-red-50 border border-red-100 rounded-lg p-2.5">
                  {log.before.split("\n").map((line, i) => (
                    <p key={i} className="text-xs text-slate-600">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">After</p>
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                  {log.after.split("\n").map((line, i) => (
                    <p key={i} className="text-xs text-slate-600">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SmartInsightsCard() {
  const colors: Record<InsightType, string> = insightColors;

  return (
    <Card>
      <SectionTitle sub="Personalized AI suggestions">Smart Insights</SectionTitle>
      <div className="flex flex-col gap-2">
        {insights.map((ins, i) => (
          <div key={i} className={`rounded-xl border p-3 flex gap-2.5 items-start ${colors[ins.type]}`}>
            <span className="text-base mt-0.5">{ins.icon}</span>
            <p className="text-xs text-slate-700 leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function DashboardPage({ goalItems }: { goalItems: Goal[] }) {
  const dashboardData = useMemo(() => generateDashboardData(goalItems), [goalItems]);
  const scheduleLogs = useMemo(() => buildScheduleLogs(goalItems), [goalItems]);

  const completionRate =
    dashboardData.stats.totalGoals > 0
      ? Math.round((dashboardData.stats.completedToday / dashboardData.stats.totalGoals) * 100)
      : 0;

  const activeGoals = goalItems.filter((g) => g.progress < 100).length;
  const improvingGoals = goalItems.filter((g) => g.progress > 0 && g.progress < 100).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active Goals", value: activeGoals.toString(), change: `${dashboardData.stats.totalGoals} total tracked`, icon: "🎯" },
          { label: "Completed", value: dashboardData.stats.completedToday.toString(), change: `${completionRate}% completion rate`, icon: "✅" },
          { label: "Consistency Score", value: `${dashboardData.stats.consistencyScore}%`, change: `${improvingGoals} currently improving`, icon: "📈" },
          { label: "Avg Progress", value: `${dashboardData.stats.avgProgress}%`, change: "Calculated from all goals", icon: "🔄" },
        ].map((s) => (
          <Card key={s.label} className="flex items-center gap-3">
            <div className="text-2xl">{s.icon}</div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-[10px] text-slate-400">{s.change}</p>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2">
          <GoalConsistencyChart consistencyData={dashboardData.consistencyData} />
        </div>
        <GoalBalanceRadar radarData={dashboardData.radarData} />
        <GoalCompletionChart completionData={dashboardData.completionData} />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2">
          <ProgressTrendsChart progressData={dashboardData.progressData} />
        </div>
        <div className="col-span-2">
          <SchedulingLog logs={scheduleLogs} />
        </div>
      </div>
    </div>
  );
}