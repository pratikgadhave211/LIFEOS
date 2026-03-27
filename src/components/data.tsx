import type { Goal, GoalCategory, GoalPriority, Insight, InsightType, NavItem } from "./types";

export const navItems: NavItem[] = ["Dashboard", "Planner", "Goals", "Insights"];

export const categoryColors: Record<GoalCategory, string> = {
  Fitness: "#3b82f6",
  Academics: "#8b5cf6",
  Finance: "#10b981",
  Personal: "#f59e0b",
};

export const priorityBadge: Record<GoalPriority, string> = {
  High: "bg-red-50 text-red-600 border border-red-200",
  Medium: "bg-amber-50 text-amber-600 border border-amber-200",
  Low: "bg-emerald-50 text-emerald-600 border border-emerald-200",
};

export const goals: Goal[] = [
  {
    id: 1,
    title: "Morning Run 5km",
    category: "Fitness",
    priority: "High",
    deadline: "Today",
    progress: 80,
    color: "#3b82f6",
  },
  {
    id: 2,
    title: "Study ML Chapter 4",
    category: "Academics",
    priority: "High",
    deadline: "Tomorrow",
    progress: 45,
    color: "#8b5cf6",
  },
  {
    id: 3,
    title: "Review Monthly Budget",
    category: "Finance",
    priority: "Medium",
    deadline: "Mar 30",
    progress: 20,
    color: "#10b981",
  },
  {
    id: 4,
    title: "Read 30 Minutes",
    category: "Personal",
    priority: "Low",
    deadline: "Daily",
    progress: 65,
    color: "#f59e0b",
  },
  {
    id: 5,
    title: "DSA Practice - Trees",
    category: "Academics",
    priority: "High",
    deadline: "Apr 1",
    progress: 30,
    color: "#8b5cf6",
  },
];

export const insights: Insight[] = [
  {
    icon: "⚡",
    type: "warning",
    text: "ML Study has been delayed 2 days. Consider blocking 2h today to avoid deadline risk.",
  },
  {
    icon: "🎯",
    type: "success",
    text: "Your Fitness consistency is at 88% - best streak in 3 weeks. Keep it up!",
  },
  {
    icon: "💡",
    type: "info",
    text: "Finance goals have low time allocation. Try pairing with a 20-min block each morning.",
  },
  {
    icon: "🔄",
    type: "info",
    text: "Schedule auto-updated 3 times this week based on priority shifts.",
  },
];

export const insightColors: Record<InsightType, string> = {
  warning: "border-amber-200 bg-amber-50",
  success: "border-emerald-200 bg-emerald-50",
  info: "border-blue-100 bg-blue-50",
};
