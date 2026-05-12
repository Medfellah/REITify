import Anthropic from "@anthropic-ai/sdk"
import type { ExtractionId, ExtractionResult } from "@/types"

const client = new Anthropic()

const SYSTEM_PROMPT = `You are a financial analyst assistant specializing in REIT SEC 10-K filings. Extract specific data points with precision. Always provide verbatim citations copied word-for-word from the source text. Never fabricate, infer, or paraphrase data that is not explicitly present in the provided text.`

interface LLMResponse {
  found: boolean
  data: string | null
  citation: string | null
  section: string | null
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
      "tenant",
      "customer",
      "item 1",
      "business",
      "concentration",
      "annualized base rent",
      "abr",
    ],
    prompt: `Extract the top tenant concentration data from this REIT 10-K filing section.

Find: The top tenants ranked by percentage of annualized base rent (ABR), total revenues, or similar metric. This is typically a numbered list or table showing tenant names alongside their percentage contribution.

Respond with ONLY a valid JSON object — no preamble, no explanation, no markdown:
{
  "found": true,
  "data": "Numbered list of top tenants with their percentage (one per line, e.g. '1. Amazon.com — 5.3% of ABR')",
  "citation": "Exact word-for-word copy of the full list or table from the filing",
  "section": "Section name where you found this"
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null}

RULES:
- citation must be copied VERBATIM — no paraphrasing whatsoever
- Include the entire table or list in the citation, not just one row
- Only return found: true if you can provide a specific verbatim citation

FILING TEXT:
{text}`,
  },
  {
    id: "geographic_exposure",
    title: "Geographic Exposure",
    sectionKeys: [
      "geographic",
      "region",
      "market",
      "item 1",
      "item 2",
      "properties",
      "location",
      "coastal",
      "sunbelt",
    ],
    prompt: `Extract the geographic exposure breakdown from this REIT 10-K filing section.

Find: The portfolio breakdown by geographic region, market, or state — expressed as a percentage of revenues, NOI, ABR, or square footage.

Respond with ONLY a valid JSON object — no preamble, no explanation, no markdown:
{
  "found": true,
  "data": "Geographic breakdown with percentages (one region per line, e.g. 'West Coast — 38% of NOI'). Include the metric used (NOI, ABR, revenue, sq ft).",
  "citation": "Exact word-for-word copy of the full table or list from the filing",
  "section": "Section name where you found this"
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null}

RULES:
- citation must be copied VERBATIM — no paraphrasing whatsoever
- Include the entire table or list in the citation
- Only return found: true if you can provide a specific verbatim citation

FILING TEXT:
{text}`,
  },
  {
    id: "debt_maturity",
    title: "Debt Maturity Schedule",
    sectionKeys: [
      "maturity",
      "maturities",
      "debt",
      "principal",
      "due",
      "long-term",
      "borrowings",
      "notes payable",
      "senior notes",
      "term loan",
      "credit facility",
    ],
    prompt: `Extract the debt maturity schedule from this REIT 10-K filing section.

Find: The schedule of debt principal payments due by year. This is typically labeled "debt maturity schedule," "aggregate annual maturities," or appears in notes to financial statements under long-term debt or debt obligations.

Respond with ONLY a valid JSON object — no preamble, no explanation, no markdown:
{
  "found": true,
  "data": "Year-by-year debt maturities (one year per line, e.g. '2025: $500.0 million'). Include total if available.",
  "citation": "Exact word-for-word copy of the full maturity table from the filing",
  "section": "Section name where you found this"
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null}

RULES:
- citation must be copied VERBATIM — no paraphrasing whatsoever
- Include the complete maturity table in the citation
- Only return found: true if you can provide a specific verbatim citation

FILING TEXT:
{text}`,
  },
  {
    id: "lease_expirations",
    title: "Material Lease Expirations (Next 24 Months)",
    sectionKeys: [
      "lease expir",
      "expiration",
      "expiring",
      "item 2",
      "properties",
      "rollover",
      "lease term",
      "renewal",
    ],
    prompt: `Extract the lease expiration schedule for the next 24 months from this REIT 10-K filing section.

Find: The schedule of lease expirations by year, focusing on leases expiring in the next 1-2 years. This typically shows number of leases, square footage expiring, and/or percentage of ABR expiring per year.

Respond with ONLY a valid JSON object — no preamble, no explanation, no markdown:
{
  "found": true,
  "data": "Lease expiration schedule for next 24 months (one year per line, showing number of leases, sq ft, and/or % of ABR where available).",
  "citation": "Exact word-for-word copy of the full expiration table from the filing",
  "section": "Section name where you found this"
}

If this data is not present in the provided text:
{"found":false,"data":null,"citation":null,"section":null}

RULES:
- citation must be copied VERBATIM — no paraphrasing whatsoever
- Include the complete expiration table in the citation — include all years shown, not just the nearest two
- Only return found: true if you can provide a specific verbatim citation

FILING TEXT:
{text}`,
  },
]

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
      error: `API error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  let parsed: LLMResponse
  try {
    // Extract JSON even if model wraps it in markdown or adds preamble
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("no JSON in response")
    parsed = JSON.parse(jsonMatch[0]) as LLMResponse
  } catch {
    return {
      id: config.id,
      title: config.title,
      data: null,
      citation: null,
      section: null,
      error: "Could not locate this data in the filing. Verify manually.",
    }
  }

  if (!parsed.found || !parsed.citation) {
    return {
      id: config.id,
      title: config.title,
      data: null,
      citation: null,
      section: null,
      error: "Could not locate this data in the filing. Verify manually.",
    }
  }

  return {
    id: config.id,
    title: config.title,
    data: parsed.data,
    citation: parsed.citation,
    section: parsed.section,
    error: null,
  }
}
