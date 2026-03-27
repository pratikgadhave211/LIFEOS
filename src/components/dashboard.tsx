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
import { insightColors, insights } from "./data";
import type { InsightType } from "./types";
import { Card, SectionTitle } from "./ui";

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

const consistencyData: ConsistencyData[] = [
  { day: "Mon", fitness: 80, academics: 60, finance: 45, personal: 70 },
  { day: "Tue", fitness: 65, academics: 75, finance: 55, personal: 60 },
  { day: "Wed", fitness: 90, academics: 80, finance: 65, personal: 55 },
  { day: "Thu", fitness: 70, academics: 85, finance: 70, personal: 80 },
  { day: "Fri", fitness: 85, academics: 70, finance: 60, personal: 75 },
  { day: "Sat", fitness: 95, academics: 50, finance: 80, personal: 90 },
  { day: "Sun", fitness: 75, academics: 65, finance: 75, personal: 85 },
];

const radarData: RadarData[] = [
  { subject: "Academics", A: 78 },
  { subject: "Fitness", A: 88 },
  { subject: "Finance", A: 62 },
  { subject: "Personal", A: 74 },
  { subject: "Social", A: 55 },
];

const progressData: ProgressData[] = [
  { week: "W1", completed: 5, pending: 3, missed: 1 },
  { week: "W2", completed: 8, pending: 2, missed: 2 },
  { week: "W3", completed: 6, pending: 4, missed: 1 },
  { week: "W4", completed: 10, pending: 1, missed: 0 },
];

const completionData: CompletionData[] = [
  { name: "Completed", value: 62, color: "#3b82f6" },
  { name: "In Progress", value: 25, color: "#8b5cf6" },
  { name: "Pending", value: 13, color: "#e2e8f0" },
];

const scheduleLogs: ScheduleLog[] = [
  {
    id: 1,
    trigger: "Deadline conflict detected",
    before: "6:00-7:00 AM: Budget Review\n7:00-8:00 AM: ML Study",
    after: "6:00-7:30 AM: ML Study (Priority Boosted)\n7:30-8:30 AM: Budget Review",
    impact: "+22% deadline safety",
  },
  {
    id: 2,
    trigger: "Consistency drop in Fitness",
    before: "No fitness block scheduled today",
    after: "7:00-7:45 AM: Morning Run (Auto-inserted)",
    impact: "Streak maintained",
  },
];

function GoalConsistencyChart() {
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

function GoalBalanceRadar() {
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

function ProgressTrendsChart() {
  return (
    <Card>
      <SectionTitle sub="Weekly goal completion vs pending">Progress Trends</SectionTitle>
      <ResponsiveContainer width="100%" height={160}>
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

function GoalCompletionChart() {
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

function SchedulingLog() {
  return (
    <Card className="col-span-2">
      <SectionTitle sub="AI-triggered adjustments to your plan">Adaptive Scheduling Log</SectionTitle>
      <div className="flex flex-col gap-3">
        {scheduleLogs.map((log) => (
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

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active Goals", value: "12", change: "+2 this week", icon: "🎯" },
          { label: "Completed Today", value: "4", change: "67% of daily plan", icon: "✅" },
          { label: "Consistency Score", value: "82%", change: "+5% vs last week", icon: "📈" },
          { label: "Schedule Adjustments", value: "3", change: "Auto-rebalanced today", icon: "🔄" },
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
          <GoalConsistencyChart />
        </div>
        <GoalBalanceRadar />
        <GoalCompletionChart />
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2">
          <ProgressTrendsChart />
        </div>
        <div className="col-span-2">
          <SmartInsightsCard />
        </div>
      </div>
      <SchedulingLog />
    </div>
  );
}
