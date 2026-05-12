import { describe, it, expect, vi } from "vitest"

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({ messages: { create: vi.fn() } })),
}))

import { parseLLMResponse } from "../lib/extract"

describe("parseLLMResponse", () => {
  it("parses a valid found response with all fields", () => {
    const raw = JSON.stringify({
      found: true,
      data: "1. Amazon — 6.0%\n2. Home Depot — 2.8%",
      citation: "The following table details our top 25 customers...",
      section: "ITEM 1. BUSINESS",
      unit: "% of NER (Net Effective Rent)",
      footnote: null,
    })
    const result = parseLLMResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.found).toBe(true)
    expect(result!.data).toContain("Amazon")
    expect(result!.unit).toBe("% of NER (Net Effective Rent)")
    expect(result!.footnote).toBeNull()
  })

  it("parses a not-found response", () => {
    const raw = JSON.stringify({
      found: false,
      data: null,
      citation: null,
      section: null,
      unit: null,
      footnote: null,
    })
    const result = parseLLMResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.found).toBe(false)
  })

  it("extracts JSON even when model adds a preamble", () => {
    const payload = { found: true, data: "test data", citation: "verbatim quote", section: "Item 1", unit: null, footnote: null }
    const raw = `Here is the extracted data:\n${JSON.stringify(payload)}`
    const result = parseLLMResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.found).toBe(true)
  })

  it("extracts JSON wrapped in a markdown code fence", () => {
    const payload = { found: true, data: "d", citation: "c", section: "s", unit: null, footnote: null }
    const raw = "```json\n" + JSON.stringify(payload) + "\n```"
    const result = parseLLMResponse(raw)
    expect(result).not.toBeNull()
    expect(result!.found).toBe(true)
  })

  it("returns null for text with no JSON", () => {
    expect(parseLLMResponse("This is not JSON at all.")).toBeNull()
  })

  it("returns null for malformed JSON", () => {
    expect(parseLLMResponse("{found: true, data: missing quotes}")).toBeNull()
  })

  it("debt maturity: unit is 'figures in $000s', data has no inline 'thousand'", () => {
    const raw = JSON.stringify({
      found: true,
      data: "2025: 514,223\n2026: 2,173,492\n2027: 2,010,418\n2028: 2,616,044\n2029: 3,196,321\nThereafter: 20,939,411\nTotal: 31,449,909",
      citation: "future repayment of debt and scheduled principal payments at December 31, 2024",
      section: "ITEM 7A",
      unit: "figures in $000s",
      footnote: null,
    })
    const result = parseLLMResponse(raw)
    expect(result!.unit).toBe("figures in $000s")
    // Must NOT repeat units inline on every row
    expect(result!.data).not.toMatch(/thousand/i)
    expect(result!.data).not.toMatch(/\$000/i)
  })

  it("lease expirations: footnote contains the re-signed leases note", () => {
    const raw = JSON.stringify({
      found: true,
      data: "2025: 58M sq ft / $430M NER / 8.0%\n2026: 95M sq ft / $715M NER / 13.3%",
      citation: "The following table summarizes the lease expirations of our consolidated operating portfolio for leases in place at December 31, 2024",
      section: "ITEM 2. PROPERTIES",
      unit: null,
      footnote: "28.4M sq ft of leases due to expire in 2025 have already been re-signed or renewed and are excluded from the 2025 column.",
    })
    const result = parseLLMResponse(raw)
    expect(result!.footnote).not.toBeNull()
    expect(result!.footnote).toContain("28.4M")
    expect(result!.footnote!.toLowerCase()).toContain("re-signed")
  })

  it("geographic exposure: includes both consolidated and O&M figures", () => {
    const raw = JSON.stringify({
      found: true,
      data: "U.S.: $75,770M consolidated / ~97% of sq ft\nSouthern California: $18,323M\nEurope: $768M consolidated / $26,477M O&M\nAsia: $406M consolidated / $10,084M O&M",
      citation: "Consolidated Operating Properties O&M Geographies Rentable Square Footage Gross Book Value...",
      section: "ITEM 2. PROPERTIES",
      unit: "Gross Book Value in $M",
      footnote: null,
    })
    const result = parseLLMResponse(raw)
    expect(result!.found).toBe(true)
    expect(result!.data).toContain("75,770")
    expect(result!.unit).toBe("Gross Book Value in $M")
  })
})
