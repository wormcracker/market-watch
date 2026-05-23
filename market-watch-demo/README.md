# Market Watch — Live Demo

> **Live Demo →** `https://wormcracker.github.io/market-watch/`

An interactive frontend demo of the [Market Watch](../README.md) NEPSE portfolio and monitoring platform. Runs entirely in the browser — no backend required. All data is seeded from real NEPSE values and stored in your browser's `localStorage`.

---

## What works in the demo

| Feature                                    |     Demo     | Full build |
| ------------------------------------------ | :----------: | :--------: |
| Dashboard — NAV, P&L, allocation charts    |      ✅      |     ✅     |
| Portfolio — positions table, capital tab   |      ✅      |     ✅     |
| Trades — history table, monthly P&L chart  |      ✅      |     ✅     |
| Stocks — watchlist with cap groups, expand |      ✅      |     ✅     |
| Upload CSV → live price update             |      ✅      |     ✅     |
| Theme switcher (11 themes)                 |      ✅      |     ✅     |
| Persistent localStorage data               |      ✅      |     ✅     |
| Watchers — view sample watches & alerts    | 👁️ read-only |     ✅     |
| Create / edit / run watchers               |      🔒      |     ✅     |
| Add trades                                 |      🔒      |     ✅     |
| Google Sheets sync                         |      🔒      |     ✅     |
| Live WebSocket price feed                  |      🔒      |     ✅     |
| Notification channels                      |      🔒      |     ✅     |
| Settings — watcher / nepse / stocks        |      🔒      |     ✅     |

---

## Uploading real prices (CSV)

1. Go to **[nepalstock.com/today-price](https://www.nepalstock.com/today-price)**
2. Download the today-price CSV
3. Click **Upload CSV** in the top bar of the demo
4. Prices update instantly — portfolio values recalculate automatically

The parser reads these columns from the official NEPSE format:

```
Symbol, Close Price, Open Price, High Price, Low Price
```

---

## Running locally

```bash
# From the repo root
cd market-watch-demo
npm install --legacy-peer-deps
npm run dev
```

Opens at `http://localhost:3000`.

---

## Tech stack (demo only)

- **Next.js 15** — static export (`output: "export"`)
- **React 19** + TypeScript
- **Tailwind CSS v4**
- **Zustand** — in-memory state
- **Recharts** — charts
- **localStorage** — all persistence (no backend)
- **Lucide React** — icons

---

## Data reset

In the demo, go to **Settings** and click **Reset to Seed Data** to restore all placeholder data.

Or clear `localStorage` manually in DevTools:

```js
// Browser console
Object.keys(localStorage)
  .filter((k) => k.startsWith("mw_demo"))
  .forEach((k) => localStorage.removeItem(k));
location.reload();
```

---

## Full build

See the [main README](../README.md) for instructions on running the complete platform with:

- Live NEPSE market data
- Google Sheets portfolio sync
- Condition-based watcher engine
- Multi-channel notifications
