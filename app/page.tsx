"use client"

import { useState } from "react"
import { UrlInput } from "@/components/UrlInput"
import { ResultCard } from "@/components/ResultCard"
import { CompanyCard } from "@/components/CompanyCard"
import { RunStatsBar } from "@/components/RunStatsBar"
import type { ExtractionId, ExtractionResult, FilingMeta, RunStats, SSEPayload } from "@/types"

const EXTRACTION_ORDER: ExtractionId[] = [
  "tenant_concentration",
  "geographic_exposure",
  "debt_maturity",
  "lease_expirations",
]

const EXTRACTION_TITLES: Record<ExtractionId, string> = {
  tenant_concentration: "Tenant Concentration",
  geographic_exposure: "Geographic Exposure",
  debt_maturity: "Debt Maturity Schedule",
  lease_expirations: "Material Lease Expirations (Next 24 Months)",
}

type CardStatus = "idle" | "loading" | "done"

interface CardState {
  status: CardStatus
  result: ExtractionResult | null
}

const makeIdleCards = (): Record<ExtractionId, CardState> =>
  Object.fromEntries(
    EXTRACTION_ORDER.map((id) => [id, { status: "idle" as CardStatus, result: null }])
  ) as Record<ExtractionId, CardState>

const makeLoadingCards = (): Record<ExtractionId, CardState> =>
  Object.fromEntries(
    EXTRACTION_ORDER.map((id) => [id, { status: "loading" as CardStatus, result: null }])
  ) as Record<ExtractionId, CardState>

// ── Text export helpers ────────────────────────────────────────────────────

function fmtGBVText(n: number): string {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}B` : `$${n.toLocaleString()}M`
}

function buildTextBody(cards: Record<ExtractionId, CardState>): string {
  const lines: string[] = []
  const sep = () => { lines.push(""); lines.push("---"); lines.push("") }
  const tDate = (ref: string | null) => (ref ? ref.replace(/^[^,]+,\s*/, "") : "")

  // Tenant Concentration
  const tenant = cards.tenant_concentration.result
  lines.push("TENANT CONCENTRATION")
  if (tenant && !tenant.error) {
    const d = tDate(tenant.tableRef ?? null)
    lines.push(`Source: ${tenant.section ?? ""}${d ? `, ${d}` : ""}`)
    lines.push("")
    const top10sqft = tenant.tenantRows?.slice(0, 10).reduce((s, r) => s + (r.sqftM ?? 0), 0) ?? 0
    const top25sqft = tenant.tenantRows?.reduce((s, r) => s + (r.sqftM ?? 0), 0) ?? 0
    if (tenant.tenantTop10Pct != null)
      lines.push(`Top 10 customers: ${tenant.tenantTop10Pct}% of NER${top10sqft ? ` (${top10sqft}M sq ft)` : ""}`)
    if (tenant.tenantTop25Pct != null)
      lines.push(`Top 25 customers: ${tenant.tenantTop25Pct}% of NER${top25sqft ? ` (${top25sqft}M sq ft)` : ""}`)
    if ((tenant.tenantRows ?? []).length > 0) {
      lines.push("")
      for (const row of tenant.tenantRows ?? []) {
        const sqft = row.sqftM != null ? ` — ${row.sqftM}M sq ft` : ""
        lines.push(`${row.rank}. ${row.name}${sqft} — ${row.pct}%`)
      }
    }
  } else {
    lines.push("Could not locate this data in the filing.")
  }

  sep()

  // Geographic Exposure
  const geo = cards.geographic_exposure.result
  lines.push("GEOGRAPHIC EXPOSURE")
  if (geo && !geo.error) {
    const d = tDate(geo.tableRef ?? null)
    lines.push(`Source: ${geo.section ?? ""}${d ? `, ${d}` : ""}`)
    lines.push("")
    for (const row of geo.geoRows ?? []) {
      const om = row.omGBVM != null ? ` / ${fmtGBVText(row.omGBVM)} O&M` : ""
      const pct = row.omPct != null ? ` (${row.omPct}% of portfolio)` : ""
      lines.push(`${row.region}: ${fmtGBVText(row.gbvM)} consolidated GBV${om}${pct}`)
      for (const child of row.children ?? []) {
        const sqft = child.sqftM != null ? ` — ${child.sqftM}M sq ft` : ""
        lines.push(`  ${child.market}: ${fmtGBVText(child.gbvM)}${sqft}`)
      }
    }
    if (geo.californiaGBVM != null || geo.californiaNOIPct != null) {
      const parts: string[] = []
      if (geo.californiaGBVM != null) parts.push(fmtGBVText(geo.californiaGBVM))
      if (geo.californiaNOIPct != null) parts.push(`${geo.californiaNOIPct}% of consolidated NOI`)
      lines.push("")
      lines.push(`California: ${parts.join(" / ")}`)
    }
  } else {
    lines.push("Could not locate this data in the filing.")
  }

  sep()

  // Debt Maturity Schedule
  const debt = cards.debt_maturity.result
  lines.push("DEBT MATURITY SCHEDULE")
  if (debt && !debt.error) {
    const d = tDate(debt.tableRef ?? null)
    lines.push(`Source: ${debt.section ?? ""}${d ? `, ${d}` : ""}`)
    if (debt.unit) lines.push(`Figures ${debt.unit}`)
    lines.push("")
    for (const row of debt.debtRows ?? []) {
      const label = row.year === "2025" ? `${row.year} (near term)` : row.year
      const breakdown =
        row.seniorK != null || row.termLoanK != null
          ? ` (Senior: $${row.seniorK?.toLocaleString() ?? "—"} / Term Loans: ${row.termLoanK != null ? `$${row.termLoanK.toLocaleString()}` : "—"})`
          : ""
      lines.push(`${label}: $${row.amountK.toLocaleString()}${breakdown}`)
    }
    if (debt.footnote) { lines.push(""); lines.push(`Note: ${debt.footnote}`) }
  } else {
    lines.push("Could not locate this data in the filing.")
  }

  sep()

  // Lease Expirations
  const lease = cards.lease_expirations.result
  lines.push("MATERIAL LEASE EXPIRATIONS (NEXT 24 MONTHS)")
  if (lease && !lease.error) {
    const d = tDate(lease.tableRef ?? null)
    lines.push(`Source: ${lease.section ?? ""}${d ? `, ${d}` : ""}`)
    lines.push("")
    if (lease.lease24mSqftM != null || lease.lease24mNerM != null) {
      const parts: string[] = []
      if (lease.lease24mSqftM != null) parts.push(`${lease.lease24mSqftM}M sq ft`)
      if (lease.lease24mNerM != null) parts.push(`$${lease.lease24mNerM}M NER`)
      if (lease.lease24mPct != null) parts.push(`${lease.lease24mPct}% of portfolio`)
      lines.push(`24-month total: ${parts.join(" / ")}`)
    }
    for (const row of lease.leaseRows ?? []) {
      const psf = row.psf != null ? ` / $${row.psf.toFixed(2)} per sq ft` : ""
      lines.push(`${row.year}: ${row.sqftM}M sq ft / $${row.nerM}M NER / ${row.pct}%${psf}`)
    }
    if (lease.footnote) { lines.push(""); lines.push(`Note: ${lease.footnote}`) }
  } else {
    lines.push("Could not locate this data in the filing.")
  }

  return lines.join("\n")
}

// ── Segmented control ──────────────────────────────────────────────────────

function SegmentedControl({
  value,
  onChange,
}: {
  value: "visual" | "text"
  onChange: (v: "visual" | "text") => void
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      {(["visual", "text"] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === opt
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt === "visual" ? "Visual" : "Text"}
        </button>
      ))}
    </div>
  )
}

function IconDownload() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4" />
    </svg>
  )
}

export default function Home() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [cards, setCards] = useState<Record<ExtractionId, CardState>>(makeIdleCards())
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [filingMeta, setFilingMeta] = useState<FilingMeta | null>(null)
  const [runStats, setRunStats] = useState<RunStats | null>(null)
  const [viewMode, setViewMode] = useState<"visual" | "text">("visual")

  const hasResults =
    isDone || EXTRACTION_ORDER.some((id) => cards[id].status === "done")

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setFatalError(null)
    setIsDone(false)
    setFilingMeta(null)
    setRunStats(null)
    setCards(makeLoadingCards())

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const event of events) {
          if (!event.startsWith("data: ")) continue
          let payload: SSEPayload
          try {
            payload = JSON.parse(event.slice(6)) as SSEPayload
          } catch {
            continue
          }

          if (payload.type === "filing_meta") {
            setFilingMeta(payload.meta)
          } else if (payload.type === "extraction_result") {
            setCards((prev) => ({
              ...prev,
              [payload.id]: { status: "done", result: payload.result },
            }))
          } else if (payload.type === "fatal") {
            setFatalError(payload.message)
            setCards(makeIdleCards())
            break
          } else if (payload.type === "done") {
            setIsDone(true)
            setRunStats(payload.stats)
          }
        }
      }
    } catch (err) {
      setFatalError(
        `Failed to connect: ${err instanceof Error ? err.message : String(err)}`
      )
      setCards(makeIdleCards())
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleExportText = () => {
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const header = [
      "REITify — REIT 10-K Analysis",
      `Filing: ${url}`,
      `Date: ${date}`,
      "",
      "---",
      "",
    ].join("\n")
    const content = header + buildTextBody(cards)
    const blob = new Blob([content], { type: "text/plain" })
    const dlUrl = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = dlUrl
    a.download = "reitify-analysis.txt"
    a.click()
    URL.revokeObjectURL(dlUrl)
  }

  const handleExportPDF = async () => {
    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ unit: "pt", format: "letter" })

    const margin = 56
    const pageW = doc.internal.pageSize.getWidth()
    const maxW = pageW - margin * 2
    let y = margin

    const checkPage = (needed: number) => {
      if (y + needed > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage()
        y = margin
      }
    }

    const addLine = (
      text: string,
      size: number,
      color: [number, number, number],
      bold = false
    ) => {
      doc.setFontSize(size)
      doc.setTextColor(...color)
      doc.setFont("helvetica", bold ? "bold" : "normal")
      const lines = doc.splitTextToSize(text, maxW) as string[]
      checkPage(lines.length * size * 1.4)
      doc.text(lines, margin, y)
      y += lines.length * size * 1.4 + 4
    }

    addLine("REITify — REIT 10-K Analysis", 16, [15, 23, 42], true)
    addLine(url, 8, [100, 116, 139])
    addLine(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      8,
      [100, 116, 139]
    )
    y += 14

    for (const id of EXTRACTION_ORDER) {
      const { result } = cards[id]
      addLine(EXTRACTION_TITLES[id], 10, [15, 23, 42], true)
      if (!result || result.error) {
        addLine(
          "Could not locate this data in the filing. Verify manually.",
          9,
          [180, 83, 9]
        )
      } else {
        if (result.data) addLine(result.data, 9, [30, 41, 59])
        if (result.citation) {
          y += 4
          addLine(`Source: "${result.citation}"`, 8, [100, 116, 139])
        }
      }
      y += 16
    }

    doc.save("reitify-analysis.pdf")
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-baseline gap-3">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            REITify
          </span>
          <span className="text-sm text-slate-400">REIT 10-K Analyzer</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-2 pb-2">
          <h1 className="text-2xl font-bold text-slate-900">
            Analyze any REIT 10-K in under 5 minutes.
          </h1>
          <p className="text-sm text-slate-500">
            Paste a SEC EDGAR filing URL. Get 4 key data points, each with a
            verbatim source citation you can verify in under 10 seconds.
          </p>
        </div>

        {/* URL Input */}
        <UrlInput
          url={url}
          onChange={setUrl}
          onSubmit={handleAnalyze}
          disabled={isAnalyzing}
        />

        {/* Fatal Error */}
        {fatalError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4">
            <p className="text-sm text-red-800">
              <span className="font-semibold">Error:</span> {fatalError}
            </p>
          </div>
        )}

        {/* Company Card — shown once filing metadata arrives */}
        {filingMeta && <CompanyCard meta={filingMeta} />}

        {/* Run Stats Bar — shown once extraction is complete */}
        {runStats && <RunStatsBar stats={runStats} />}

        {/* View toggle — between stats bar and results */}
        {(isAnalyzing || hasResults) && (
          <div className="flex justify-end">
            <SegmentedControl value={viewMode} onChange={setViewMode} />
          </div>
        )}

        {/* Results — Visual (2×2 grid) or Text */}
        {(isAnalyzing || hasResults) && (
          viewMode === "text" ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <pre className="text-[13px] text-slate-700 font-mono whitespace-pre-wrap leading-relaxed">
                {buildTextBody(cards)}
              </pre>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {EXTRACTION_ORDER.map((id) => (
                <ResultCard
                  key={id}
                  id={id}
                  title={EXTRACTION_TITLES[id]}
                  status={cards[id].status}
                  result={cards[id].result}
                />
              ))}
            </div>
          )
        )}

        {/* Action Buttons — shown once at least one result is in */}
        {hasResults && (
          <div className="flex gap-3 pt-2 pb-8">
            <button
              onClick={handleExportText}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              <IconDownload />
              Export as text
            </button>
            <button
              onClick={handleExportPDF}
              className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              <IconDownload />
              Export PDF
            </button>
          </div>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-6 text-center">
        <p className="text-xs text-slate-400">By Mohamed for Starwood · v1.1.0</p>
      </footer>
    </div>
  )
}
