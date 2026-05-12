# REITify — Technical Architecture

## Overview

REITify is a Next.js 15 application that extracts structured financial data from REIT 10-K SEC filings using Claude as an extraction engine. A user pastes a SEC EDGAR filing URL; the app fetches and parses the HTML, navigates to specific sections via text anchors, runs four parallel LLM extractions, and streams results back to the browser via Server-Sent Events.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| LLM | Anthropic Claude (`claude-sonnet-4-6`) |
| Deployment | Vercel (serverless, `maxDuration: 300s`) |
| Testing | Vitest |

---

## Directory Structure

```
app/
  page.tsx               # Main UI — state, SSE stream consumer, export logic
  api/analyze/route.ts   # POST handler — orchestrates the full pipeline
components/
  ResultCard.tsx         # All four visualization cards + shared UI primitives
  CompanyCard.tsx        # Filing metadata header (ticker, company, fiscal year)
  RunStatsBar.tsx        # Post-run stats (duration, model, token counts)
  UrlInput.tsx           # URL input field with submit button
lib/
  fetch-filing.ts        # URL validation, HTML fetch, HTML-to-text cleaning
  extract-meta.ts        # DEI XBRL parsing + EDGAR submissions API for filing date
  anchor-nav.ts          # Text anchor-based section extraction
  extract.ts             # Extraction configs, LLM calls, retry logic, response parsing
types/
  index.ts               # All shared TypeScript interfaces
__tests__/
  anchor-nav.test.ts     # Integration tests against real Prologis 2024 10-K
  live-prologis.test.ts  # End-to-end LLM extraction tests (requires API key)
vercel.json              # maxDuration: 300
vitest.config.ts         # loadEnv from "vite" (not "vitest/config")
```

---

## Data Flow

```
Browser                          API Route (/api/analyze)
───────                          ────────────────────────
POST { url }          ──────►   validateFilingUrl()
                                 fetchRaw()                    ──► SEC EDGAR HTML
                                 extractFilingMeta()           ──► DEI XBRL + Submissions API
SSE: filing_meta      ◄──────   emit filing_meta
                                 cleanHtml()
                                 ┌─ extractByAnchor(tenant)
                                 ├─ extractByAnchor(geo)       ── text sections
                                 ├─ extractByAnchor(debt)
                                 └─ extractByAnchor(lease)
                                 runExtraction × 4 (parallel)  ──► Anthropic API
SSE: extraction_result◄──────   emit per extraction (as each completes)
SSE: done + RunStats  ◄──────   emit done
```

The API route returns a `ReadableStream` (`text/event-stream`). Each SSE payload is a JSON-serialized union type (`SSEPayload`). The browser parses the stream incrementally, updating React state card-by-card as results arrive.

---

## Extraction Pipeline

### 1. HTML Fetch (`lib/fetch-filing.ts`)
- URL validated against `https://www.sec.gov` or `https://sec.gov` only
- Fetched with a `User-Agent` header (SEC requires one)
- Raw HTML returned for meta extraction before cleaning

### 2. Filing Metadata (`lib/extract-meta.ts`)
- Parses `ix:nonNumeric` XBRL elements from the raw HTML to extract:
  - `dei:TradingSymbol` → ticker
  - `dei:EntityRegistrantName` → company name
  - `dei:SecurityExchangeName` → exchange
  - `dei:DocumentFiscalYearFocus` → fiscal year
- Filing date fetched separately from the EDGAR Submissions API:
  `https://data.sec.gov/submissions/CIK{padded10}.json`
  matched by accession number extracted from the filing URL

### 3. HTML Cleaning (`lib/fetch-filing.ts` → `cleanHtml`)
- Strips `<nav>`, `<script>`, `<style>`, `<header>`, `<footer>` elements
- Converts block elements (`<table>`, `<p>`, `<h1>`–`<h6>`, `<tr>`, `<td>`) to newlines/spaces
- Decodes HTML entities
- Normalizes whitespace and blank lines

### 4. Section Extraction (`lib/anchor-nav.ts`)
- `extractByAnchor(cleanText, { startText, stopText, maxChars })` slices the text between two anchor strings
- Default `maxChars = 50,000` characters per section
- Anchors are exact strings (including surrounding newlines) verified to appear uniquely in the Prologis 2024 10-K

Current anchors:
| Extraction | startText | stopText |
|---|---|---|
| Tenant Concentration | `"Customers\n\n"` | `"Our People\n\n"` |
| Geographic Exposure | `"GEOGRAPHIC DISTRIBUTION\n\n"` | `"LEASE EXPIRATIONS\n\n"` |
| Debt Maturity | `"Long-Term Debt Maturities\n\n"` | `"Interest Expense\n\n"` |
| Lease Expirations | `"LEASE EXPIRATIONS\n\n"` | `"CO-INVESTMENT VENTURES\n\n"` |

### 5. LLM Extraction (`lib/extract.ts`)
- One `messages.create` call per section
- `max_tokens: 8192` (model maximum; SDK requires the field)
- Prompt instructs Claude to return ONLY a valid JSON object with typed arrays
- Response parsed with a regex `\{[\s\S]*\}` match + `JSON.parse`
- Retry logic: up to 4 attempts, exponential backoff (`2^attempt × 1s`), retries only on HTTP 529 or 503

### 6. SSE Streaming (`app/api/analyze/route.ts`)
- Extractions run in parallel via `Promise.all`
- Each result emitted immediately as `data: {...}\n\n` on the `ReadableStream`
- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`
- `maxDuration: 300` in `vercel.json` to allow full pipeline completion

---

## Component Architecture

### `app/page.tsx`
Manages all client state:
- `cards`: `Record<ExtractionId, { status: "idle"|"loading"|"done", result: ExtractionResult|null }>`
- `filingMeta`, `runStats`, `fatalError`, `viewMode` ("visual" | "text")
- SSE stream consumed in `handleAnalyze()` with `ReadableStreamDefaultReader`
- `buildTextBody()` serializes all card results to plain text for `.txt` export
- `handleExportPDF()` = `window.print()` (browser native Save as PDF)
- `SegmentedControl` toggles between the 2×2 visual grid and a `<pre>` text block

### `components/ResultCard.tsx`
Four visualization cards dispatched by `ExtractionId`:

**TenantCard**
- HTML `<table>`: `# | Tenant | Sq Ft | % NER`
- `% NER` cell: inline SVG-style bar (`w-14 h-1.5 bg-slate-100`) + tabular number
- Default: first 10 rows; "Show N more tenants" / "Show less" toggle via `expanded` state
- 4 metric boxes below (top 10%, top 25%, total tenants, total sq ft) always visible

**GeoCard**
- `OM_REGIONAL_TOTAL` constant (hardcoded O&M GBV by region) for consistent % computation
- `GEO_COLORS` map: U.S. → blue, Europe → green, Asia → amber, Other Americas → purple
- HTML `<table>` for region rows with color dot + `<tr colSpan=5>` for L2 market rows
- L2 shows Consolidated GBV + O&M GBV where available
- `DonutChart` SVG (160×160px, r=58, strokeWidth=30): `stroke-dasharray`/`stroke-dashoffset` technique; segments drawn clockwise from 12 o'clock; `%` labels on arcs ≥7%; "GBV" center label
- `openRegion` accordion state for L2 expansion

**DebtCard**
- 4-column table: Year / Senior Notes / Term Loans / Total
- `hasSenior` flag hides optional columns if data absent
- `fmtAmt()` returns "—" for `null` termLoanK
- Blue footnote box (`bg-blue-50`) for extension option notes

**LeaseCard**
- `dataRows` filtered: rows where `nerM != null && nerM !== 0 && pct != null && pct !== 0`
- Total row rendered separately as a footer
- Optional $/sq ft column when `psf` present
- 24-month summary bar (sqftM + NER + % of portfolio)

---

## Key Design Decisions

### SSE over polling
Extractions take 20–60 seconds. SSE allows cards to populate incrementally as each LLM call completes, giving users progressive feedback instead of a blank wait followed by a full-page render.

### Anchor-based section extraction over semantic chunking
The 10-K HTML is large (~3–5MB). Rather than chunking the full document and running retrieval, text anchors navigate directly to known section boundaries. This is deterministic, fast, and avoids embedding costs — but is filing-layout-dependent (see Limitations).

### Structured JSON responses over free-text parsing
Prompts instruct Claude to return typed JSON arrays (`tenantRows`, `geoRows`, `debtRows`, `leaseRows`). This enables rich visualizations (donut chart, progress bars, sortable tables) without a second parsing step.

### Hardcoded `OM_REGIONAL_TOTAL`
The LLM may return slightly different regional O&M GBV totals across runs (rounding, partial table parsing). To ensure L2 percentages are consistent and sum correctly within each region, the denominator is hardcoded per Prologis 2024 10-K data. This breaks for other filers.

### `window.print()` for PDF export
Avoids bundling jsPDF or Puppeteer. The browser's native print-to-PDF produces a faithful layout render. No additional server-side infrastructure required.

### HTML `<table>` for data tables
Early iterations used CSS grid with per-row `grid-cols-*`. Because each row is an independent grid container, column widths are computed independently — causing misalignment on values of different widths. `<table>` shares a single layout context and aligns columns correctly.

---

## Trade-offs and Limitations

### Prologis-specific anchors
The section anchors (`"Customers\n\n"`, `"GEOGRAPHIC DISTRIBUTION\n\n"`, etc.) were verified against the Prologis 2024 10-K. Other REITs use different section headings, ordering, and formatting. Running the app on a non-Prologis filing will likely result in empty sections and "Could not locate" errors for most extractions.

**Mitigation path:** Replace anchor-based extraction with a semantic section detector (heading regex scan + cosine similarity ranking against section titles) that generalizes across filers.

### SEC EDGAR only
URL validation rejects anything outside `sec.gov`. This prevents use with S&P Global Comstock, Bloomberg terminal exports, or direct PDF uploads.

### No caching
Every submission fetches and processes the full filing from scratch. There is no memoization at the URL, section, or extraction level. Repeated runs on the same URL cost the same time and tokens.

### 529 / API overload risk
The four LLM calls are concurrent. During Anthropic API overload events (HTTP 529), all four calls may hit the retry path simultaneously, extending total run time to 2–4× normal. The retry budget is 4 attempts with up to 8s delay each.

### Token ceiling
`max_tokens: 8192` is the model's maximum output. Filings with very large tables (>25 tenants with verbose names, debt schedules spanning 10+ years) may still hit truncation, producing malformed JSON that `parseLLMResponse` cannot parse.

### No user authentication
The app is stateless and publicly accessible. There is no rate limiting or API key isolation per user. The Anthropic API key is a single shared credential in the Vercel environment.

### Vercel 300s function timeout
The `maxDuration: 300` setting is the Vercel maximum for serverless functions. Very slow EDGAR servers or API retry storms could push total pipeline time past this limit, causing a gateway timeout with no partial results delivered.

### LLM hallucination risk
Despite the system prompt and verbatim-citation requirement, Claude may occasionally fabricate or misread numbers. The citation block in each card is intended to let analysts verify extracted data against the source text — but the verification step is manual.

---

## Testing

| File | Type | Notes |
|---|---|---|
| `__tests__/anchor-nav.test.ts` | Integration | Fetches real Prologis 2024 10-K, asserts all 4 anchors resolve to non-empty sections |
| `__tests__/live-prologis.test.ts` | End-to-end | Full LLM extraction on real filing; requires `ANTHROPIC_API_KEY` in `.env.local` |

`vitest.config.ts` uses `loadEnv` from `"vite"` (not `"vitest/config"`) to load `.env.local` — a distinction that matters for Vercel builds where the wrong import causes a TypeScript compile error.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Authenticates Anthropic SDK calls in the API route |

---

## Deployment

Deployed to Vercel. `vercel.json` sets `maxDuration: 300` for the API route. No build-time environment variables required beyond `ANTHROPIC_API_KEY` at runtime.
