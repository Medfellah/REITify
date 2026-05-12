import { describe, it, expect } from "vitest"
import { parseSections, selectChunk } from "../lib/chunk-sections"

// Hardcoded key arrays — these match what was in EXTRACTION_CONFIGS before the
// anchor-nav refactor replaced sectionKeys. Kept here so selectChunk tests
// remain valid without depending on the config shape.
const TENANT_KEYS = [
  "top 25 customers", "top 10 customers", "net effective rent",
  "ner", "customer", "item 1", "business",
]
const GEO_KEYS = [
  "geographic distribution", "gross book value", "consolidated operating properties",
  "rentable square footage", "geographic", "item 2", "properties",
]
const DEBT_KEYS = [
  "repayment of debt", "scheduled principal payments", "future repayment",
  "maturity", "maturities", "debt", "principal", "item 7a",
]
const LEASE_KEYS = [
  "lease expiration", "leases in place", "ner expiring",
  "expiration", "expiring", "item 2", "properties",
]

// ---------------------------------------------------------------------------
// Representative sample filing text.
// Intentionally includes NOISE — many standalone mentions of "customers",
// "geographic", "lease", "properties" — so the tests prove phrase scoring
// beats word-frequency scoring.
// ---------------------------------------------------------------------------

const NOISE_CUSTOMER =
  "We serve customers across many industries. Customer relationships are " +
  "central to our strategy. Our customers range from small businesses to " +
  "large multinationals. Understanding customer needs drives our portfolio " +
  "decisions. Customers sign leases typically ranging from 3–10 years. "

const NOISE_GEO =
  "Our geographic footprint spans the United States, Europe, and Asia. " +
  "Geographic diversity reduces risk. We evaluate geographic market " +
  "conditions regularly. Geographic analysis informs our capital allocation. "

const NOISE_LEASE =
  "Lease terms vary by market and property type. We manage lease renewals " +
  "proactively. Lease risk is mitigated through diversification. Our lease " +
  "portfolio has weighted average lease term of 4.7 years. "

// Noise padded enough that combined Item1+Item2 > 100k chars → triggers trimToRelevant
const LARGE_NOISE = (NOISE_CUSTOMER + NOISE_GEO + NOISE_LEASE).repeat(300) // ~90k chars

const SAMPLE_FILING = `
ITEM 1. BUSINESS

Overview

We are a real estate investment trust and the global leader in logistics real estate.
${NOISE_CUSTOMER.repeat(5)}

Customers

The following table details our top 25 customers for our consolidated and O&M real estate properties at December 31, 2024

Rank\tCustomer Name\tConsolidated Sq Ft (M)\tConsolidated % of NER\tO&M Sq Ft (M)\tTotal % of NER
1\tAmazon.com, Inc.\t34\t6.0%\t40\t5.4%
2\tHome Depot, Inc.\t17\t2.8%\t17\t2.5%
3\tFedEx Corporation\t7\t1.7%\t12\t1.6%
4\tUnited Parcel Service\t6\t1.0%\t6\t0.9%
5\tU.S. Government\t4\t0.7%\t4\t0.7%

Top 10 customers: 15.9% of consolidated NER
Top 25 customers: 23.0% of consolidated NER


ITEM 1A. RISK FACTORS

${NOISE_CUSTOMER.repeat(3)}
We face risks related to our customer base and geographic concentration.


ITEM 2. PROPERTIES

Overview

${NOISE_GEO.repeat(4)}

Geographic Distribution

The following table details the geographic distribution of our consolidated operating portfolio and owned or managed portfolio as of December 31, 2024.

Consolidated Operating Properties O&M Geographies Rentable Square Footage Gross Book Value

Geography\tConsolidated RSF (M)\tGross Book Value ($M)
U.S.\t1,208.7\t75,770
Southern California\t144.2\t18,323
San Francisco Bay Area\t59.2\t8,050
Central Valley\t40.4\t2,900
Other Americas\t34.5\t1,306
Europe\t24.0\t768
Asia\t12.8\t406

${NOISE_GEO.repeat(3)}
${NOISE_LEASE.repeat(3)}

Lease Expirations

The following table summarizes the lease expirations of our consolidated operating portfolio for leases in place at December 31, 2024.

Year\tLeases Expiring\tSq Ft (M)\t% of Leased Sq Ft\tNER Expiring ($M)\t% of Total NER
2025\t521\t58\t8.0%\t430\t8.0%
2026\t723\t95\t13.3%\t715\t13.3%
2027\t812\t110\t15.5%\t900\t16.7%

Note: 28.4 million square feet of leases due to expire in 2025 have already been re-signed or renewed and are excluded from the 2025 column above.


ITEM 7. MANAGEMENT'S DISCUSSION AND ANALYSIS

${NOISE_CUSTOMER.repeat(2)}
${NOISE_GEO.repeat(2)}


ITEM 7A. QUANTITATIVE AND QUALITATIVE DISCLOSURES ABOUT MARKET RISK

Interest Rate Risk

The table below details our future repayment of debt and scheduled principal payments at December 31, 2024 (amounts in thousands).

Year\tAmount
2025\t514,223
2026\t2,173,492
2027\t2,010,418
2028\t2,616,044
2029\t3,196,321
Thereafter\t20,939,411
Total\t31,449,909
`

// Same filing but with Item 1 padded to >100k chars to force trimToRelevant
const LARGE_ITEM1_FILING = SAMPLE_FILING.replace(
  "ITEM 1. BUSINESS\n\nOverview",
  `ITEM 1. BUSINESS\n\nOverview\n\n${LARGE_NOISE}`
)

// ---------------------------------------------------------------------------
// parseSections
// ---------------------------------------------------------------------------

describe("parseSections", () => {
  it("produces Item-level sections from the sample filing", () => {
    const sections = parseSections(SAMPLE_FILING)
    const names = sections.map((s) => s.name.toLowerCase())
    expect(names.some((n) => n.includes("item 1."))).toBe(true)
    expect(names.some((n) => n.includes("item 2."))).toBe(true)
    expect(names.some((n) => n.includes("item 7a."))).toBe(true)
  })

  it("does not create a top-level section for sub-headers like 'Customers'", () => {
    const sections = parseSections(SAMPLE_FILING)
    expect(sections.some((s) => s.name === "Customers")).toBe(false)
  })

  it("keeps 'Customers' subsection content inside Item 1", () => {
    const sections = parseSections(SAMPLE_FILING)
    const item1 = sections.find(
      (s) => s.name.toLowerCase().includes("item 1.") &&
             !s.name.toLowerCase().includes("item 1a")
    )
    expect(item1).toBeDefined()
    expect(item1!.content.toLowerCase()).toContain("top 25 customers")
    expect(item1!.content).toContain("Amazon")
  })

  it("keeps Geographic Distribution and Lease Expirations inside Item 2", () => {
    const sections = parseSections(SAMPLE_FILING)
    const item2 = sections.find((s) => s.name.toLowerCase().includes("item 2."))
    expect(item2).toBeDefined()
    expect(item2!.content).toContain("Geographic Distribution")
    expect(item2!.content).toContain("Lease Expirations")
  })
})

// ---------------------------------------------------------------------------
// selectChunk — tenant concentration
// ---------------------------------------------------------------------------

describe("selectChunk — tenant concentration", () => {
  it("finds the customer table in a normal-sized filing", () => {
    const sections = parseSections(SAMPLE_FILING)
    const chunk = selectChunk(sections, TENANT_KEYS)
    expect(chunk.toLowerCase()).toContain("top 25 customers")
    expect(chunk).toContain("Amazon")
    expect(chunk).toContain("6.0%")
  })

  it("still finds the customer table when Item 1 is padded past trimToRelevant threshold", () => {
    const sections = parseSections(LARGE_ITEM1_FILING)
    const chunk = selectChunk(sections, TENANT_KEYS)
    // The phrase 'top 25 customers' must win over windows full of noise 'customers'
    expect(chunk.toLowerCase()).toContain("top 25 customers")
    expect(chunk).toContain("6.0%")
  })
})

// ---------------------------------------------------------------------------
// selectChunk — geographic exposure
// ---------------------------------------------------------------------------

describe("selectChunk — geographic exposure", () => {
  it("finds the geographic distribution table", () => {
    const sections = parseSections(SAMPLE_FILING)
    const chunk = selectChunk(sections, GEO_KEYS)
    expect(chunk.toLowerCase()).toContain("geographic distribution")
    expect(chunk).toContain("Gross Book Value")
    expect(chunk).toContain("75,770")
    expect(chunk).toContain("Southern California")
  })
})

// ---------------------------------------------------------------------------
// selectChunk — debt maturity
// ---------------------------------------------------------------------------

describe("selectChunk — debt maturity", () => {
  it("finds the debt repayment table", () => {
    const sections = parseSections(SAMPLE_FILING)
    const chunk = selectChunk(sections, DEBT_KEYS)
    expect(chunk.toLowerCase()).toContain("repayment of debt")
    expect(chunk).toContain("514,223")
    expect(chunk).toContain("31,449,909")
  })
})

// ---------------------------------------------------------------------------
// selectChunk — lease expirations
// ---------------------------------------------------------------------------

describe("selectChunk — lease expirations", () => {

  it("finds the lease expiration table", () => {
    const sections = parseSections(SAMPLE_FILING)
    const chunk = selectChunk(sections, LEASE_KEYS)
    expect(chunk.toLowerCase()).toContain("lease expiration")
    expect(chunk.toLowerCase()).toContain("leases in place")
    expect(chunk).toContain("430")
    expect(chunk).toContain("715")
  })

  it("includes the re-signed leases footnote", () => {
    const sections = parseSections(SAMPLE_FILING)
    const chunk = selectChunk(sections, LEASE_KEYS)
    expect(chunk.toLowerCase()).toContain("28.4 million")
    expect(chunk.toLowerCase()).toContain("re-signed")
  })
})

// ---------------------------------------------------------------------------
// Discrimination test — phrase scoring must beat high-density word noise
//
// This test constructs a synthetic section where a 100k-char wall of text
// contains "customer" / "lease" / "geographic" very densely (scores high on
// single-word matching), but the actual target phrase ("top 25 customers",
// "leases in place", "geographic distribution") appears only once, at the end.
//
// Word-frequency scoring picks noise windows.  Phrase scoring picks the target.
// ---------------------------------------------------------------------------

const CUSTOMER_NOISE_DENSE =
  "Customer satisfaction is our priority. We serve customers globally. " +
  "Customer retention is key. Customers trust us. Our customer base grows. "
// ~5 "customer" occurrences per ~72 chars → ~347 per 5k window

const GEO_NOISE_DENSE =
  "Geographic markets are important. Our geographic footprint is global. " +
  "We monitor geographic risk. Geographic analysis guides us. "

const LEASE_NOISE_DENSE =
  "Lease terms vary. Our lease portfolio is diversified. Lease renewals " +
  "are managed proactively. Lease risk is low. "

describe("phrase scoring — discrimination tests (fail with word-freq, pass with phrase bonus)", () => {
  it("'top 25 customers' wins over a 100k wall of high-density customer noise", () => {
    const noise = CUSTOMER_NOISE_DENSE.repeat(1500) // ~108k chars, ~347 'customer' per 5k window
    const targetTable =
      "\n\nThe following table details our top 25 customers for our consolidated " +
      "and O&M real estate properties at December 31, 2024\n" +
      "1\tAmazon.com\t34\t6.0%\n" +
      "Top 10 customers: 15.9% of consolidated NER\n" +
      "Top 25 customers: 23.0% of consolidated NER\n"

    const sections = [{ name: "ITEM 1. BUSINESS", content: noise + targetTable }]
    const chunk = selectChunk(sections, TENANT_KEYS)

    expect(chunk.toLowerCase()).toContain("top 25 customers")
    expect(chunk).toContain("6.0%")
  })

  it("'geographic distribution' wins over dense geographic-word noise", () => {
    const noise = GEO_NOISE_DENSE.repeat(1500)
    const targetTable =
      "\n\nGeographic Distribution\n\n" +
      "Consolidated Operating Properties O&M Geographies Rentable Square Footage Gross Book Value\n" +
      "U.S.\t1208.7\t75,770\n" +
      "Southern California\t144.2\t18,323\n"

    const sections = [{ name: "ITEM 2. PROPERTIES", content: noise + targetTable }]
    const chunk = selectChunk(sections, GEO_KEYS)

    expect(chunk.toLowerCase()).toContain("geographic distribution")
    expect(chunk).toContain("75,770")
  })

  it("'leases in place' wins over dense lease-word noise", () => {
    const noise = LEASE_NOISE_DENSE.repeat(2000)
    const targetTable =
      "\n\nLease Expirations\n\n" +
      "The following table summarizes the lease expirations of our consolidated " +
      "operating portfolio for leases in place at December 31, 2024\n" +
      "2025\t521\t58\t8.0%\t430\t8.0%\n" +
      "2026\t723\t95\t13.3%\t715\t13.3%\n"

    const sections = [{ name: "ITEM 2. PROPERTIES", content: noise + targetTable }]
    const chunk = selectChunk(sections, LEASE_KEYS)

    expect(chunk.toLowerCase()).toContain("leases in place")
    expect(chunk).toContain("430")
  })
})
