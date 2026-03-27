import { categoryColors } from "./data";
import type { GoalCategory } from "./types";
import { Card, SectionTitle } from "./ui";

export default function PlannerPage() {
  const hours = Array.from({ length: 14 }, (_, i) => i + 6);
  const blocks: { hour: number; len: number; title: string; cat: GoalCategory }[] = [
    { hour: 6, len: 1, title: "Morning Run 5km", cat: "Fitness" },
    { hour: 8, len: 1.5, title: "ML Study - Chapter 4", cat: "Academics" },
    { hour: 10, len: 1, title: "DSA Practice", cat: "Academics" },
    { hour: 13, len: 0.5, title: "Budget Review", cat: "Finance" },
    { hour: 15, len: 1, title: "Read 30 Minutes", cat: "Personal" },
    { hour: 19, len: 1, title: "Evening Workout", cat: "Fitness" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card className="col-span-2">
        <SectionTitle sub="Today's AI-generated time blocks">Daily Schedule - Friday, Mar 27</SectionTitle>
        <div className="relative mt-2" style={{ minHeight: 480 }}>
          {hours.map((h) => (
            <div key={h} className="flex items-start gap-3 border-t border-slate-50 py-1" style={{ height: 40 }}>
              <span className="text-xs text-slate-300 w-10 pt-0.5 flex-shrink-0">{h}:00</span>
              <div className="flex-1 relative" />
            </div>
          ))}
          {blocks.map((b, i) => (
            <div
              key={i}
              className="absolute left-14 right-2 rounded-xl px-3 py-1.5 cursor-pointer hover:brightness-95 transition-all"
              style={{
                top: (b.hour - 6) * 40 + 4,
                height: b.len * 40 - 4,
                background: `${categoryColors[b.cat]}22`,
                borderLeft: `3px solid ${categoryColors[b.cat]}`,
              }}
            >
              <p className="text-xs font-semibold" style={{ color: categoryColors[b.cat] }}>
                {b.title}
              </p>
              <p className="text-[10px] text-slate-400">{b.cat}</p>
            </div>
          ))}
        </div>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle sub="Tap to reschedule">Unscheduled Goals</SectionTitle>
          {["Review Savings Plan", "Call with Mentor", "Online Course Module 3"].map((t, i) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
              <span className="text-slate-300">⊕</span>
              <span className="text-xs text-slate-600">{t}</span>
            </div>
          ))}
        </Card>
        <Card>
          <SectionTitle>Conflict Alert</SectionTitle>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-xs font-medium text-red-700 mb-1">⚠ Overlap detected</p>
            <p className="text-xs text-slate-600">
              DSA Practice and ML Study both scheduled for 10-11 AM tomorrow. AI will auto-resolve.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
