# URL Shortener Service

A production-style REST API for shortening URLs, built with **Node.js, Express 5, TypeScript 7, and MongoDB**.

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7.0-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/license-ISC-blue.svg)

## Overview

Post a long URL, get back an 11-character shareable link, and `GET` that link to be redirected to the original destination.

Beyond the core shortening flow, the service is built to production standards:

- **Strict TypeScript** across the entire codebase (`strict: true`, no implicit `any`)
- **Structured logging** with pino — pretty in development, JSON in production
- **A single, uniform error envelope** (`{ "err": "..." }`) for every failure the API can return
- **Per-IP rate limiting** with standard `RateLimit` headers, blocking at the middleware layer before any controller runs
- **Graceful shutdown** that drains in-flight requests and closes MongoDB cleanly on `SIGINT`/`SIGTERM` and on crash paths
- **A real build pipeline** — `tsc` to plain JavaScript, runs on vanilla `node`, no runtime transpiler in production

## Tech Stack

| Layer      | Choice                         |
| ---------- | ------------------------------ |
| Runtime    | Node.js 22+                    |
| Language   | TypeScript 7 (native compiler) |
| Framework  | Express 5                      |
| Database   | MongoDB via Mongoose 9         |
| Logging    | pino 10 + pino-pretty (dev)    |
| Rate limiting | express-rate-limit 8        |
| Transpiler | tsx (development only)         |

## Quick Start

### Prerequisites

- Node.js 22 or newer
- MongoDB running locally on `mongodb://localhost:27017` (or any reachable URI)

### Installation

```bash
git clone https://github.com/MostafaAzqandi/UrlShortener
cd urlshortener
npm install
```

### Configuration

Create a `.env` file in the project root:

```dotenv
PORT=6066
BASE_URL=http://localhost:6066
MONGO_URI=mongodb://localhost:27017/urlshortener-service-dev
LOG_LEVEL=info

# Optional — rate limiting overrides (defaults: 100 requests / 15 minutes)
# RATE_LIMIT_MAX=100
# RATE_LIMIT_WINDOW_MS=900000

# Optional — enables JSON logs and 500-message redaction
# NODE_ENV=production
```

| Variable    | Purpose                                             | Required |
| ----------- | --------------------------------------------------- | -------- |
| `PORT`      | HTTP listen port (defaults to `5000` if unset)      | Yes      |
| `BASE_URL`  | Prefix for generated short links                    | Yes      |
| `MONGO_URI` | MongoDB connection string (fails fast if missing)   | Yes      |
| `LOG_LEVEL` | pino level (`fatal`/`error`/`warn`/`info`/`debug`)  | No       |
| `RATE_LIMIT_MAX` | Requests allowed per window (default `100`)    | No       |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window in ms (default `900000`) | No       |
| `NODE_ENV`  | Set to `production` for JSON logs and error hiding  | No       |

### Run

```bash
# Development — watch mode with pretty logs
npm run dev

# Production build
npm run build
npm run start:prod
```

### Scripts

| Script            | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | `tsx watch app.ts` — dev server, reloads on change |
| `npm run build`   | `tsc` — type-checks and emits JS to `dist/` |
| `npm run start:prod` | Runs the built output on vanilla `node` |
| `npm run typecheck`  | `tsc --noEmit` — types only, no output  |

## API Reference

### `POST /shorten`

Create a short link.

```bash
curl -X POST http://localhost:6066/shorten \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/some/very/long/path"}'
```

```json
201 Created
"http://localhost:6066/Kz8fQm2WpXa"
```

The body is the complete short URL as a JSON string. Slugs are **11 characters of URL-safe base64**, generated from `crypto.randomBytes(8)` and enforced unique by a MongoDB index.

### `GET /:slug`

Follow a short link.

```bash
curl -i http://localhost:6066/Kz8fQm2WpXa
```

```http
HTTP/1.1 302 Found
Location: https://example.com/some/very/long/path
```

### `GET /health`

Liveness probe for load balancers and uptime monitors.

```json
{
  "status": "success",
  "process": "api",
  "timestamp": "2026-10-23T09:28:42.114Z"
}
```

### Errors

Every failure — validation, routing, or crash — returns the same envelope:

```json
{ "err": "Slug not found" }
```

| Condition                       | Status | `err`                                        |
| ------------------------------- | ------ | -------------------------------------------- |
| Missing or empty `url`          | 400    | `Enter a URL`                                |
| Unparseable URL                 | 400    | `Must be a valid http(s) URL`                |
| Non-HTTP(S) protocol (e.g. `javascript:`) | 400 | `Only http and https URLs are allowed` |
| Unknown slug                    | 404    | `Slug not found`                             |
| Unknown route                   | 404    | `Route not found`                            |
| Rate limit exceeded             | 429    | `Too many requests - try again later`        |
| Unexpected server error         | 500    | `Internal server error` (original message only shown outside production) |

URL validation is applied **twice by design**: in the controller (fast client feedback, before touching the database) and again in the Mongoose schema validator (the persistence layer's own guarantee).

### Rate Limiting

Every request except `GET /health` (kept free for load balancers) passes through a per-IP fixed-window limiter:

- Limits are configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`
- Allowed and blocked responses carry standard `RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` headers, plus `Retry-After` on 429s
- Blocked requests get the uniform `{ "err": "..." }` envelope and a structured `WARN` log with the offending IP

## Error Handling

All errors funnel through a single Express error middleware (`configs/errors.ts`):

1. **Classification** — mongoose `ValidationError` maps to 400, errors carrying a numeric `statusCode` honor it, everything else is 500.
2. **Redaction** — 5xx messages are hidden in production (raw Mongo errors can leak internals); shown in development for debugging.
3. **Single log point** — the error is logged exactly once, as structured JSON with name, message, stack, method, and URL. Controllers call `next(error)` and stay silent — no duplicate logging at every call site.
4. **Safety** — a `res.headersSent` guard delegates to Express's final handler if a response already started streaming, so the error middleware can never crash while handling a crash.

## Graceful Shutdown

On `SIGINT`, `SIGTERM`, `uncaughtException`, or `unhandledRejection`, the service drains instead of dying mid-request:

1. Re-entry guard — a second signal during shutdown is ignored (no racing double-shutdowns)
2. 15-second force-exit timer is armed (`.unref()`'d) as a deadlock safety net
3. `httpServer.close()` — stops accepting **new** connections
4. `closeIdleConnections()` — immediately drops **idle keep-alive sockets** that would otherwise block the drain forever
5. Await in-flight requests to finish — the process stays alive until every open response completes
6. Close the MongoDB connection pool — **after** the HTTP drain, so draining requests can still query the database
7. Exit `0` on success, `1` on any failure or timeout

The shutdown sequence is fully logged (`signal → closing → idle closed → drained → mongo closed → complete`), so operators can verify the order in production logs.

## Project Structure

```
.
├── app.ts                    # Bootstrap: routes, middleware order, server startup
├── configs/
│   ├── database.ts           # Mongo connection + lifecycle event logging
│   ├── errors.ts             # Central error middleware
│   ├── logger.ts             # pino setup (pretty in dev, JSON in prod)
│   ├── rate.ts               # Per-IP rate limiter (express-rate-limit)
│   └── shutdown.ts           # Graceful shutdown: drain + force-exit timer
├── controllers/
│   └── URLController.ts      # createUrl, redirectToUrl
├── models/
│   └── URLModel.ts           # Schema: url (validated), slug (unique), timestamps
├── utils/
│   └── slugGenerator.ts      # crypto.randomBytes(8) → 11-char base64url slug
├── tsconfig.json
└── package.json
```

## Design Notes

- **`module: NodeNext` in tsconfig** — the compiler emits CommonJS, so the build runs on plain `node dist/app.js` with no runtime transpiler in production, while extensionless relative imports stay valid.
- **Slugs before queries** — a randomly generated slug is written once; MongoDB's unique index is the final arbiter of collisions.
- **Bootstrap fails fast** — missing `MONGO_URI` or a failed connection logs at `fatal` level and exits `1` before the server ever accepts traffic.
- **Middleware order is load-bearing** — JSON body parser → routes → 404 catch-all → error handler; the 404 handler sits before the error middleware so unmatched routes return JSON, not HTML.

## Roadmap

- Click counter per slug and a `GET /stats/:slug` endpoint
- Retry-on-collision for slug generation
- Automated test suite

## License

ISC
