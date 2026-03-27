import { useState } from "react";
import { categoryColors, goals, priorityBadge } from "./data";
import type { GoalCategory, GoalForm, GoalPriority } from "./types";
import { Card, SectionTitle } from "./ui";

function GoalsList() {
  return (
    <Card className="col-span-3">
      <SectionTitle sub="Active goals with progress">Current Goals</SectionTitle>
      <div className="flex flex-col gap-2">
        {goals.map((g) => (
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

export default function GoalsPage() {
  const [form, setForm] = useState<GoalForm>({
    title: "",
    category: "Fitness",
    priority: "Medium",
    deadline: "",
    time: "",
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <SectionTitle sub="Add a new goal">Create Goal</SectionTitle>
        <div className="flex flex-col gap-3">
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
            <label className="text-xs text-slate-500 mb-1 block">Deadline</label>
            <input
              type="date"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Estimated Time (hrs/week)</label>
            <input
              type="number"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-blue-400 transition-colors"
              placeholder="e.g. 3"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </div>
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors mt-1">
            + Add Goal
          </button>
        </div>
      </Card>
      <div className="col-span-2">
        <GoalsList />
      </div>
    </div>
  );
}
