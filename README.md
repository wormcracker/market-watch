<div align="center">
  <img src="./market-watch-ui/public/favicon.svg" width="80" height="80" alt="Folio" />
  <h1>MarketWatch</h1>

[LIVE DEMO](https://wormcracker.github.io/market-watch/)

</div>

A personal NEPSE (Nepal Stock Exchange) market monitoring platform built with TypeScript and Node.js. Tracks live prices, manages a stock portfolio backed by Google Sheets, and fires configurable alerts via a condition-based watcher engine.

> **Note:** This project was built as a personal learning vehicle to develop backend and systems-level engineering skills. The live-data fetching layer uses unofficial third-party sources that have been intentionally removed from this repository. See [Live Market Data](#live-market-data) for how to get price data into the system.

---

## Screenshots

<p align="center">
  <img src="./docs/screenshot_1.png" width="45%" />
  <img src="./docs/screenshot_2.png" width="45%" />
</p>
<p align="center">
  <img src="./docs/screenshot_3.png" width="45%" />
  <img src="./docs/screenshot_4.png" width="45%" />
</p>

## Architecture

The project is a monorepo with two packages and a shared `package.json` at the root to run both concurrently.

```
market-watch/
├── core-server/          # Express backend — port 3020
│   └── src/modules/
│       ├── nepse-data/   # Market data engine, scheduler, WebSocket broadcast
│       ├── watchers/     # Condition-based alert engine
│       └── stock-management/  # Portfolio tracker (Google Sheets)
└── market-watch-ui/      # Next.js frontend — port 3021
```

### Module 1 — `nepse-data`

The single source of truth for live NEPSE data. Runs a smart scheduler that only polls within configured market windows, maintains a two-level cache (memory + disk), and broadcasts updates over WebSocket on the same HTTP port.

Key features:

- Tri-state market-state tracker (open / closed / unknown)
- Recursive `setTimeout` scheduler with per-slot intervals and sub-slots
- Fallback orchestrator: live source → memory cache → disk cache
- Settings with live reload and backup-on-corruption
- WebSocket broadcast shared with HTTP port

### Module 2 — `watchers`

A generic condition-based watching engine. Watches can target NEPSE stocks (event-driven via the Observer pattern) or arbitrary URLs (HTTP/WebSocket/Puppeteer).

Key features:

- 17-condition evaluator with discriminated union types
- Three fetch engines: axios/cheerio HTTP, WebSocket with exponential backoff, Puppeteer with lazy browser singleton
- Six notification channels with parallel dispatch
- Semaphore-based scheduler with per-watch execution locks
- NEPSE watches triggered via shared event bus (no polling)

### Module 3 — `stock-management`

Google Sheets-backed portfolio tracker with NEPSE-specific commission and tax logic.

Key features:

- WACC calculation and FIFO lot tracking
- NEPSE commission tiers and 7.5% Capital Gains Tax on gross profit
- Five sheets: `Journal_Log`, `Stocks`, `Capital Summary`, `Capital Retained`, `Promoter-LockIn`
- LTP layer driven by WebSocket pushes from `nepse-data` + manual CSV upload
- Google Service Account OAuth2

---

## Requirements

- Node.js ≥ 20
- npm ≥ 10
- A Google Cloud project with the Sheets API enabled (for `stock-management`)

---

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/wormcracker/market-watch.git
cd market-watch
```

### 2. Install root dependencies

```bash
npm install
```

### 3. Install backend dependencies

```bash
cd core-server
npm install
```

### 4. Install frontend dependencies

```bash
cd ../market-watch-ui
npm install
```

---

## Environment Setup

### Backend — `core-server/.env`

Copy the example and fill in your values:

```bash
cp core-server/.env.example core-server/.env
```

```env
# Server
SERVER_PATH="http://localhost"
PORT=3020
NODE_ENV=development

# Google Sheets (stock-management module)
# See: https://console.cloud.google.com/apis/credentials
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
SPREADSHEET_ID=your-google-spreadsheet-id

# Watchers — sound notifications (optional)
SOUND_DIR=./sounds/custom-sounds

# KDE Connect — optional mobile push notifications
# KDE_CONNECT_DEVICE_ID=your-device-id
# KDE_CONNECT_USER=your-username
```

### Frontend — `market-watch-ui/.env`

```bash
cp market-watch-ui/.env.example market-watch-ui/.env
```

```env
PORT=3021
BACKEND_URL=http://localhost:3020
```

---

## Google Sheets Setup

The `stock-management` module reads and writes to a Google Spreadsheet. You need a Service Account with Editor access.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Enable **Google Sheets API**.
2. Create a **Service Account** and download the JSON key file.
3. Rename the key file to `service.json` and place it at:
   ```
   core-server/data/stocks/service.json
   ```
   > `service.json` is in `.gitignore` — it will never be committed.
4. Open your Google Spreadsheet, click **Share**, and grant **Editor** access to the service account email.
5. Copy the Spreadsheet ID from the URL (`https://docs.google.com/spreadsheets/d/<ID>/edit`) and set it in `core-server/data/stocks/settings.json`:
   ```json
   {
     "spreadsheetId": "YOUR_SPREADSHEET_ID"
   }
   ```

### Required Sheet Names

The following sheet tabs must exist in your spreadsheet exactly as named:

| Sheet Tab          | Purpose                            |
| ------------------ | ---------------------------------- |
| `Journal_Log`      | All buy/sell entries               |
| `Stocks`           | Stock universe and watchlist flags |
| `Capital Summary`  | Running capital and P&L            |
| `Capital Retained` | Retained earnings log              |
| `Promoter-LockIn`  | Promoter lock-in tracking          |

---

## Live Market Data

The live-data fetching layer (the files that previously scraped unofficial third-party NEPSE sources) has been removed from this repository.

**The recommended approach is to use the official NEPSE CSV:**

1. Go to **[https://www.nepalstock.com/today-price](https://www.nepalstock.com/today-price)**
2. Download the daily price CSV.
3. Parse and POST it to the LTP injection endpoint:

```
POST http://localhost:3020/api/stocks/ltp/csv
Content-Type: application/json

{
  "rows": [
    {
      "symbol": "NABIL",
      "ltp": 530,
      "chgPct": 0.4,
      "open": 529,
      "high": 530.8,
      "low": 527.9
    }
  ]
}
```

The CSV column mapping from the official file:

| CSV Column    | Field    |
| ------------- | -------- |
| `Symbol`      | `symbol` |
| `Close Price` | `ltp`    |
| `Open Price`  | `open`   |
| `High Price`  | `high`   |
| `Low Price`   | `low`    |
| (derived)     | `chgPct` |

### Wiring Up Your Own Live Source

If you have access to a live NEPSE data API, you can implement it by editing:

- `core-server/src/modules/nepse-data/fetchers/source-a.fetcher.ts`
- `core-server/src/modules/nepse-data/fetchers/source-b.fetcher.ts`

Each file contains full instructions. The fetcher must return a `MarketSnapshot`:

```typescript
{
  fetchedAt: number; // Date.now()
  source: DataSource; // your label from shared/types.ts
  stocks: Record<string, StockEntry>;
}
```

Then add your source label to `fallback_order` in `core-server/config/nepse/settings.json`:

```json
{
  "nepse-data-setting": {
    "fallback_order": ["source-a", "memory_cache", "disk_cache"]
  }
}
```

---

## Running the Project

### Development (both backend + frontend)

```bash
npm run dev
```

This runs `core-server` on port **3020** and `market-watch-ui` on port **3021** concurrently.

### Backend only

```bash
npm run dev:server
```

### Frontend only

```bash
cd market-watch-ui && npm run dev
```

### Production build

```bash
npm run build
npm run start
```

---

## API Reference

The frontend proxies all backend calls through `/api/proxy/[...path]`. Below are the direct backend endpoints (port 3020).

### NEPSE Data

```
GET    /api/nepse/stocks
GET    /api/nepse/stocks/:symbol
GET    /api/nepse/status
GET    /api/nepse/settings
PATCH  /api/nepse/settings
POST   /api/nepse/refresh
GET    /api/nepse/health
```

### Watchers

```
GET    /api/watchers/watches
POST   /api/watchers/watches
GET    /api/watchers/watches/:id
PATCH  /api/watchers/watches/:id
DELETE /api/watchers/watches/:id

POST   /api/watchers/watches/:id/run
POST   /api/watchers/watches/:id/enable
POST   /api/watchers/watches/:id/disable
POST   /api/watchers/watches/:id/mode

GET    /api/watchers/watches/:id/history
GET    /api/watchers/watches/:id/alerts

GET    /api/watchers/alerts
PATCH  /api/watchers/alerts/:id/read

GET    /api/watchers/settings
PATCH  /api/watchers/settings
```

### Stock Management

```
GET    /api/stocks/positions
GET    /api/stocks/positions/:symbol
GET    /api/stocks/watchlist
PATCH  /api/stocks/watchlist/:symbol

GET    /api/stocks/trades
POST   /api/stocks/trades
POST   /api/stocks/trades/preview
PUT    /api/stocks/trades/:tradeId
DELETE /api/stocks/trades/:tradeId

GET    /api/stocks/capital
POST   /api/stocks/capital/add
POST   /api/stocks/capital/retain

GET    /api/stocks/ltp
GET    /api/stocks/ltp/:symbol
GET    /api/stocks/ltp/status
POST   /api/stocks/ltp/csv        ← upload NEPSE CSV here

GET    /api/stocks/summary
GET    /api/stocks/settings
PATCH  /api/stocks/settings
```

### WebSocket

```
ws://localhost:3020/ws
```

Message types:

```typescript
| { type: "connected";      payload: { message: string; snapshot: MarketSnapshot } }
| { type: "market_update";  payload: { source: string; data: Record<string, StockEntry> } }
| { type: "alert_fired";    payload: AlertFiredPayload }
| { type: "pong";           payload: null }
```

---

## Scheduler Configuration

Edit `core-server/config/nepse/settings.json` to control when and how often the scheduler polls:

```json
{
  "nepse-data-setting": {
    "interval": 30,
    "shutdown": false,
    "status_check": false,
    "scheduler": [
      {
        "market_start": "11:00",
        "market_end": "15:00",
        "market_days": [0, 1, 2, 3, 4],
        "interval": 30
      }
    ]
  }
}
```

`market_days` follows JavaScript's `Date.getDay()` convention: `0` = Sunday, `1` = Monday, ... `6` = Saturday. NEPSE trades Sunday through Thursday.

Set `shutdown: true` to disable live fetching entirely and serve only from cache.

---

## Tech Stack

### Backend (`core-server`)

- **Runtime:** Node.js 20 + TypeScript 5
- **Framework:** Express 4
- **WebSocket:** `ws`
- **HTTP client:** `axios`
- **HTML parsing:** `cheerio`
- **Browser automation:** Puppeteer (watchers only)
- **Google Sheets:** `googleapis` + `google-auth-library`
- **Notifications:** `node-notifier`

### Frontend (`market-watch-ui`)

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + Tailwind CSS v4
- **Data fetching:** TanStack Query v5
- **Charts:** Recharts
- **Animation:** Framer Motion
- **Icons:** Lucide React
- **State:** Zustand

---

## License

MIT

---

## Credits

Built by [wormcracker(sushant)](https://github.com/wormcracker) as a personal portfolio and alerting tool for the Nepal Stock Exchange.
