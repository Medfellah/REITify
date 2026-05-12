export type ExtractionId =
  | "tenant_concentration"
  | "geographic_exposure"
  | "debt_maturity"
  | "lease_expirations"

// ── Visualization row types ────────────────────────────────────────────────

export interface TenantRow {
  rank: number
  name: string
  sqftM?: number
  pct: number
}

export interface GeoL2Row {
  market: string
  sqftM: number
  gbvM: number           // O&M GBV in $M
  consolidatedGBVM?: number // consolidated GBV in $M
}

export interface GeoRow {
  region: string
  gbvM: number       // consolidated GBV in $M (kept for compat)
  sqftM?: number     // consolidated sq ft in millions
  omGBVM?: number    // O&M GBV in $M
  omPct?: number     // % of total O&M portfolio
  children?: GeoL2Row[]
}

export interface DebtRow {
  year: string
  amountK: number         // Total column
  seniorK?: number        // Senior notes column
  termLoanK?: number | null // Term loans column (null = "—")
}

export interface LeaseRow {
  year: string
  sqftM: number
  nerM: number
  pct: number
  psf?: number  // $ per sq ft
}

// ── Extraction result ──────────────────────────────────────────────────────

export interface ExtractionResult {
  id: ExtractionId
  title: string
  data: string | null
  citation: string | null
  section: string | null
  tableRef: string | null     // "Table name, period" for source block line 2
  unit: string | null
  footnote: string | null
  error: string | null
  // Structured visualization data
  tenantRows?: TenantRow[]
  tenantTop10Pct?: number
  tenantTop25Pct?: number
  geoRows?: GeoRow[]
  californiaNOIPct?: number
  californiaGBVM?: number
  debtRows?: DebtRow[]
  leaseRows?: LeaseRow[]
  lease24mSqftM?: number
  lease24mNerM?: number
  lease24mPct?: number
  // API metadata
  tokensIn?: number
  tokensOut?: number
}

// ── Filing metadata (company card) ────────────────────────────────────────

export interface FilingMeta {
  ticker: string
  companyName: string
  exchange: string
  filingType: string   // "10-K"
  fiscalYear: string   // "FY2024"
  filingDate: string   // "Feb 14, 2025"
}

// ── Run statistics ─────────────────────────────────────────────────────────

export interface RunStats {
  durationMs: number
  model: string
  totalTokensIn: number
  totalTokensOut: number
}

// ── Misc ───────────────────────────────────────────────────────────────────

export interface Section {
  name: string
  content: string
}

// ── SSE payload ───────────────────────────────────────────────────────────

export type SSEPayload =
  | { type: "filing_meta"; meta: FilingMeta }
  | { type: "extraction_start"; id: ExtractionId }
  | { type: "extraction_result"; id: ExtractionId; result: ExtractionResult }
  | { type: "fatal"; message: string }
  | { type: "done"; stats: RunStats }
