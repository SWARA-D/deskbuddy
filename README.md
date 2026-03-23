# DeskBuddy — Full Stack Application

Complete microservices backend + Next.js frontend + Postgres + Redis.

---

## Project Structure

```
deskbuddy/
├── frontend/                       # Next.js UI (see frontend/README.md)
├── services/                       # FastAPI microservices
│   ├── gateway/                    # API Gateway (port 8080)
│   ├── auth_service/               # Authentication (JWT)
│   ├── journal_service/            # Journal CRUD
│   ├── nlp_service/                # Sentiment analysis (VADER)
│   ├── music_service/              # Music recommendations (mock Spotify)
│   ├── tasks_service/              # Tasks CRUD
│   ├── checkin_service/            # Daily check-ins + streak
│   └── bot_service/                # Bot intent routing
├── db/init/                        # Postgres init SQL
├── docker-compose.yml              # Orchestration
└── README.md                       # This file
```

---

## Prerequisites

| Tool | Min Version |
|------|-------------|
| Docker | 20.x+ |
| Docker Compose | 2.x+ |
| Node.js | 18 LTS (for frontend) |
| npm | ships with Node |

---

## Quick Start (3 commands)

```bash
# 1. Start all backend services (this builds images the first time)
docker-compose up -d

# 2. Wait 10 seconds for databases to initialize, then check health
docker-compose ps

# 3. In a new terminal, start the frontend
cd frontend
npm install
npm run dev
```

Now open:
- **Frontend:** http://localhost:3000
- **Gateway API:** http://localhost:8080/health

---

## What Just Happened?

Docker Compose started:

| Container | Port | Description |
|-----------|------|-------------|
| postgres | 5432 | Postgres 15 with 4 databases (auth, journal, tasks, checkin) |
| redis | 6379 | Redis 7 for caching + rate limiting |
| gateway | 8080 | API Gateway — public entry point for frontend |
| auth_service | 8001 | User auth (internal only) |
| journal_service | 8002 | Journal entries (internal only) |
| nlp_service | 8003 | Sentiment analysis (internal only) |
| music_service | 8004 | Music recommendations (internal only) |
| tasks_service | 8005 | Tasks CRUD (internal only) |
| checkin_service | 8006 | Daily check-ins + streak (internal only) |
| bot_service | 8007 | Bot intent router (internal only) |

**Frontend on :3000** talks to **Gateway on :8080**. Gateway validates JWT and forwards requests to internal services with Pattern A headers (`X-User-Id`, `X-Request-Id`).

---

## Manual Testing (with curl)

### 1. Register a user
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"swara@example.com","password":"test1234"}'
```

Response includes `access_token` — copy it.

### 2. Create a journal entry
```bash
curl -X POST http://localhost:8080/journal/entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"text":"I felt nervous today but pushed through","input_type":"typed","analyze":true}'
```

### 3. Get music recommendations
```bash
curl "http://localhost:8080/music/recommendations?mood=anxious" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Create a task
```bash
curl -X POST http://localhost:8080/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"title":"Practice 5-minute intro","due_at":"2026-02-05T16:00:00Z","category":"confidence","difficulty":2}'
```

### 5. Daily check-in
```bash
curl -X POST http://localhost:8080/checkins \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"checkin_date":"2026-02-04","caption":"Small win today"}'
```

---

## Frontend → Backend Flow

1. User logs in on frontend (`/auth/login`)
2. Frontend stores JWT in `localStorage` or cookie
3. All subsequent requests include `Authorization: Bearer <token>` header
4. Gateway validates JWT, extracts `user_id`, injects `X-User-Id` header, forwards to internal service
5. Internal service trusts `X-User-Id` and scopes data to that user

---

## Stopping Everything

```bash
# Stop all services but keep volumes (data persists)
docker-compose down

# Stop AND delete volumes (fresh start next time)
docker-compose down -v
```

---

## Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f gateway
docker-compose logs -f auth_service
```

---

## Database Access (for debugging)

```bash
# Connect to Postgres
docker exec -it deskbuddy_postgres psql -U deskbuddy -d deskbuddy_auth

# List all databases
\l

# Connect to journal database
\c deskbuddy_journal

# List tables
\dt

# Query users
SELECT * FROM users;
```

---

## Rebuilding After Code Changes

```bash
# Rebuild all services
docker-compose up -d --build

# Rebuild single service
docker-compose up -d --build gateway
```

---

## Architecture Notes (Pattern A)

**Pattern A = JWT → Header Injection:**

1. Gateway receives JWT in `Authorization` header
2. Gateway decodes JWT, extracts `user_id` from `sub` claim
3. Gateway adds `X-User-Id: <uuid>` and `X-Request-Id: <uuid>` headers
4. Gateway forwards request to internal service
5. Internal service trusts headers (no JWT validation needed)

This keeps services simple and stateless.

---

## Next Steps

- **Wire frontend to backend:** Replace in-memory state in `/journal/page.tsx`, `/music/page.tsx`, etc. with `fetch()` calls to `http://localhost:8080`.
- **Add real Spotify integration:** Replace mock fallback in `music_service` with OAuth + Spotify Web API.
- **Implement async NLP:** Add message queue (RabbitMQ/Kafka) so journal analysis happens in background.
- **Production deployment:** Document sharding, CDN, load balancing strategies.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot connect to Docker daemon` | Start Docker Desktop |
| `port 5432 already in use` | Stop local Postgres or change port in docker-compose.yml |
| `database "deskbuddy_auth" does not exist` | Run `docker-compose down -v && docker-compose up -d` to recreate databases |
| `401 Unauthorized` | Token expired or invalid — re-login to get fresh token |
| Frontend can't reach backend | Check `NEXT_PUBLIC_API_URL` in `frontend/.env.local` points to `http://localhost:8080` |

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, Tailwind CSS, TypeScript |
| Gateway | FastAPI, python-jose (JWT), httpx (service-to-service), Redis (rate limit) |
| Services | FastAPI, Pydantic, psycopg2 (Postgres) |
| NLP | VADER Sentiment (no external API, runs in-process) |
| Database | Postgres 15 (separate DBs per service) |
| Cache | Redis 7 |
| Orchestration | Docker Compose |

---

**You're all set!** The backend is running, the frontend is running, databases are initialized. Start exploring the desk UI at http://localhost:3000 