# LIFEOS Planner Backend (Python + LLM + RAG)

## 1) Setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Then edit `.env` and set:

- `HUGGINGFACE_API_TOKEN=your_token_here`
- `HUGGINGFACE_MODEL=meta-llama/Llama-3.1-8B-Instruct`
- `LLM_PROVIDER=huggingface`

## 2) Run API

```bash
uvicorn app.main:app --reload --port 8000
```

API base URL: `http://localhost:8000`

## 3) Core Endpoints

- `POST /api/goals`
- `GET /api/goals?user_id=demo`
- `POST /api/goals/{goal_id}/log-hours`
- `POST /api/planner/generate`
- `GET /api/planner/today?user_id=demo`
- `POST /api/knowledge/ingest`

## 4) Sample Calls

### Create goal

```bash
curl -X POST http://localhost:8000/api/goals \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"demo\",\"title\":\"Study ML\",\"category\":\"Academics\",\"priority\":\"High\",\"hours_per_week\":6,\"duration_weeks\":2}"
```

### Log daily progress

```bash
curl -X POST http://localhost:8000/api/goals/1/log-hours \
  -H "Content-Type: application/json" \
  -d "{\"hours_logged\":1.5,\"note\":\"chapter 4 revision\"}"
```

### Ingest external knowledge for RAG

```bash
curl -X POST http://localhost:8000/api/knowledge/ingest \
  -H "Content-Type: application/json" \
  -d "{\"namespace\":\"demo\",\"documents\":[{\"source\":\"productivity-basics\",\"text\":\"Use deep work windows for high-priority tasks.\",\"metadata\":{\"topic\":\"time-management\"}}]}"
```

### Generate plan

```bash
curl -X POST http://localhost:8000/api/planner/generate \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"demo\",\"available_hours\":7,\"start_hour\":6,\"end_hour\":22,\"session_minutes\":60,\"break_minutes\":15,\"blocked_ranges\":[{\"start_hour\":13,\"end_hour\":14}],\"use_llm\":true}"
```

## 5) How LLM + RAG Works Here

1. The planner computes a rule-based schedule first.
2. It retrieves guidance snippets from a local persistent RAG knowledge store.
3. If `HUGGINGFACE_API_TOKEN` is configured and `use_llm=true`, LLM rebalances blocks using `meta-llama/Llama-3.1-8B-Instruct` by default.
4. If LLM output is invalid, the system falls back to rule-based blocks.

OpenAI fallback is still available if you set `LLM_PROVIDER=openai` and `OPENAI_API_KEY`.

## 6) Next Recommended Upgrades

- Add auth and user isolation.
- Add Alembic migrations.
- Add tests for planner scoring and overlap validation.
- Persist frontend goals using these APIs.
