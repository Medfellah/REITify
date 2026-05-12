"use client"

import { useState } from "react"
import { UrlInput } from "@/components/UrlInput"
import { ResultCard } from "@/components/ResultCard"
import type { ExtractionId, ExtractionResult, SSEPayload } from "@/types"

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

export default function Home() {
  const [url, setUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [cards, setCards] = useState<Record<ExtractionId, CardState>>(makeIdleCards())
  const [fatalError, setFatalError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  const hasResults =
    isDone || EXTRACTION_ORDER.some((id) => cards[id].status === "done")

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setFatalError(null)
    setIsDone(false)
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

          if (payload.type === "extraction_result") {
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

  const handleCopy = () => {
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    const lines: string[] = [
      "REITify — REIT 10-K Analysis",
      `Filing: ${url}`,
      `Date: ${date}`,
      "",
    ]
    for (const id of EXTRACTION_ORDER) {
      const { result } = cards[id]
      lines.push(EXTRACTION_TITLES[id].toUpperCase())
      if (!result || result.error) {
        lines.push("Could not locate this data in the filing. Verify manually.")
      } else {
        if (result.unit) lines.push(`(${result.unit})`)
        if (result.data) lines.push(result.data)
        if (result.footnote) lines.push(`ⓘ ${result.footnote}`)
        if (result.citation) lines.push(`\nSource: "${result.citation}"`)
      }
      lines.push("", "---", "")
    }
    navigator.clipboard.writeText(lines.join("\n"))
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
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-baseline gap-3">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            REITify
          </span>
          <span className="text-sm text-slate-400">REIT 10-K Analyzer</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-12 space-y-6">
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

        {/* Result Cards */}
        {(isAnalyzing || hasResults) && (
          <div className="space-y-4">
            {EXTRACTION_ORDER.map((id) => (
              <ResultCard
                key={id}
                title={EXTRACTION_TITLES[id]}
                status={cards[id].status}
                result={cards[id].result}
              />
            ))}
          </div>
        )}

        {/* Action Buttons — shown once at least one result is in */}
        {hasResults && (
          <div className="flex gap-3 pt-2 pb-8">
            <button
              onClick={handleCopy}
              className="flex-1 py-3 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              Copy Summary
            </button>
            <button
              onClick={handleExportPDF}
              className="flex-1 py-3 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors"
            >
              Export PDF
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
