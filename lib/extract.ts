import Anthropic from "@anthropic-ai/sdk"
import type { ExtractionId, ExtractionResult, TenantRow, GeoRow, GeoL2Row, DebtRow, LeaseRow } from "@/types"
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
  californiaGBVM?: number
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

Find: The table showing portfolio breakdown by geographic region and market. Typically labelled "Geographic Distribution" and shows Rentable Square Footage and Gross Book Value for both Consolidated and O&M (Operating & Management) portfolios by region and market.

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
    {
      "region": "U.S.",
      "sqftM": 731,
      "gbvM": 78244,
      "omGBVM": 90671,
      "omPct": 67.4,
      "children": [
        {"market": "Southern California", "sqftM": 117, "consolidatedGBVM": 18323, "gbvM": 20702},
        {"market": "Northern California", "sqftM": 58, "consolidatedGBVM": 9012, "gbvM": 10500}
      ]
    },
    {
      "region": "Europe",
      "sqftM": 143,
      "gbvM": 18500,
      "omGBVM": 26503,
      "omPct": 19.7,
      "children": [
        {"market": "Germany", "sqftM": 45, "gbvM": 8200}
      ]
    }
  ],
  "californiaGBVM": 24000,
  "californiaNOIPct": 31.8
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"tableRef":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- Include the complete table in the citation
- Only return found: true if you have a specific verbatim citation
- geoRows: top-level entries are the 4 major regions (U.S., Other Americas, Europe, Asia). gbvM = consolidated GBV, omGBVM = O&M GBV (both in $M). omPct = O&M GBV as % of total O&M portfolio GBV. sqftM = consolidated sq ft in millions.
- children: all individual markets/countries within each region from the table. gbvM = O&M GBV in $M. consolidatedGBVM = consolidated GBV in $M. sqftM in millions.
- californiaGBVM: California's O&M GBV in $M if determinable; null otherwise
- californiaNOIPct: California's percentage of consolidated NOI if stated; null otherwise

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

Find: The table of scheduled debt principal payments due by year, broken down by debt type. Look for "Long-Term Debt Maturities" and "Scheduled principal payments due on our debt for each year." The table typically has columns for Senior Notes, Term Loans / Secured Mortgage Notes, and a Total.

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Year-by-year debt maturities with breakdown — one row per line (e.g. '2025: Senior $31,856 / Term Loans $308,978 / Total $514,223'). Include 'Thereafter' and 'Total'/'Subtotal' rows.",
  "unit": "Unit label EXACTLY as stated in the filing header (e.g. 'in thousands'). Shown once as a badge.",
  "citation": "Exact word-for-word copy of the full maturity table from the filing",
  "section": "Full section path, e.g. 'Item 8. Financial Statements — Long-Term Debt Maturities'",
  "tableRef": "Table name and period, e.g. 'Long-Term Debt Maturities, December 31, 2024'",
  "footnote": "Any footnote about specific loans (e.g. Canadian or Chinese term loans, extension options). Verbatim or close paraphrase. Null if absent.",
  "debtRows": [
    {"year": "2025", "seniorK": 31856, "termLoanK": 308978, "amountK": 514223},
    {"year": "2026", "seniorK": 1284618, "termLoanK": 680700, "amountK": 2173492},
    {"year": "2027", "seniorK": 1898055, "termLoanK": 45873, "amountK": 2010418},
    {"year": "2028", "seniorK": 2518708, "termLoanK": 94295, "amountK": 2616044},
    {"year": "2029", "seniorK": 3193130, "termLoanK": null, "amountK": 3196321},
    {"year": "Thereafter", "seniorK": 19969920, "termLoanK": 886588, "amountK": 20939411},
    {"year": "Total", "seniorK": 28896287, "termLoanK": 2016434, "amountK": 31449909}
  ]
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"tableRef":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- debtRows: amountK is the Total column; seniorK and termLoanK are the individual debt type columns. Use null for termLoanK when the year has no term loan maturities (shows "—" or 0 in the filing).
- Do NOT add unit labels to individual debtRows — the unit field handles that
- Include the "Total" or "Subtotal" row in debtRows with year="Total"
- footnote: Condense any term loan notes into this format: "[Year] includes [Loan Name] ($[amount]M, extendable to [year]) and [Loan Name] ($[amount]M, extendable to [year]). [Year] includes [Facility Name] ($[amount]M, extendable to [year])." Include only loans with extension options. Null if no such notes exist.

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

Find: The table of lease expirations, typically labelled "Lease Expirations" and described as summarizing "leases in place" at year-end. Columns typically include: year, sq ft expiring, NER expiring ($M), % of total NER, and NER per sq ft ($/sq ft).

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Full lease expiration schedule — one year per line. Include sq ft, NER expiring ($M), % of total NER, and $/sq ft where available.",
  "unit": null,
  "citation": "Exact word-for-word copy of the full lease expiration table from the filing",
  "section": "Full section path, e.g. 'Item 2. Properties — Lease Expirations'",
  "tableRef": "Table name and period, e.g. 'Lease Expirations Table, December 31, 2024'",
  "footnote": "Any important note from the filing about re-signed, renewed, or excluded leases (verbatim or close paraphrase). Null if no such note exists.",
  "leaseRows": [
    {"year": "2025", "sqftM": 58, "nerM": 430, "pct": 8.0, "psf": 7.41},
    {"year": "2026", "sqftM": 95, "nerM": 715, "pct": 13.3, "psf": 7.53},
    {"year": "2027", "sqftM": 101, "nerM": 820, "pct": 15.3, "psf": 8.12},
    {"year": "2028", "sqftM": 85, "nerM": 775, "pct": 14.5, "psf": 9.12},
    {"year": "2029", "sqftM": 78, "nerM": 744, "pct": 13.9, "psf": 9.54},
    {"year": "Thereafter", "sqftM": 35, "nerM": 437, "pct": 8.1, "psf": 12.49},
    {"year": "Total", "sqftM": 611, "nerM": 5363, "pct": 100.0, "psf": 8.78}
  ],
  "lease24mSqftM": 153,
  "lease24mNerM": 1145,
  "lease24mPct": 21.3
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"tableRef":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- leaseRows: include ALL years in the table (typically 2025 through Thereafter) plus a "Total" row. Include psf (NER per sq ft in $/sq ft) if the table shows it.
- lease24m*: sum of the nearest 2 expiration years (2025 + 2026); compute if not explicitly stated
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

  let raw: string = ""
  let tokensIn = 0
  let tokensOut = 0

  const MAX_RETRIES = 4
  let lastErr: unknown

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000))
    }
    try {
      const message = await client.messages.create({
        model: MODEL_ID,
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      })
      raw = message.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("")
      tokensIn = message.usage.input_tokens
      tokensOut = message.usage.output_tokens
      lastErr = null
      break
    } catch (err) {
      const status = (err as { status?: number }).status
      lastErr = err
      if (status !== 529 && status !== 503) break
    }
  }

  if (lastErr !== null && lastErr !== undefined) {
    return {
      id: config.id,
      title: config.title,
      data: null,
      citation: null,
      section: null,
      tableRef: null,
      unit: null,
      footnote: null,
      error: `API error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
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
    californiaGBVM: parsed.californiaGBVM,
    debtRows: parsed.debtRows,
    leaseRows: parsed.leaseRows,
    lease24mSqftM: parsed.lease24mSqftM,
    lease24mNerM: parsed.lease24mNerM,
    lease24mPct: parsed.lease24mPct,
    tokensIn,
    tokensOut,
  }
}
