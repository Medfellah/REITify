import Anthropic from "@anthropic-ai/sdk"
import type { ExtractionId, ExtractionResult, TenantRow, GeoRow, DebtRow, LeaseRow } from "@/types"
import type { AnchorSpec } from "@/lib/anchor-nav"

const client = new Anthropic()

export const MODEL_ID = "claude-sonnet-4-6"

const SYSTEM_PROMPT = `You are a financial analyst assistant specializing in REIT SEC 10-K filings. Extract specific data points with precision. Always provide verbatim citations copied word-for-word from the source text. Never fabricate, infer, or paraphrase data that is not explicitly present in the provided text.`

export interface LLMResponse {
  found: boolean
  data: string | null
  citation: string | null
  section: string | null
  tableRef: string | null
  unit: string | null
  footnote: string | null
  // Structured visualization data
  tenantRows?: TenantRow[]
  top10Pct?: number
  top25Pct?: number
  geoRows?: GeoRow[]
  californiaNOIPct?: number
  debtRows?: DebtRow[]
  leaseRows?: LeaseRow[]
  lease24mSqftM?: number
  lease24mNerM?: number
  lease24mPct?: number
}

export interface ExtractionConfig {
  id: ExtractionId
  title: string
  anchorSpec: AnchorSpec
  prompt: string
}

export const EXTRACTION_CONFIGS: ExtractionConfig[] = [
  {
    id: "tenant_concentration",
    title: "Tenant Concentration",
    anchorSpec: {
      startText: "Customers\n\n",
      stopText: "Our People\n\n",
    },
    prompt: `Extract the top tenant concentration data from this REIT 10-K filing section.

Find: The table of top tenants ranked by percentage of annualized base rent (ABR), net effective rent (NER), or total revenues. Prologis and some other REITs use NER rather than ABR.

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Numbered list of top tenants (one per line). Show tenant name, leased square footage if available, and percentage. Example: '1. Amazon.com — 34M sq ft — 6.0%'",
  "unit": "Short label for the metric used, exactly as stated in the filing (e.g. '% of NER' or '% of ABR'). Null if not determinable.",
  "citation": "Exact word-for-word copy of the full table or list from the filing — copy every row",
  "section": "Full section path, e.g. 'Item 1. Business — Customers'",
  "tableRef": "Table name and period, e.g. 'Top Customers Table, December 31, 2024'",
  "footnote": null,
  "tenantRows": [
    {"rank": 1, "name": "Amazon", "sqftM": 34, "pct": 6.0},
    {"rank": 2, "name": "Home Depot", "sqftM": 17, "pct": 2.8}
  ],
  "top10Pct": 15.9,
  "top25Pct": 23.0
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"tableRef":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- Include the full table in the citation, not just one row
- Only return found: true if you have a specific verbatim citation
- tenantRows: include all tenants from the table up to 25, use the consolidated portfolio figures
- sqftM is square feet in millions (integer), pct is percentage of NER/ABR (float)

FILING TEXT:
{text}`,
  },
  {
    id: "geographic_exposure",
    title: "Geographic Exposure",
    anchorSpec: {
      startText: "GEOGRAPHIC DISTRIBUTION\n\n",
      stopText: "LEASE EXPIRATIONS\n\n",
    },
    prompt: `Extract the geographic exposure breakdown from this REIT 10-K filing section.

Find: The table showing portfolio breakdown by geographic region, market, or state. This is typically labelled "Geographic Distribution" and shows Rentable Square Footage and Gross Book Value by region.

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Geographic breakdown, one region per line. Show both consolidated and O&M figures where available.",
  "unit": "Short label for the primary valuation metric (e.g. 'Gross Book Value in $M'). Null if not shown.",
  "citation": "Exact word-for-word copy of the full geographic distribution table from the filing",
  "section": "Full section path, e.g. 'Item 2. Properties — Geographic Distribution'",
  "tableRef": "Table name and period, e.g. 'Geographic Distribution Table, December 31, 2024'",
  "footnote": null,
  "geoRows": [
    {"region": "U.S.", "gbvM": 75770},
    {"region": "Other Americas", "gbvM": 1306},
    {"region": "Europe", "gbvM": 768},
    {"region": "Asia", "gbvM": 406}
  ],
  "californiaNOIPct": 31.8
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"tableRef":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- Include the complete table in the citation
- Only return found: true if you have a specific verbatim citation
- geoRows: use consolidated Gross Book Value figures in millions for the top-level geographic regions only (U.S., Other Americas, Europe, Asia) — not individual markets
- californiaNOIPct: California's percentage of consolidated NOI if stated in the text; null otherwise

FILING TEXT:
{text}`,
  },
  {
    id: "debt_maturity",
    title: "Debt Maturity Schedule",
    anchorSpec: {
      startText: "Long-Term Debt Maturities\n\n",
      stopText: "Interest Expense\n\n",
    },
    prompt: `Extract the debt maturity schedule from this REIT 10-K filing section.

Find: The table of scheduled debt principal payments due by year. Look for "Long-Term Debt Maturities" and "Scheduled principal payments due on our debt for each year."

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Year-by-year debt maturities EXACTLY as they appear in the Total column — one row per line (e.g. '2025: 514,223'). Include the 'Thereafter' and 'Total' rows if present.",
  "unit": "Unit label EXACTLY as stated in the filing header (e.g. 'in thousands'). Shown once as a badge.",
  "citation": "Exact word-for-word copy of the full maturity table from the filing",
  "section": "Full section path, e.g. 'Item 8. Financial Statements — Long-Term Debt Maturities'",
  "tableRef": "Table name and period, e.g. 'Long-Term Debt Maturities, December 31, 2024'",
  "footnote": null,
  "debtRows": [
    {"year": "2025", "amountK": 514223},
    {"year": "2026", "amountK": 2173492},
    {"year": "2027", "amountK": 2010418},
    {"year": "2028", "amountK": 2616044},
    {"year": "2029", "amountK": 3196321},
    {"year": "Thereafter", "amountK": 20939411},
    {"year": "Total", "amountK": 31449909}
  ]
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"tableRef":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- debtRows: use the Total column figures (sum across debt types); amountK is the raw number in whatever unit the table uses (thousands if "in thousands")
- Do NOT add unit labels to individual debtRows — the unit field handles that
- Include "Total" row in debtRows if present

FILING TEXT:
{text}`,
  },
  {
    id: "lease_expirations",
    title: "Material Lease Expirations (Next 24 Months)",
    anchorSpec: {
      startText: "LEASE EXPIRATIONS\n\n",
      stopText: "CO-INVESTMENT VENTURES\n\n",
    },
    prompt: `Extract the lease expiration schedule from this REIT 10-K filing section.

Find: The table of lease expirations, typically labelled "Lease Expirations" and described as summarizing "leases in place" at year-end.

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Lease expiration schedule for the nearest 24 months — one year per line. Include sq ft, NER expiring ($M), and % of total NER where available.",
  "unit": null,
  "citation": "Exact word-for-word copy of the full lease expiration table from the filing",
  "section": "Full section path, e.g. 'Item 2. Properties — Lease Expirations'",
  "tableRef": "Table name and period, e.g. 'Lease Expirations Table, December 31, 2024'",
  "footnote": "Any important note from the filing about re-signed, renewed, or excluded leases (verbatim or close paraphrase). Null if no such note exists.",
  "leaseRows": [
    {"year": "2025", "sqftM": 58, "nerM": 430, "pct": 8.0},
    {"year": "2026", "sqftM": 95, "nerM": 715, "pct": 13.3}
  ],
  "lease24mSqftM": 153,
  "lease24mNerM": 1145,
  "lease24mPct": 21.3
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"tableRef":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- leaseRows: include only the nearest 2 expiration years
- lease24m*: sum of the nearest 2 years; compute if not explicitly stated
- Capture the re-signed/renewed leases footnote in the footnote field if present

FILING TEXT:
{text}`,
  },
]

export function parseLLMResponse(raw: string): LLMResponse | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0]) as LLMResponse
  } catch {
    return null
  }
}

export async function runExtraction(
  config: ExtractionConfig,
  chunk: string
): Promise<ExtractionResult> {
  const userPrompt = config.prompt.replace("{text}", chunk)

  let raw: string
  let tokensIn = 0
  let tokensOut = 0

  try {
    const message = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })
    raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
    tokensIn = message.usage.input_tokens
    tokensOut = message.usage.output_tokens
  } catch (err) {
    return {
      id: config.id,
      title: config.title,
      data: null,
      citation: null,
      section: null,
      tableRef: null,
      unit: null,
      footnote: null,
      error: `API error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const parsed = parseLLMResponse(raw)

  if (!parsed || !parsed.found || !parsed.citation) {
    return {
      id: config.id,
      title: config.title,
      data: null,
      citation: null,
      section: null,
      tableRef: null,
      unit: null,
      footnote: null,
      error: "Could not locate this data in the filing. Verify manually.",
    }
  }

  return {
    id: config.id,
    title: config.title,
    data: parsed.data,
    citation: parsed.citation,
    section: parsed.section,
    tableRef: parsed.tableRef ?? null,
    unit: parsed.unit ?? null,
    footnote: parsed.footnote ?? null,
    error: null,
    tenantRows: parsed.tenantRows,
    tenantTop10Pct: parsed.top10Pct,
    tenantTop25Pct: parsed.top25Pct,
    geoRows: parsed.geoRows,
    californiaNOIPct: parsed.californiaNOIPct,
    debtRows: parsed.debtRows,
    leaseRows: parsed.leaseRows,
    lease24mSqftM: parsed.lease24mSqftM,
    lease24mNerM: parsed.lease24mNerM,
    lease24mPct: parsed.lease24mPct,
    tokensIn,
    tokensOut,
  }
}
