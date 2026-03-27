from datetime import date
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import DailyLog, Goal, PlanBlock
from app.planner.engine import PlannerEngine
from app.planner.rag import RagService
from app.schemas import (
    GoalCompletionStreakResponse,
    DailyLogCreate,
    GoalCreate,
    GoalProgressResponse,
    GoalRead,
    GoalUpdate,
    KnowledgeIngestRequest,
    KnowledgeIngestResponse,
    PlanBlockOut,
    PlanGenerateRequest,
    PlanGenerateResponse,
    ProgressInsightItem,
    ProgressInsightsResponse,
)

router = APIRouter(prefix="/api", tags=["planner"])
rag_service = RagService(path=settings.chroma_path)
planner_engine = PlannerEngine(rag_service=rag_service)


def compute_goal_progress(goal: Goal) -> None:
    target_hours = max(goal.hours_per_week * goal.duration_weeks, 0.1)
    goal.progress = min(100, int(round((goal.logged_hours / target_hours) * 100)))
    goal.status = "completed" if goal.progress >= 100 else "active"


def compute_completion_streak(completion_dates: list[date]) -> int:
    if not completion_dates:
        return 0

    completion_set = set(completion_dates)
    today = date.today()

    if today in completion_set:
        cursor = today
    elif (today - timedelta(days=1)) in completion_set:
        cursor = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    while cursor in completion_set:
        streak += 1
        cursor -= timedelta(days=1)

    return streak


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/goals", response_model=GoalRead)
def create_goal(payload: GoalCreate, db: Session = Depends(get_db)) -> Goal:
    goal = Goal(
        user_id=payload.user_id,
        title=payload.title,
        category=payload.category,
        priority=payload.priority,
        hours_per_week=payload.hours_per_week,
        duration_weeks=payload.duration_weeks,
        logged_hours=0,
        progress=0,
        status="active",
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.get("/goals", response_model=list[GoalRead])
def list_goals(user_id: str = Query(...), db: Session = Depends(get_db)) -> list[Goal]:
    return db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.created_at.desc()).all()


@router.get("/goals-completion-streak", response_model=GoalCompletionStreakResponse)
def get_goal_completion_streak(user_id: str = Query(...), db: Session = Depends(get_db)) -> GoalCompletionStreakResponse:
    goals = db.query(Goal).filter(Goal.user_id == user_id).all()
    if not goals:
        return GoalCompletionStreakResponse(streak_days=0, total_completed_goals=0, last_completion_date=None)

    target_hours_by_goal = {goal.id: max(goal.hours_per_week * goal.duration_weeks, 0.1) for goal in goals}
    logged_totals_by_goal = {goal.id: 0.0 for goal in goals}
    completion_date_by_goal: dict[int, date] = {}

    logs = (
        db.query(DailyLog)
        .filter(DailyLog.goal_id.in_(list(target_hours_by_goal.keys())))
        .order_by(DailyLog.log_date.asc(), DailyLog.id.asc())
        .all()
    )

    for log in logs:
        goal_id = log.goal_id
        if goal_id in completion_date_by_goal:
            continue

        logged_totals_by_goal[goal_id] = logged_totals_by_goal.get(goal_id, 0.0) + max(log.hours_logged, 0.0)
        if logged_totals_by_goal[goal_id] >= target_hours_by_goal.get(goal_id, 0.1):
            completion_date_by_goal[goal_id] = log.log_date

    completion_dates = sorted(completion_date_by_goal.values())
    streak_days = compute_completion_streak(completion_dates)
    last_completion_date = completion_dates[-1] if completion_dates else None

    return GoalCompletionStreakResponse(
        streak_days=streak_days,
        total_completed_goals=len(completion_dates),
        last_completion_date=last_completion_date,
    )


@router.put("/goals/{goal_id}", response_model=GoalRead)
def update_goal(goal_id: int, payload: GoalUpdate, db: Session = Depends(get_db)) -> Goal:
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail="Cannot update goal for a different user")

    if payload.title is not None:
        goal.title = payload.title
    if payload.category is not None:
        goal.category = payload.category
    if payload.priority is not None:
        goal.priority = payload.priority
    if payload.hours_per_week is not None:
        goal.hours_per_week = payload.hours_per_week
    if payload.duration_weeks is not None:
        goal.duration_weeks = payload.duration_weeks

    compute_goal_progress(goal)

    db.commit()
    db.refresh(goal)
    return goal


@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: int, user_id: str = Query(...), db: Session = Depends(get_db)) -> dict[str, str]:
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if goal.user_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot delete goal for a different user")

    db.query(DailyLog).filter(DailyLog.goal_id == goal_id).delete(synchronize_session=False)
    db.query(PlanBlock).filter(PlanBlock.goal_id == goal_id, PlanBlock.user_id == user_id).delete(synchronize_session=False)
    db.delete(goal)
    db.commit()

    return {"status": "deleted"}


@router.post("/goals/{goal_id}/log-hours", response_model=GoalProgressResponse)
def log_goal_hours(goal_id: int, payload: DailyLogCreate, db: Session = Depends(get_db)) -> GoalProgressResponse:
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    log_entry = DailyLog(
        goal_id=goal_id,
        log_date=payload.log_date or date.today(),
        hours_logged=payload.hours_logged,
        note=payload.note,
    )
    db.add(log_entry)

    target_hours = max(goal.hours_per_week * goal.duration_weeks, 0.1)
    goal.logged_hours = min(goal.logged_hours + payload.hours_logged, target_hours)
    compute_goal_progress(goal)

    db.commit()
    db.refresh(goal)

    return GoalProgressResponse(
        goal_id=goal.id,
        logged_hours=goal.logged_hours,
        progress=goal.progress,
        status=goal.status,
    )


@router.post("/planner/generate", response_model=PlanGenerateResponse)
def generate_plan(payload: PlanGenerateRequest, db: Session = Depends(get_db)) -> PlanGenerateResponse:
    plan_date = payload.date or date.today()

    goals = (
        db.query(Goal)
        .filter(Goal.user_id == payload.user_id)
        .filter(Goal.status != "completed")
        .order_by(Goal.priority.desc(), Goal.created_at.asc())
        .all()
    )

    result = planner_engine.generate_plan(goals, payload)

    db.query(PlanBlock).filter(PlanBlock.user_id == payload.user_id, PlanBlock.plan_date == plan_date).delete(synchronize_session=False)

    for block in result.blocks:
        db.add(
            PlanBlock(
                user_id=payload.user_id,
                goal_id=block.get("goal_id"),
                plan_date=plan_date,
                start_time=block["start_time"],
                end_time=block["end_time"],
                title=block["title"],
                reason=block["reason"],
                confidence=float(block.get("confidence", 0.65)),
            )
        )

    db.commit()

    return PlanGenerateResponse(
        date=plan_date,
        summary=result.summary,
        blocks=[PlanBlockOut(**block) for block in result.blocks],
        sources=result.sources,
    )


@router.get("/planner/today", response_model=list[PlanBlockOut])
def get_today_plan(
    user_id: str = Query(...),
    plan_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[PlanBlockOut]:
    requested_date = plan_date or date.today()

    blocks = (
        db.query(PlanBlock)
        .filter(PlanBlock.user_id == user_id, PlanBlock.plan_date == requested_date)
        .order_by(PlanBlock.start_time.asc())
        .all()
    )

    return [
        PlanBlockOut(
            start_time=block.start_time,
            end_time=block.end_time,
            goal_id=block.goal_id,
            title=block.title,
            reason=block.reason,
            confidence=block.confidence,
        )
        for block in blocks
    ]


@router.get("/insights/progress", response_model=ProgressInsightsResponse)
def get_progress_insights(user_id: str = Query(...), db: Session = Depends(get_db)) -> ProgressInsightsResponse:
    goals = db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.created_at.asc()).all()
    result = planner_engine.generate_progress_insights(goals)
    return ProgressInsightsResponse(
        summary=result["summary"],
        source=result["source"],
        insights=[ProgressInsightItem(**insight) for insight in result["insights"]],
    )


@router.post("/knowledge/ingest", response_model=KnowledgeIngestResponse)
def ingest_knowledge(payload: KnowledgeIngestRequest) -> KnowledgeIngestResponse:
    docs = [
        {
            "source": doc.source,
            "text": doc.text,
            "metadata": doc.metadata,
        }
        for doc in payload.documents
    ]
    count = rag_service.ingest_documents(docs, namespace=payload.namespace)
    return KnowledgeIngestResponse(ingested_count=count)
