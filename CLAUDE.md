# CLAUDE.md

## Project Overview

Sirona Tender Intelligence Dashboard — a React SPA that tracks NHS/public sector procurement opportunities for Sirona Care & Health CIC in the BNSSG region. Uses Claude AI for strategic fit analysis and UK government APIs for live tender data.

## Tech Stack

- **Frontend:** React 18 (JSX, hooks, no TypeScript)
- **Build:** Vite 6, Node.js 20
- **Styling:** Plain CSS with custom properties (no preprocessors/frameworks)
- **APIs:** Anthropic Claude (`claude-sonnet-4-20250514`), Contracts Finder, Find a Tender Service
- **Deploy:** GitHub Pages via GitHub Actions

## Project Structure

```
src/
  App.jsx              # Main component — all UI, state, filtering, sorting, modals
  App.css              # Application styles
  main.jsx             # React entry point
  index.css            # Global styles and CSS variables
  data/
    tenders.js         # Sample tender dataset (10 NHS opportunities)
  services/
    claudeAnalyzer.js  # Claude API integration (key mgmt, analysis, batch processing)
    tenderFetcher.js   # Live data fetching, parsing, caching, deduplication
```

## Commands

```bash
npm run dev      # Start dev server (localhost:5173)
npm run build    # Production build to ./dist
npm run preview  # Preview production build
```

No test or lint scripts are configured.

## Environment Setup

Copy `.env.example` to `.env` and set:
```
VITE_ANTHROPIC_API_KEY=your_api_key_here
```

The API key can also be entered at runtime via the dashboard UI (stored in localStorage).

## Architecture & Patterns

- **Single-page app** with no routing — all state in App.jsx via `useState`/`useMemo`
- **Service modules** (`claudeAnalyzer.js`, `tenderFetcher.js`) handle all external API calls
- **Two data modes:** sample data (static) and live data (fetched from government APIs)
- **Caching:** sessionStorage with 5-min TTL for API responses; localStorage for user preferences and API keys
- **CORS proxy** (`corsproxy.io`) wraps government API calls
- **Rate limiting:** 500ms between Claude calls, 1s between government API calls

## Code Conventions

- Functional React components with hooks (one class-based ErrorBoundary)
- JSDoc comments for documentation (no TypeScript types)
- BEM-like CSS class naming
- CSS custom properties for theming (`--sirona-purple`, etc.)
- WCAG AA accessibility: ARIA labels, semantic HTML, keyboard navigation, skip links
- All async operations wrapped in try/catch with user-friendly error messages
- No external state management (no Redux/Context) — component-level state only

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) triggers on push to `main`/`master`:
1. `npm ci` → `npm run build`
2. Deploy `./dist` to GitHub Pages

## Key Files to Know

| File | Purpose |
|---|---|
| `src/App.jsx` | All UI logic, state management, filtering, sorting, export (~1200 lines) |
| `src/services/claudeAnalyzer.js` | Claude API wrapper: key management, single/batch analysis, cost estimation |
| `src/services/tenderFetcher.js` | Government API fetching, response parsing, data normalization, caching |
| `src/data/tenders.js` | Static sample tender data for offline/demo use |
| `vite.config.js` | Vite config with GitHub Pages base path |
