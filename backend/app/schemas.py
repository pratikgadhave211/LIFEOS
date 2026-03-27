from datetime import date as DateType, datetime

from pydantic import BaseModel, ConfigDict, Field


class GoalCreate(BaseModel):
    user_id: str
    title: str
    category: str
    priority: str
    hours_per_week: float = Field(gt=0)
    duration_weeks: int = Field(gt=0)


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    title: str
    category: str
    priority: str
    hours_per_week: float
    duration_weeks: int
    logged_hours: float
    progress: int
    status: str
    created_at: datetime


class GoalUpdate(BaseModel):
    user_id: str
    title: str | None = None
    category: str | None = None
    priority: str | None = None
    hours_per_week: float | None = Field(default=None, gt=0)
    duration_weeks: int | None = Field(default=None, gt=0)


class DailyLogCreate(BaseModel):
    hours_logged: float = Field(gt=0)
    note: str | None = None
    log_date: DateType | None = None


class GoalProgressResponse(BaseModel):
    goal_id: int
    logged_hours: float
    progress: int
    status: str


class GoalCompletionStreakResponse(BaseModel):
    streak_days: int
    total_completed_goals: int
    last_completion_date: DateType | None = None


class BlockedRange(BaseModel):
    start_hour: int = Field(ge=0, le=23)
    end_hour: int = Field(ge=1, le=24)


class PlanGenerateRequest(BaseModel):
    user_id: str
    date: DateType | None = None
    available_hours: float = Field(default=8, gt=0, le=16)
    start_hour: int = Field(default=6, ge=0, le=23)
    end_hour: int = Field(default=22, ge=1, le=24)
    session_minutes: int = Field(default=60, ge=15, le=180)
    break_minutes: int = Field(default=15, ge=0, le=60)
    blocked_ranges: list[BlockedRange] = Field(default_factory=list)
    use_llm: bool = True


class PlanBlockOut(BaseModel):
    start_time: str
    end_time: str
    goal_id: int | None
    title: str
    reason: str
    confidence: float


class PlanGenerateResponse(BaseModel):
    date: DateType
    summary: str
    blocks: list[PlanBlockOut]
    sources: list[str]


class ProgressInsightItem(BaseModel):
    icon: str
    type: str
    text: str


class ProgressInsightsResponse(BaseModel):
    summary: str
    source: str
    insights: list[ProgressInsightItem]


class KnowledgeDoc(BaseModel):
    source: str
    text: str
    metadata: dict[str, str] = Field(default_factory=dict)


class KnowledgeIngestRequest(BaseModel):
    namespace: str | None = None
    documents: list[KnowledgeDoc]


class KnowledgeIngestResponse(BaseModel):
    ingested_count: int
