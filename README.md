# Dev Digest Courier

Event-driven backend that aggregates coding news and sends daily digests to Telegram subscribers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Server (:3000)                       │
│  ┌───────────────┐  ┌───────────────┐  ┌────────────────────┐  │
│  │ Health Check   │  │ Admin Trigger │  │ Telegram Webhook   │  │
│  │ GET /health    │  │ POST /admin   │  │ POST /telegram     │  │
│  └───────────────┘  └──────┬────────┘  └─────────┬──────────┘  │
│                            │                      │             │
│                            ▼                      ▼             │
│                     ┌─────────────────────────────────────┐     │
│                     │          Queue Producers             │     │
│                     └─────────────────┬───────────────────┘     │
└───────────────────────────────────────┼─────────────────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │       Redis        │
                              │    (BullMQ Jobs)    │
                              └─────────┬─────────┘
                                        │
┌───────────────────────────────────────┼─────────────────────────┐
│                        Worker Process                           │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 digest-trigger queue                      │  │
│  │   ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │  │
│  │   │ CRON @8AM   │  │ Manual API   │  │ /retry cmd    │   │  │
│  │   └──────┬──────┘  └──────┬───────┘  └───────┬───────┘   │  │
│  │          └────────────────┼──────────────────┘           │  │
│  │                           ▼                               │  │
│  │              DigestTriggerWorker                          │  │
│  │         fetchAllSources() → 60 articles                   │  │
│  └───────────────────────────┬──────────────────────────────┘  │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              article-processing queue                      │  │
│  │              ArticleProcessorWorker                        │  │
│  │     upsert sources → dedup by SHA-256 → insert articles   │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               telegram-dispatch queue                      │  │
│  │              TelegramDispatchWorker                        │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  formatDigestMessage() → MarkdownV2 escape + chunk   │  │  │
│  │  │  sendMessage() → each active subscriber              │  │  │
│  │  └────────────────────────┬────────────────────────────┘  │  │
│  └───────────────────────────┼──────────────────────────────┘  │
│                              ▼                                   │
│                    ┌─────────────────┐                          │
│                    │  Telegram API   │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| API Server | Express 5 |
| Job Queue | BullMQ (Redis) |
| Database | PostgreSQL (Neon) via Prisma |
| Telegram Bot | Telegraf |
| Validation | Zod |
| Dev Tunnel | ngrok (auto-provisioned) |

## Pipeline Flow

```
CRON (8 AM UTC daily) / Manual / /retry
         │
         ▼
  [digest-trigger]        ←── DigestTriggerWorker
         │                       │  fetchAllSources()
         │                       │    ├── HackerNews (top 30)
         │                       │    └── Dev.to (5 tags × 30)
         │                       │  create ExecutionLog
         ▼                       ▼
  [article-processing]    ←── ArticleProcessorWorker
         │                       │  upsert Source records
         │                       │  dedup by SHA-256 URL hash
         │                       │  insert/upsert Article records
         ▼                       ▼
  [telegram-dispatch]     ←── TelegramDispatchWorker
                                 │  query PENDING articles
                                 │  formatDigestMessage()
                                 │  send to each subscriber
                                 │  mark articles SENT
                                 │  update ExecutionLog
```

## Setup

### Prerequisites

- Node.js ≥ 18
- PostgreSQL database (e.g. [Neon](https://neon.tech))
- Redis instance (e.g. [Upstash](https://upstash.com))
- Telegram Bot Token (create one via [@BotFather](https://t.me/BotFather))

### Installation

```bash
git clone <repo-url>
cd dev-digest-courier
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# PostgreSQL (Neon recommended)
DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require"

# Redis -- either REDIS_URL or all of HOST+PORT+PASSWORD
REDIS_URL="redis://default:password@host:port"
# REDIS_HOST="your-host.upstash.io"
# REDIS_PORT=6379
# REDIS_PASSWORD="your-password"
# REDIS_TLS=true

# Telegram
TELEGRAM_BOT_TOKEN="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"

# Optional
# TELEGRAM_WEBHOOK_URL="https://your-domain.com"   # omit for poll mode
# NGROK_AUTHTOKEN="your-ngrok-token"                # auto-tunnel in dev
# DIGEST_CRON="0 8 * * *"                           # default: 8 AM UTC
# DIGEST_MAX_ARTICLES=10                             # default: 10
```

### Database Setup

```bash
npx prisma generate
npx prisma db push
```

### Running

Development (two terminals):

```bash
# Terminal 1: API server
npm run dev:api

# Terminal 2: Worker process
npm run dev:worker
```

Production build:

```bash
npm run build
npm run start:api
npm run start:worker
```

## Telegram Bot

### Commands

| Command | Description |
|---|---|
| `/start` | Register as a subscriber |
| `/subscribe` | Subscribe to all available topics |
| `/status` | View your current topic subscriptions |
| `/logs` | View the last 3 digest execution logs |
| `/retry` | Manually trigger a new digest |
| `/help` | Show available commands |

### Digest Message

Subscribers receive a daily digest formatted like this:

```
📬 *Daily Dev Digest*

1\. [Show HN: A New JavaScript Framework](https://news.ycombinator.com/item?id=12345)
   🏷️ HackerNews | ✍️ johndoe
2\. [Understanding TypeScript 5\.8 Generics](https://dev.to/article/typescript-generics)
   🏷️ DevTo | ✍️ janedoe
3\. [Python 3\.13 Performance Deep Dive](https://example.com/python-perf)
   🏷️ HackerNews | ✍️ perfguru
...
```

Messages are automatically split into multiple parts if they exceed Telegram's character limit, labeled `(Part 1/2)`, `(Part 2/2)`, etc.

## Admin API

### Manual Trigger

```bash
curl -X POST http://localhost:3000/api/v1/admin/trigger-digest
```

### Health Check

```bash
curl http://localhost:3000/api/v1/health
# {"status":"healthy"}
```

## Project Structure

```
src/
├── index.ts                          # API server entry point
├── worker.ts                         # Worker process entry point
├── config/
│   └── env.ts                        # Zod env validation
├── lib/
│   ├── redis.ts                      # Redis connection builder
│   ├── prisma.ts                     # Prisma client singleton
│   ├── queues.ts                     # BullMQ queue factories
│   ├── scheduler.ts                  # CRON repeatable job setup
│   └── shutdown.ts                   # Graceful shutdown
├── services/
│   ├── telegram.service.ts           # Telegraf bot wrapper
│   └── fetcher.service.ts            # HackerNews + Dev.to fetchers
├── workers/
│   ├── digest-trigger.worker.ts      # Stage 1: fetch articles
│   ├── article-processor.worker.ts   # Stage 2: dedup + persist
│   └── telegram-dispatch.worker.ts   # Stage 3: format + send
├── utils/
│   ├── formatter.ts                  # MarkdownV2 escape + chunk
│   └── hash.ts                       # SHA-256 URL hash
├── api/routes/
│   └── health.ts                     # Health check endpoint
└── routes/
    ├── index.ts                      # Route aggregator
    ├── admin.routes.ts               # Manual trigger
    └── telegram.routes.ts            # Bot commands + webhook
prisma/
└── schema.prisma                     # Database schema
```

## Database Schema

| Model | Purpose |
|---|---|
| `Source` | News sources (HackerNews, DevTo) |
| `Topic` | Programming categories |
| `Article` | Fetched articles with status tracking |
| `ArticleTopic` | Article ↔ Topic many-to-many |
| `Subscriber` | Telegram users |
| `SubscriberTopic` | Subscriber ↔ Topic many-to-many |
| `ExecutionLog` | Digest run audit trail |