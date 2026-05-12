import type { FilingMeta } from "@/types"

// Extract a DEI XBRL field value from the raw inline-XBRL HTML.
// Handles both plain `name="dei:Field">` and `name="dei:Field" format="...">` variants.
function extractDEI(rawHtml: string, fieldName: string): string | null {
  const patterns = [
    `name="dei:${fieldName}">`,
    `name="dei:${fieldName}" format=`,
  ]
  for (const pat of patterns) {
    const idx = rawHtml.indexOf(pat)
    if (idx < 0) continue
    // Advance past the opening tag's closing `>`
    const gtIdx = rawHtml.indexOf(">", idx + pat.length - 1)
    if (gtIdx < 0) continue
    const endIdx = rawHtml.indexOf("</ix:nonNumeric>", gtIdx)
    if (endIdx < 0) continue
    const raw = rawHtml
      .slice(gtIdx + 1, endIdx)
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
    return raw || null
  }
  return null
}

function formatISODate(iso: string): string {
  // "2025-02-14" → "Feb 14, 2025"
  const d = new Date(iso + "T12:00:00Z")
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// Parse /Archives/edgar/data/{cik}/{accession18digits}/ from the URL
function parseEdgarURL(url: string): { cik: string; accession: string } | null {
  const m = url.match(/\/Archives\/edgar\/data\/(\d+)\/(\d{18})\//)
  if (!m) return null
  return { cik: m[1], accession: m[2] }
}

// Query the EDGAR submissions API to get the exact filing date.
// Returns ISO date string "YYYY-MM-DD" or null.
async function fetchFilingDate(cik: string, accession18: string): Promise<string | null> {
  // "000095017025021272" → "0000950170-25-021272"
  const formatted = accession18.replace(/^(\d{10})(\d{2})(\d{6})$/, "$1-$2-$3")
  const paddedCIK = cik.padStart(10, "0")

  try {
    const resp = await fetch(
      `https://data.sec.gov/submissions/CIK${paddedCIK}.json`,
      {
        headers: { "User-Agent": "REITify/1.0 mfellah@mba2027.hbs.edu" },
        signal: AbortSignal.timeout(10_000),
      }
    )
    if (!resp.ok) return null
    const data = (await resp.json()) as {
      filings: { recent: { accessionNumber: string[]; filingDate: string[] } }
    }
    const nums = data.filings.recent.accessionNumber
    const dates = data.filings.recent.filingDate
    const idx = nums.findIndex((n) => n === formatted)
    return idx >= 0 ? dates[idx] : null
  } catch {
    return null
  }
}

export async function extractFilingMeta(
  rawHtml: string,
  url: string
): Promise<FilingMeta> {
  const ticker = (extractDEI(rawHtml, "TradingSymbol") ?? "").toUpperCase()
  const companyName =
    extractDEI(rawHtml, "EntityRegistrantName") ?? "Unknown Company"
  const rawExchange = extractDEI(rawHtml, "SecurityExchangeName") ?? ""
  const docType = extractDEI(rawHtml, "DocumentType") ?? "10-K"
  const fy = extractDEI(rawHtml, "DocumentFiscalYearFocus") ?? ""

  // Abbreviate exchange name
  const exchange = rawExchange.includes("New York")
    ? "NYSE"
    : rawExchange.includes("Nasdaq") || rawExchange.includes("NASDAQ")
    ? "NASDAQ"
    : rawExchange.slice(0, 6)

  // Filing date from EDGAR submissions API
  let filingDate = ""
  const urlMeta = parseEdgarURL(url)
  if (urlMeta) {
    const iso = await fetchFilingDate(urlMeta.cik, urlMeta.accession)
    if (iso) filingDate = formatISODate(iso)
  }

  return {
    ticker: ticker || "REIT",
    companyName,
    exchange,
    filingType: docType,
    fiscalYear: fy ? `FY${fy}` : "",
    filingDate,
  }
}
