/**
 * Integration tests for anchor-based section extraction.
 * Downloads the real Prologis 10-K once, then verifies each extraction target
 * produces a focused chunk that (a) contains the expected data, and
 * (b) is under 5 000 tokens (≈ 20 000 chars) so the LLM budget is tight.
 *
 * Requires network access. Run with: npx vitest run __tests__/anchor-nav.test.ts
 */
import { describe, it, expect, beforeAll } from "vitest"
import { extractByAnchor } from "@/lib/anchor-nav"
import { fetchAndClean } from "@/lib/fetch-filing"

const FILING_URL =
  "https://www.sec.gov/Archives/edgar/data/1045609/000095017025021272/pld-20241231.htm"

// 5 000 tokens × 4 chars/token
const MAX_CHARS = 20_000

let cleanText = ""

beforeAll(async () => {
  cleanText = await fetchAndClean(FILING_URL)
}, 120_000)

describe("anchor-nav — Prologis 2024 10-K", () => {
  it("tenant_concentration: Customers → Our People contains Amazon and NER table", () => {
    const chunk = extractByAnchor(cleanText, {
      startText: "Customers\n\n",
      stopText: "Our People\n\n",
    })
    expect(chunk.length).toBeGreaterThan(0)
    expect(chunk).toContain("Amazon")
    // NER column header appears as "% of\nNER" in cleaned table
    expect(chunk).toMatch(/% of\s+NER/i)
    expect(chunk.length).toBeLessThan(MAX_CHARS)
  })

  it("geographic_exposure: GEOGRAPHIC DISTRIBUTION → LEASE EXPIRATIONS contains GBV and Southern California", () => {
    const chunk = extractByAnchor(cleanText, {
      startText: "GEOGRAPHIC DISTRIBUTION\n\n",
      stopText: "LEASE EXPIRATIONS\n\n",
    })
    expect(chunk.length).toBeGreaterThan(0)
    expect(chunk).toMatch(/gross book value/i)
    expect(chunk).toMatch(/southern california/i)
    expect(chunk.length).toBeLessThan(MAX_CHARS)
  })

  it("debt_maturity: Long-Term Debt Maturities → Interest Expense contains 514,223 and scheduled principal", () => {
    const chunk = extractByAnchor(cleanText, {
      startText: "Long-Term Debt Maturities\n\n",
      stopText: "Interest Expense\n\n",
    })
    expect(chunk.length).toBeGreaterThan(0)
    expect(chunk).toContain("514,223")
    expect(chunk).toMatch(/scheduled principal/i)
    expect(chunk.length).toBeLessThan(MAX_CHARS)
  })

  it("lease_expirations: LEASE EXPIRATIONS → CO-INVESTMENT VENTURES contains 430, 8.0, and 28 million re-signed note", () => {
    const chunk = extractByAnchor(cleanText, {
      startText: "LEASE EXPIRATIONS\n\n",
      stopText: "CO-INVESTMENT VENTURES\n\n",
    })
    expect(chunk.length).toBeGreaterThan(0)
    expect(chunk).toContain("430")
    expect(chunk).toContain("8.0")
    expect(chunk).toMatch(/28 million/i)
    expect(chunk.length).toBeLessThan(MAX_CHARS)
  })
})
