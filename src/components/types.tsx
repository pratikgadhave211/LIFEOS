export type NavItem = "Dashboard" | "Planner" | "Goals" | "Insights";

export type GoalCategory = "Fitness" | "Academics" | "Finance" | "Personal";
export type GoalPriority = "High" | "Medium" | "Low";
export type InsightType = "warning" | "success" | "info";

export type Goal = {
  id: number;
  title: string;
  category: GoalCategory;
  priority: GoalPriority;
  deadline: string;
  progress: number;
  color: string;
  hoursPerWeek: number;
  durationWeeks: number;
  loggedHours: number;
  createdAt: string;
  currentStreak?: number;
  bestStreak?: number;
  lastLoggedDate?: string | null;
};

export type Insight = {
  icon: string;
  type: InsightType;
  text: string;
};

export type GoalForm = {
  title: string;
  category: GoalCategory;
  priority: GoalPriority;
  deadline?: string;
  time?: string;
  hoursPerWeek: string;
  durationWeeks: string;
};