from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import date
from typing import Any

from huggingface_hub import InferenceClient
from openai import OpenAI

from app.config import settings
from app.models import Goal
from app.schemas import PlanGenerateRequest

from .rag import RagService


@dataclass
class PlanResult:
    blocks: list[dict[str, Any]]
    summary: str
    sources: list[str]


def to_hhmm(minutes: int) -> str:
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"


def parse_hhmm(value: str) -> int | None:
    parts = value.split(":")
    if len(parts) != 2:
        return None
    try:
        hours = int(parts[0])
        mins = int(parts[1])
    except ValueError:
        return None
    if hours < 0 or hours > 23 or mins < 0 or mins > 59:
        return None
    return hours * 60 + mins


class PlannerEngine:
    def __init__(self, rag_service: RagService) -> None:
        self.rag_service = rag_service
        self.llm_provider = settings.llm_provider.strip().lower()
        self.hf_client = InferenceClient(token=settings.huggingface_api_token) if settings.huggingface_api_token else None
        self.openai_client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def generate_plan(self, goals: list[Goal], request: PlanGenerateRequest) -> PlanResult:
        plan_date = request.date or date.today()
        active_goals = [goal for goal in goals if goal.status != "completed" and goal.progress < 100]

        if not active_goals:
            return PlanResult(
                blocks=[],
                summary="No active goals found for this user. Add goals first, then generate a plan.",
                sources=["rule-based planner"],
            )

        retrieval_query = self._build_retrieval_query(active_goals, request)
        retrieved = self.rag_service.query(retrieval_query, top_k=settings.retrieval_k)

        source_names = [str(item.get("metadata", {}).get("source", "unknown")) for item in retrieved][:3]
        if not source_names:
            source_names = ["rule-based planner"]

        rule_blocks = self._generate_rule_blocks(active_goals, request, plan_date)
        if not rule_blocks:
            return PlanResult(
                blocks=[],
                summary="No schedule blocks could be generated with current constraints. Increase available hours or relax blocked ranges.",
                sources=source_names,
            )

        summary = "Rule-based schedule generated from goal urgency and remaining effort."

        if request.use_llm and self._has_llm_client() and rule_blocks:
            llm_blocks, llm_summary = self._llm_rebalance(rule_blocks, retrieved, request, active_goals)
            if llm_blocks:
                return PlanResult(
                    blocks=llm_blocks,
                    summary=llm_summary or "LLM-rebalanced schedule with RAG guidance.",
                    sources=source_names,
                )

            summary = "LLM requested but returned invalid output; using rule-based prioritized schedule."
        elif request.use_llm and not self._has_llm_client():
            summary = "LLM requested but not configured; using rule-based prioritized schedule."

        return PlanResult(blocks=rule_blocks, summary=summary, sources=source_names)

    def generate_progress_insights(self, goals: list[Goal]) -> dict[str, Any]:
        if not goals:
            return {
                "summary": "No goals available yet. Add goals to receive progress insights.",
                "source": "rule-based",
                "insights": [
                    {
                        "icon": "💡",
                        "type": "info",
                        "text": "Create at least one goal with weekly hours and a deadline to unlock AI progress guidance.",
                    }
                ],
            }

        goal_payload = []
        for goal in goals:
            target_hours = self._target_hours(goal)
            remaining = max(target_hours - goal.logged_hours, 0.0)
            goal_payload.append(
                {
                    "title": goal.title,
                    "category": goal.category,
                    "priority": goal.priority,
                    "progress": goal.progress,
                    "logged_hours": round(goal.logged_hours, 2),
                    "target_hours": round(target_hours, 2),
                    "remaining_hours": round(remaining, 2),
                }
            )

        if self._has_llm_client():
            parsed = self._call_llm_json(
                system_prompt=(
                    "You are a productivity coach. Return ONLY a valid JSON object with keys summary and insights. "
                    "insights must be an array (max 5 items). Each item must contain icon, type, text. "
                    "type must be one of: warning, success, info. Keep each text concise and actionable."
                ),
                user_payload={
                    "task": "Generate progress insights from current goals.",
                    "goals": goal_payload,
                },
            )
            validated = self._validate_progress_insights(parsed)
            if validated is not None:
                summary, insights = validated
                return {
                    "summary": summary,
                    "source": "llm",
                    "insights": insights,
                }

        summary, insights = self._rule_progress_insights(goals)
        return {
            "summary": summary,
            "source": "rule-based",
            "insights": insights,
        }

    def _has_llm_client(self) -> bool:
        if self.llm_provider == "huggingface":
            return self.hf_client is not None
        if self.llm_provider == "openai":
            return self.openai_client is not None
        return self.hf_client is not None or self.openai_client is not None

    def _validate_progress_insights(self, parsed: dict[str, Any] | None) -> tuple[str, list[dict[str, str]]] | None:
        if not isinstance(parsed, dict):
            return None

        summary = parsed.get("summary")
        insights_raw = parsed.get("insights")
        if not isinstance(summary, str) or not isinstance(insights_raw, list):
            return None

        allowed_types = {"warning", "success", "info"}
        validated: list[dict[str, str]] = []
        for item in insights_raw[:5]:
            if not isinstance(item, dict):
                continue

            icon = item.get("icon")
            level = item.get("type")
            text = item.get("text")
            if not isinstance(icon, str) or not isinstance(level, str) or not isinstance(text, str):
                continue
            if level not in allowed_types:
                continue

            validated.append(
                {
                    "icon": icon,
                    "type": level,
                    "text": text,
                }
            )

        if not validated:
            return None
        return summary, validated

    def _rule_progress_insights(self, goals: list[Goal]) -> tuple[str, list[dict[str, str]]]:
        total = len(goals)
        avg_progress = round(sum(goal.progress for goal in goals) / max(total, 1))

        insights: list[dict[str, str]] = []

        high_priority_lagging = [g for g in goals if g.priority.lower() == "high" and g.progress < 40]
        if high_priority_lagging:
            insights.append(
                {
                    "icon": "⚠",
                    "type": "warning",
                    "text": f"{len(high_priority_lagging)} high-priority goal(s) are below 40%. Prioritize them in your next planning run.",
                }
            )

        near_completion = [g for g in goals if 80 <= g.progress < 100]
        if near_completion:
            top = sorted(near_completion, key=lambda g: g.progress, reverse=True)[0]
            insights.append(
                {
                    "icon": "✅",
                    "type": "success",
                    "text": f"{top.title} is at {top.progress}%. One focused session can likely complete it.",
                }
            )

        fitness_goals = [g for g in goals if g.category.lower() == "fitness"]
        if fitness_goals:
            fitness_avg = round(sum(g.progress for g in fitness_goals) / len(fitness_goals))
            insights.append(
                {
                    "icon": "🏃",
                    "type": "info",
                    "text": f"Fitness average progress is {fitness_avg}%. Keep exactly one dedicated fitness block for consistency.",
                }
            )

        if len(insights) < 3:
            lowest = sorted(goals, key=lambda g: g.progress)[0]
            insights.append(
                {
                    "icon": "💡",
                    "type": "info",
                    "text": f"{lowest.title} is your lowest-progress goal at {lowest.progress}%. Consider increasing weekly hours.",
                }
            )

        summary = f"Average progress is {avg_progress}% across {total} goals."
        return summary, insights[:5]

    def _build_retrieval_query(self, goals: list[Goal], request: PlanGenerateRequest) -> str:
        goals_text = ", ".join(f"{goal.title} ({goal.category}, {goal.priority})" for goal in goals[:8])
        return (
            f"Plan day for goals: {goals_text}. "
            f"Available: {request.available_hours}h between {request.start_hour}:00 and {request.end_hour}:00. "
            "Need practical scheduling strategies for focus, breaks, and deadline risk reduction."
        )

    def _priority_weight(self, priority: str) -> float:
        table = {"high": 3.0, "medium": 2.0, "low": 1.0}
        return table.get(priority.lower(), 1.0)

    def _target_hours(self, goal: Goal) -> float:
        return max(goal.hours_per_week * goal.duration_weeks, 0.5)

    def _remaining_hours(self, goal: Goal) -> float:
        return max(self._target_hours(goal) - goal.logged_hours, 0.0)

    def _goal_score(self, goal: Goal, plan_date: date, remaining_hours: float) -> float:
        total_days = max(goal.duration_weeks * 7, 1)
        elapsed_days = max((plan_date - goal.created_at.date()).days, 0)
        remaining_days = max(total_days - elapsed_days, 1)

        target_hours = self._target_hours(goal)
        expected_by_now = (min(elapsed_days, total_days) / total_days) * target_hours
        lag_hours = max(expected_by_now - goal.logged_hours, 0.0)

        urgency_rate = remaining_hours / remaining_days
        priority = self._priority_weight(goal.priority)

        return (priority * 2.0) + (urgency_rate * 1.5) + (lag_hours * 1.2)

    def _advance_past_block(self, current_minute: int, blocked: list[tuple[int, int]]) -> int:
        updated = current_minute
        for start, end in blocked:
            if start <= updated < end:
                updated = end
        return updated

    def _first_overlap(self, start_minute: int, end_minute: int, blocked: list[tuple[int, int]]) -> tuple[int, int] | None:
        for block_start, block_end in blocked:
            if max(start_minute, block_start) < min(end_minute, block_end):
                return (block_start, block_end)
        return None

    def _generate_rule_blocks(self, goals: list[Goal], request: PlanGenerateRequest, plan_date: date) -> list[dict[str, Any]]:
        if not goals:
            return []

        day_start = request.start_hour * 60
        day_end = request.end_hour * 60
        time_budget = int(request.available_hours * 60)
        blocked = sorted((item.start_hour * 60, item.end_hour * 60) for item in request.blocked_ranges)

        remaining_by_goal = {goal.id: self._remaining_hours(goal) for goal in goals}
        allocated_by_goal_minutes = {goal.id: 0 for goal in goals}
        fitness_slot_used = False

        blocks: list[dict[str, Any]] = []
        current = day_start
        used_minutes = 0
        last_goal_id: int | None = None

        while current < day_end and used_minutes < time_budget:
            candidates: list[tuple[float, float, Goal]] = []
            for goal in goals:
                remaining = remaining_by_goal.get(goal.id, 0.0)
                if remaining <= 0:
                    continue
                if goal.category.lower() == "fitness" and fitness_slot_used:
                    continue

                base_score = self._goal_score(goal, plan_date, remaining)
                # Diminishing returns keeps one high-priority goal from monopolizing all slots.
                fatigue = 1.0 + (allocated_by_goal_minutes[goal.id] / max(request.session_minutes, 1))
                adjusted_score = base_score / fatigue
                if last_goal_id == goal.id:
                    adjusted_score *= 0.65
                priority_weight = self._priority_weight(goal.priority)
                candidates.append((priority_weight, adjusted_score, goal))

            if not candidates:
                break

            max_priority = max(item[0] for item in candidates)
            highest_priority_candidates = [item for item in candidates if item[0] == max_priority]
            highest_priority_candidates.sort(key=lambda item: item[1], reverse=True)
            chosen_goal = highest_priority_candidates[0][2]

            current = self._advance_past_block(current, blocked)
            if current >= day_end:
                break

            remaining_minutes_for_goal = int(math.ceil(remaining_by_goal[chosen_goal.id] * 60))
            suggested_session = min(request.session_minutes, remaining_minutes_for_goal)
            budget_left = time_budget - used_minutes
            session_minutes = min(suggested_session, budget_left)

            if session_minutes < 15:
                break

            end_minute = current + session_minutes
            overlap = self._first_overlap(current, end_minute, blocked)
            if overlap:
                current = overlap[1]
                continue
            if end_minute > day_end:
                break

            allocated_hours = session_minutes / 60.0
            remaining_by_goal[chosen_goal.id] = max(remaining_by_goal[chosen_goal.id] - allocated_hours, 0.0)
            allocated_by_goal_minutes[chosen_goal.id] += session_minutes
            used_minutes += session_minutes

            blocks.append(
                {
                    "start_time": to_hhmm(current),
                    "end_time": to_hhmm(end_minute),
                    "goal_id": chosen_goal.id,
                    "title": chosen_goal.title,
                    "reason": (
                        f"{chosen_goal.priority} priority with {remaining_by_goal[chosen_goal.id]:.1f}h "
                        "remaining after this slot."
                    ),
                    "confidence": 0.72,
                }
            )

            if chosen_goal.category.lower() == "fitness":
                fitness_slot_used = True
            last_goal_id = chosen_goal.id
            current = end_minute + request.break_minutes

        return blocks

    def _extract_first_json_object(self, text: str) -> dict[str, Any] | None:
        start = text.find("{")
        if start == -1:
            return None

        depth = 0
        in_string = False
        escape = False
        end = -1

        for idx in range(start, len(text)):
            char = text[idx]
            if in_string:
                if escape:
                    escape = False
                elif char == "\\":
                    escape = True
                elif char == '"':
                    in_string = False
                continue

            if char == '"':
                in_string = True
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    end = idx
                    break

        if end == -1:
            return None

        snippet = text[start : end + 1]
        try:
            parsed = json.loads(snippet)
        except json.JSONDecodeError:
            return None

        if not isinstance(parsed, dict):
            return None
        return parsed

    def _call_huggingface_json(self, system_prompt: str, user_payload: dict[str, Any]) -> dict[str, Any] | None:
        if not self.hf_client:
            return None

        prompt = (
            "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n"
            f"{system_prompt}\n"
            "<|eot_id|><|start_header_id|>user<|end_header_id|>\n"
            f"{json.dumps(user_payload)}\n"
            "<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n"
        )

        try:
            output_text = self.hf_client.text_generation(
                prompt=prompt,
                model=settings.huggingface_model,
                max_new_tokens=900,
                temperature=0.2,
                return_full_text=False,
            )
        except Exception:
            return None

        if not isinstance(output_text, str):
            return None

        return self._extract_first_json_object(output_text)

    def _call_openai_json(self, system_prompt: str, user_payload: dict[str, Any]) -> dict[str, Any] | None:
        if not self.openai_client:
            return None

        try:
            response = self.openai_client.chat.completions.create(
                model=settings.openai_model,
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(user_payload)},
                ],
            )
            raw_content = response.choices[0].message.content or "{}"
            parsed = json.loads(raw_content)
        except Exception:
            return None

        if not isinstance(parsed, dict):
            return None
        return parsed

    def _call_llm_json(self, system_prompt: str, user_payload: dict[str, Any]) -> dict[str, Any] | None:
        if self.llm_provider == "huggingface":
            return self._call_huggingface_json(system_prompt, user_payload)
        if self.llm_provider == "openai":
            return self._call_openai_json(system_prompt, user_payload)

        parsed = self._call_huggingface_json(system_prompt, user_payload)
        if parsed is not None:
            return parsed
        return self._call_openai_json(system_prompt, user_payload)

    def _llm_rebalance(
        self,
        rule_blocks: list[dict[str, Any]],
        retrieved: list[dict[str, Any]],
        request: PlanGenerateRequest,
        goals: list[Goal],
    ) -> tuple[list[dict[str, Any]] | None, str | None]:
        knowledge = "\n".join(f"- {item.get('content', '')[:250]}" for item in retrieved[:6]) or "- No external snippets"

        system_prompt = (
            "You are a schedule optimizer. Return ONLY valid JSON object with keys summary and blocks. "
            "Each block must include start_time, end_time, goal_id, title, reason, confidence. "
            "Time format must be HH:MM 24-hour. Keep blocks non-overlapping and inside allowed hours. "
            "Schedule strictly by priority order (High before Medium before Low) and allocate Fitness category at most one time block."
        )

        user_payload = {
            "constraints": {
                "start_hour": request.start_hour,
                "end_hour": request.end_hour,
                "session_minutes": request.session_minutes,
                "break_minutes": request.break_minutes,
            },
            "knowledge": knowledge,
            "goals": [
                {
                    "id": goal.id,
                    "title": goal.title,
                    "category": goal.category,
                    "priority": goal.priority,
                }
                for goal in goals
            ],
            "rule_blocks": rule_blocks,
        }

        parsed = self._call_llm_json(system_prompt, user_payload)
        if not isinstance(parsed, dict):
            return None, None

        candidate_blocks = parsed.get("blocks")
        if not isinstance(candidate_blocks, list):
            return None, None

        validated = self._validate_llm_blocks(candidate_blocks, request, goals)
        if not validated:
            return None, None

        summary = parsed.get("summary")
        if not isinstance(summary, str):
            summary = None

        return validated, summary

    def _validate_llm_blocks(
        self,
        blocks: list[dict[str, Any]],
        request: PlanGenerateRequest,
        goals: list[Goal],
    ) -> list[dict[str, Any]] | None:
        validated: list[dict[str, Any]] = []
        day_start = request.start_hour * 60
        day_end = request.end_hour * 60
        goal_by_id = {goal.id: goal for goal in goals}
        fitness_count = 0

        for block in blocks:
            if not isinstance(block, dict):
                return None

            start_raw = block.get("start_time")
            end_raw = block.get("end_time")
            title_raw = block.get("title")
            reason_raw = block.get("reason")

            if not isinstance(start_raw, str):
                return None
            if not isinstance(end_raw, str):
                return None
            if not isinstance(title_raw, str):
                return None
            if not isinstance(reason_raw, str):
                return None

            start_time = start_raw
            end_time = end_raw
            title = title_raw
            reason = reason_raw
            goal_id_raw = block.get("goal_id")

            goal_id: int | None
            if goal_id_raw is None:
                goal_id = None
            elif isinstance(goal_id_raw, int):
                goal_id = goal_id_raw
            else:
                return None

            if goal_id is not None and goal_id not in goal_by_id:
                return None

            start_minute = parse_hhmm(start_time)
            end_minute = parse_hhmm(end_time)
            if start_minute is None or end_minute is None or end_minute <= start_minute:
                return None
            if start_minute < day_start or end_minute > day_end:
                return None

            if goal_id is not None:
                goal = goal_by_id[goal_id]
                if goal.category.lower() == "fitness":
                    fitness_count += 1
                    if fitness_count > 1:
                        return None

            validated.append(
                {
                    "start_time": start_time,
                    "end_time": end_time,
                    "goal_id": goal_id,
                    "title": title,
                    "reason": reason,
                    "confidence": float(block.get("confidence", 0.65)),
                }
            )

        validated.sort(key=lambda item: item["start_time"])
        for idx in range(1, len(validated)):
            prev_end = parse_hhmm(validated[idx - 1]["end_time"])
            curr_start = parse_hhmm(validated[idx]["start_time"])
            if prev_end is None or curr_start is None:
                return None
            if curr_start < prev_end:
                return None

        last_priority: float | None = None
        for block in validated:
            goal_id = block.get("goal_id")
            if goal_id is None:
                continue

            goal = goal_by_id.get(goal_id)
            if goal is None:
                return None

            current_priority = self._priority_weight(goal.priority)
            if last_priority is not None and current_priority > last_priority:
                return None
            last_priority = current_priority

        return validated
