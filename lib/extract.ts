import Anthropic from "@anthropic-ai/sdk"
import type { ExtractionId, ExtractionResult } from "@/types"

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a financial analyst assistant specializing in REIT SEC 10-K filings. Extract specific data points with precision. Always provide verbatim citations copied word-for-word from the source text. Never fabricate, infer, or paraphrase data that is not explicitly present in the provided text.`

export interface LLMResponse {
  found: boolean
  data: string | null
  citation: string | null
  section: string | null
  unit: string | null
  footnote: string | null
}

export interface ExtractionConfig {
  id: ExtractionId
  title: string
  sectionKeys: string[]
  prompt: string
}

export const EXTRACTION_CONFIGS: ExtractionConfig[] = [
  {
    id: "tenant_concentration",
    title: "Tenant Concentration",
    sectionKeys: [
      // Exact phrases (100× bonus) — these appear only in the right subsection
      "top 25 customers",
      "top 10 customers",
      "net effective rent",
      // Single-word fallbacks
      "ner",
      "customer",
      "item 1",
      "business",
    ],
    prompt: `Extract the top tenant concentration data from this REIT 10-K filing section.

Find: The table of top tenants ranked by percentage of annualized base rent (ABR), net effective rent (NER), or total revenues. Prologis and some other REITs use NER rather than ABR.

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Numbered list of top tenants (one per line). Show tenant name, leased square footage if available, and percentage. Example: '1. Amazon.com — 34M sq ft — 6.0%'",
  "unit": "Short label for the metric used, exactly as stated in the filing (e.g. '% of NER' or '% of ABR'). Null if not determinable.",
  "citation": "Exact word-for-word copy of the full table or list from the filing — copy every row",
  "section": "Section name where you found this",
  "footnote": null
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- Include the full table in the citation, not just one row
- Only return found: true if you have a specific verbatim citation

FILING TEXT:
{text}`,
  },
  {
    id: "geographic_exposure",
    title: "Geographic Exposure",
    sectionKeys: [
      // Exact phrases targeting the specific table header
      "geographic distribution",
      "gross book value",
      "consolidated operating properties",
      "rentable square footage",
      // Single-word fallbacks
      "geographic",
      "item 2",
      "properties",
    ],
    prompt: `Extract the geographic exposure breakdown from this REIT 10-K filing section.

Find: The table showing portfolio breakdown by geographic region, market, or state. This is typically labelled "Geographic Distribution" and shows Rentable Square Footage and Gross Book Value by region.

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Geographic breakdown, one region per line. Show both consolidated and O&M figures where available. Example: 'U.S.: $75,770M consolidated GBV / 1,208.7M sq ft'",
  "unit": "Short label for the primary valuation metric (e.g. 'Gross Book Value in $M'). Null if not shown.",
  "citation": "Exact word-for-word copy of the full geographic distribution table from the filing",
  "section": "Section name where you found this",
  "footnote": null
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- Include the complete table in the citation
- Only return found: true if you have a specific verbatim citation

FILING TEXT:
{text}`,
  },
  {
    id: "debt_maturity",
    title: "Debt Maturity Schedule",
    sectionKeys: [
      // Exact phrases targeting the debt table description
      "repayment of debt",
      "scheduled principal payments",
      "future repayment",
      // Single-word fallbacks
      "maturity",
      "maturities",
      "debt",
      "principal",
      "item 7a",
    ],
    prompt: `Extract the debt maturity schedule from this REIT 10-K filing section.

Find: The table of scheduled debt principal payments due by year. This is typically described as "future repayment of debt and scheduled principal payments" and appears in Item 7A or the notes to financial statements.

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Year-by-year debt maturities EXACTLY as they appear in the table — one row per line (e.g. '2025: 514,223'). Do NOT convert, round, or add unit labels to individual rows. Include the 'Thereafter' and 'Total' rows if present.",
  "unit": "Unit label EXACTLY as stated in the filing header (e.g. 'figures in $000s' or 'amounts in thousands'). This will be shown once as a badge — do not repeat it in each data row.",
  "citation": "Exact word-for-word copy of the full maturity table from the filing",
  "section": "Section name where you found this",
  "footnote": null
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- Include the complete maturity table in the citation
- Only return found: true if you have a specific verbatim citation

FILING TEXT:
{text}`,
  },
  {
    id: "lease_expirations",
    title: "Material Lease Expirations (Next 24 Months)",
    sectionKeys: [
      // Exact phrases targeting the specific subsection
      "lease expiration",
      "leases in place",
      "ner expiring",
      // Single-word fallbacks
      "expiration",
      "expiring",
      "item 2",
      "properties",
    ],
    prompt: `Extract the lease expiration schedule for the next 24 months from this REIT 10-K filing section.

Find: The table of lease expirations, typically labelled "Lease Expirations" and described as summarizing "leases in place" at year-end. Focus on the nearest 2 years (current year + 1) but include the full table in the citation.

Respond with ONLY a valid JSON object — no preamble, no markdown:
{
  "found": true,
  "data": "Lease expiration schedule for the nearest 24 months — one year per line. Include sq ft, NER expiring ($M), and % of total NER where available (e.g. '2025: 58M sq ft / $430M NER / 8.0%'). Also include the combined 24-month total if calculable.",
  "unit": null,
  "citation": "Exact word-for-word copy of the full lease expiration table from the filing",
  "section": "Section name where you found this",
  "footnote": "Any important note from the filing about re-signed, renewed, or excluded leases (verbatim or close paraphrase). Null if no such note exists."
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null,"unit":null,"footnote":null}

RULES:
- citation must be VERBATIM — no paraphrasing
- Include the complete expiration table in the citation
- Capture the re-signed/renewed leases footnote in the footnote field if present
- Only return found: true if you have a specific verbatim citation

FILING TEXT:
{text}`,
  },
]

// Exported so it can be unit-tested independently of the Anthropic client
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
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })
    raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("")
  } catch (err) {
    return {
      id: config.id,
      title: config.title,
      data: null,
      citation: null,
      section: null,
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
    unit: parsed.unit ?? null,
    footnote: parsed.footnote ?? null,
    error: null,
  }
}
