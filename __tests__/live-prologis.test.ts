/**
 * Live end-to-end test against the real Prologis 2024 10-K.
 * Verifies each extraction against the golden test data.
 * Requires ANTHROPIC_API_KEY and network access.
 */
import { describe, it, expect, beforeAll } from "vitest"
import { fetchAndClean } from "@/lib/fetch-filing"
import { extractByAnchor } from "@/lib/anchor-nav"
import { EXTRACTION_CONFIGS, runExtraction } from "@/lib/extract"
import type { ExtractionResult } from "@/types"

const FILING_URL =
  "https://www.sec.gov/Archives/edgar/data/1045609/000095017025021272/pld-20241231.htm"

let cleanText = ""
const results: Record<string, ExtractionResult> = {}

beforeAll(async () => {
  cleanText = await fetchAndClean(FILING_URL)
  for (const config of EXTRACTION_CONFIGS) {
    const chunk = extractByAnchor(cleanText, config.anchorSpec)
    results[config.id] = await runExtraction(config, chunk)
  }
}, 300_000)

describe("Prologis 2024 10-K — tenant concentration", () => {
  it("finds Amazon at 6.0% and 34M sq ft", () => {
    const r = results["tenant_concentration"]
    expect(r.error).toBeNull()
    expect(r.data).toMatch(/amazon/i)
    expect(r.data).toMatch(/6\.0/)
    expect(r.data).toMatch(/34/)
  })

  it("finds Home Depot at 2.8%", () => {
    const r = results["tenant_concentration"]
    expect(r.data).toMatch(/home depot/i)
    expect(r.data).toMatch(/2\.8/)
  })

  it("shows Top 10 = 15.9% and Top 25 = 23.0%", () => {
    const r = results["tenant_concentration"]
    expect(r.data).toMatch(/15\.9/)
    expect(r.data).toMatch(/23\.0/)
  })

  it("has a verbatim citation", () => {
    expect(results["tenant_concentration"].citation).toBeTruthy()
  })
})

describe("Prologis 2024 10-K — geographic exposure", () => {
  it("shows US total GBV of $75,770M", () => {
    const r = results["geographic_exposure"]
    expect(r.error).toBeNull()
    expect(r.data).toMatch(/75,770/)
  })

  it("shows Southern California as largest market at $18,323M", () => {
    const r = results["geographic_exposure"]
    expect(r.data).toMatch(/southern california/i)
    expect(r.data).toMatch(/18,323/)
  })

  it("has a verbatim citation", () => {
    expect(results["geographic_exposure"].citation).toBeTruthy()
  })
})

describe("Prologis 2024 10-K — debt maturity", () => {
  it("shows 2025 maturity of $514,223 (in thousands)", () => {
    const r = results["debt_maturity"]
    expect(r.error).toBeNull()
    expect(r.data).toMatch(/2025/)
    expect(r.data).toMatch(/514,223/)
  })

  it("shows 2026 = $2,173,492 and Thereafter = $20,939,411", () => {
    const r = results["debt_maturity"]
    expect(r.data).toMatch(/2,173,492/)
    expect(r.data).toMatch(/20,939,411/)
  })

  it("has a unit badge (in thousands)", () => {
    const r = results["debt_maturity"]
    expect(r.unit).toMatch(/thousand/i)
  })

  it("has a verbatim citation", () => {
    expect(results["debt_maturity"].citation).toBeTruthy()
  })
})

describe("Prologis 2024 10-K — lease expirations", () => {
  it("shows 2025: 58M sq ft, $430M NER, 8.0%", () => {
    const r = results["lease_expirations"]
    expect(r.error).toBeNull()
    expect(r.data).toMatch(/2025/)
    expect(r.data).toMatch(/58/)
    expect(r.data).toMatch(/430/)
    expect(r.data).toMatch(/8\.0/)
  })

  it("shows 2026: 95M sq ft, $715M NER, 13.3%", () => {
    const r = results["lease_expirations"]
    expect(r.data).toMatch(/2026/)
    expect(r.data).toMatch(/95/)
    expect(r.data).toMatch(/715/)
    expect(r.data).toMatch(/13\.3/)
  })

  it("has a footnote mentioning 28M sq ft re-signed leases", () => {
    const r = results["lease_expirations"]
    expect(r.footnote).toMatch(/28/)
    expect(r.footnote).toMatch(/re-signed|signed/i)
  })

  it("has a verbatim citation", () => {
    expect(results["lease_expirations"].citation).toBeTruthy()
  })
})
