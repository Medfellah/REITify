"use client"

import { useState } from "react"
import type { ExtractionResult, ExtractionId } from "@/types"

// ── Helpers ────────────────────────────────────────────────────────────────

function SectionRef({ section }: { section: string | null }) {
  if (!section) return null
  // "Item 1. Business — Customers" → "Item 1 · Customers"
  const match = section.match(/^(Item\s+\d+[A-Z]?)[^—–-]*[—–-]+\s*(.+)$/i)
  const short = match ? `${match[1]} · ${match[2].trim()}` : section
  return (
    <span className="text-[11px] text-slate-400 shrink-0 text-right leading-snug">
      {short}
    </span>
  )
}

function UnitPill({ unit }: { unit: string | null }) {
  if (!unit) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
      {unit}
    </span>
  )
}

function SourceBlock({
  section,
  tableRef,
}: {
  section: string | null
  tableRef: string | null
}) {
  if (!section && !tableRef) return null
  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium mb-0.5">
        Source
      </p>
      {section && (
        <p className="text-[13px] text-slate-600 leading-snug line-clamp-2">
          {section}
        </p>
      )}
      {tableRef && (
        <p className="text-[11px] text-slate-400 mt-0.5">{tableRef}</p>
      )}
    </div>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function LoadingCard({ title }: { title: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </span>
      </div>
      <div className="space-y-2 animate-pulse">
        <div className="h-2.5 bg-slate-100 rounded w-3/4" />
        <div className="h-2.5 bg-slate-100 rounded w-1/2" />
        <div className="h-2.5 bg-slate-100 rounded w-5/6" />
        <div className="h-2.5 bg-slate-100 rounded w-2/3" />
        <div className="h-2.5 bg-slate-100 rounded w-4/5" />
      </div>
    </div>
  )
}

// ── Error / not-found card ─────────────────────────────────────────────────

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-white border border-amber-200 rounded-xl p-5 h-full">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          {title}
        </h3>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
        <p className="text-sm text-amber-800">⚠ {message}</p>
      </div>
    </div>
  )
}

// ── Horizontal bar chart ───────────────────────────────────────────────────

function HBar({
  label,
  pct,
  maxPct,
  color,
  rightLabel,
}: {
  label: string
  pct: number
  maxPct: number
  color: string
  rightLabel?: string
}) {
  const width = maxPct > 0 ? Math.round((pct / maxPct) * 100) : 0
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[12px] text-slate-700 truncate max-w-[60%]">{label}</span>
        <span className="text-[12px] font-medium text-slate-700 ml-2 shrink-0">
          {rightLabel ?? `${pct}%`}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

// ── Tenant concentration ───────────────────────────────────────────────────

function TenantCard({ result }: { result: ExtractionResult }) {
  const rows = result.tenantRows ?? []
  const maxPct = rows.length > 0 ? rows[0].pct : 1
  const hasSqft = rows.some((r) => r.sqftM != null)
  const top10SqftM = rows.slice(0, 10).reduce((s, r) => s + (r.sqftM ?? 0), 0)
  const top25SqftM = rows.reduce((s, r) => s + (r.sqftM ?? 0), 0)
  const hasMetrics =
    result.tenantTop10Pct != null ||
    result.tenantTop25Pct != null ||
    top10SqftM > 0 ||
    top25SqftM > 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          {result.title}
        </h3>
        <SectionRef section={result.section} />
      </div>
      <UnitPill unit={result.unit} />

      <div className="mt-3 flex-1">
        {rows.length > 0 ? (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium w-6">#</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Tenant</th>
                {hasSqft && (
                  <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Sq Ft</th>
                )}
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">% NER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => (
                <tr key={row.rank}>
                  <td className="py-1.5 text-slate-400 text-[11px]">{row.rank}</td>
                  <td className="py-1.5 text-slate-700">{row.name}</td>
                  {hasSqft && (
                    <td className="py-1.5 text-right text-slate-600">
                      {row.sqftM != null ? `${row.sqftM}M` : "—"}
                    </td>
                  )}
                  <td className="py-1.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.round((row.pct / maxPct) * 100)}%` }}
                        />
                      </div>
                      <span className="font-medium text-slate-800 tabular-nums w-8 text-right">{row.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          result.data && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {result.data}
            </p>
          )
        )}
      </div>

      {hasMetrics && (
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {result.tenantTop10Pct != null && (
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide leading-tight">Top 10 NER</p>
              <p className="text-sm font-bold text-blue-800 mt-0.5">{result.tenantTop10Pct}%</p>
            </div>
          )}
          {top10SqftM > 0 && (
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide leading-tight">Top 10 sq ft</p>
              <p className="text-sm font-bold text-blue-800 mt-0.5">{top10SqftM}M</p>
            </div>
          )}
          {result.tenantTop25Pct != null && (
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide leading-tight">Top 25 NER</p>
              <p className="text-sm font-bold text-blue-800 mt-0.5">{result.tenantTop25Pct}%</p>
            </div>
          )}
          {top25SqftM > 0 && (
            <div className="bg-blue-50 rounded-lg p-2 text-center">
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide leading-tight">Top 25 sq ft</p>
              <p className="text-sm font-bold text-blue-800 mt-0.5">{top25SqftM}M</p>
            </div>
          )}
        </div>
      )}

      <SourceBlock section={result.section} tableRef={result.tableRef} />
    </div>
  )
}

// ── Geographic exposure ────────────────────────────────────────────────────

function fmtGBV(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}B` : `$${n.toLocaleString()}M`
}

const GEO_COLORS: Record<string, string> = {
  "U.S.": "#3b82f6",
  "Europe": "#10b981",
  "Asia": "#f59e0b",
  "Other Americas": "#8b5cf6",
}

function DonutChart({ rows }: { rows: import("@/types").GeoRow[] }) {
  const r = 38
  const cx = 52
  const cy = 52
  const strokeW = 20
  const C = 2 * Math.PI * r
  const total = rows.reduce((s, row) => s + (row.omGBVM ?? row.gbvM), 0)
  if (total === 0) return null

  let cumLen = 0
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="flex-shrink-0">
      {rows.map((row) => {
        const val = row.omGBVM ?? row.gbvM
        const segLen = (val / total) * C
        const dashOffset = -cumLen
        cumLen += segLen
        return (
          <circle
            key={row.region}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={GEO_COLORS[row.region] ?? "#94a3b8"}
            strokeWidth={strokeW}
            strokeDasharray={`${segLen} ${C - segLen}`}
            strokeDashoffset={dashOffset}
            style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px` }}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r - strokeW / 2 - 1} fill="white" />
    </svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  )
}

const OM_REGIONAL_TOTAL: Record<string, number> = {
  "U.S.": 90734,
  "Europe": 26477,
  "Asia": 10084,
  "Other Americas": 7232,
}

function GeoCard({ result }: { result: ExtractionResult }) {
  const [openRegion, setOpenRegion] = useState<string | null>(null)
  const rows = [...(result.geoRows ?? [])].sort((a, b) => b.gbvM - a.gbvM)

  const toggle = (region: string) =>
    setOpenRegion((prev) => (prev === region ? null : region))

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          {result.title}
        </h3>
        <SectionRef section={result.section} />
      </div>

      <div className="flex gap-1.5 mt-1 mb-3 flex-wrap">
        {result.unit && <UnitPill unit={result.unit} />}
        <UnitPill unit="sq ft in millions" />
      </div>

      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Region</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium pl-3">Sq Ft</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium pl-3">Consol. GBV</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium pl-3">O&amp;M GBV</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium pl-3">% O&amp;M</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((row) => {
                const isOpen = openRegion === row.region
                const hasChildren = (row.children ?? []).length > 0
                const sortedChildren = [...(row.children ?? [])].sort((a, b) => b.gbvM - a.gbvM)
                const hasConsol = sortedChildren.some((c) => c.consolidatedGBVM != null)
                const regionTotal = OM_REGIONAL_TOTAL[row.region] ?? (row.omGBVM ?? row.gbvM)

                const l1 = (
                  <tr
                    key={row.region}
                    onClick={() => hasChildren && toggle(row.region)}
                    className={`border-t border-slate-50 ${hasChildren ? "cursor-pointer hover:bg-slate-50" : ""}`}
                  >
                    <td className="py-2 font-medium text-slate-800">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: GEO_COLORS[row.region] ?? "#94a3b8" }}
                        />
                        {row.region}
                        {hasChildren && <ChevronIcon open={isOpen} />}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-600 pl-3">
                      {row.sqftM != null ? `${row.sqftM}M` : "—"}
                    </td>
                    <td className="py-2 text-right text-slate-600 pl-3">{fmtGBV(row.gbvM)}</td>
                    <td className="py-2 text-right text-slate-600 pl-3">
                      {row.omGBVM != null ? fmtGBV(row.omGBVM) : "—"}
                    </td>
                    <td className="py-2 text-right font-semibold text-slate-800 pl-3">
                      {row.omPct != null ? `${row.omPct}%` : "—"}
                    </td>
                  </tr>
                )

                if (!isOpen || sortedChildren.length === 0) return [l1]

                const l2 = (
                  <tr key={`${row.region}-l2`}>
                    <td colSpan={5} className="pb-2">
                      <table className="w-full text-[11px] bg-slate-50 rounded-lg">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 px-3 py-1 font-medium">Market</th>
                            <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 px-3 py-1 font-medium">Sq Ft</th>
                            {hasConsol && <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 px-3 py-1 font-medium">Consol. GBV</th>}
                            <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 px-3 py-1 font-medium">O&amp;M GBV</th>
                            <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 px-3 py-1 font-medium">% of Region</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sortedChildren.map((child) => {
                            const pct = regionTotal > 0
                              ? ((child.gbvM / regionTotal) * 100).toFixed(1)
                              : "—"
                            return (
                              <tr key={child.market}>
                                <td className="px-3 py-1.5 text-slate-700">{child.market}</td>
                                <td className="px-3 py-1.5 text-right text-slate-500">
                                  {child.sqftM != null ? `${child.sqftM}M` : "—"}
                                </td>
                                {hasConsol && (
                                  <td className="px-3 py-1.5 text-right text-slate-500">
                                    {child.consolidatedGBVM != null ? fmtGBV(child.consolidatedGBVM) : "—"}
                                  </td>
                                )}
                                <td className="px-3 py-1.5 text-right text-slate-500">{fmtGBV(child.gbvM)}</td>
                                <td className="px-3 py-1.5 text-right text-slate-600 font-medium">{pct}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )

                return [l1, l2]
              })}
            </tbody>
          </table>
        </div>
      ) : (
        result.data && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed flex-1">
            {result.data}
          </p>
        )
      )}

      {rows.length > 0 && (
        <div className="flex justify-center mt-3 pt-3 border-t border-slate-100">
          <DonutChart rows={rows} />
        </div>
      )}

      <div className="flex-1" />
      <SourceBlock section={result.section} tableRef={result.tableRef} />
    </div>
  )
}

// ── Debt maturity ──────────────────────────────────────────────────────────

function DebtCard({ result }: { result: ExtractionResult }) {
  const rows = result.debtRows ?? []
  const dataRows = rows.filter((r) => r.year !== "Total")
  const totalRow = rows.find((r) => r.year === "Total")
  const hasSenior = rows.some((r) => r.seniorK != null)

  function fmtAmt(k: number | null | undefined) {
    if (k == null) return "—"
    return k.toLocaleString()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          {result.title}
        </h3>
        <SectionRef section={result.section} />
      </div>

      <div className="flex gap-2 mt-1 mb-3 flex-wrap">
        {result.unit && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700">
            {result.unit}
          </span>
        )}
      </div>

      <div className="flex-1">
        {rows.length > 0 ? (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Year</th>
                {hasSenior && (
                  <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Senior Notes</th>
                )}
                {hasSenior && (
                  <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Term Loans</th>
                )}
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dataRows.map((row) => (
                <tr key={row.year}>
                  <td className="py-1.5 text-slate-700">{row.year}</td>
                  {hasSenior && (
                    <td className="py-1.5 text-right font-mono text-slate-600">
                      {fmtAmt(row.seniorK)}
                    </td>
                  )}
                  {hasSenior && (
                    <td className="py-1.5 text-right font-mono text-slate-600">
                      {fmtAmt(row.termLoanK)}
                    </td>
                  )}
                  <td className="py-1.5 text-right font-mono font-medium text-slate-800">
                    {fmtAmt(row.amountK)}
                  </td>
                </tr>
              ))}
            </tbody>
            {totalRow && (
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="pt-2 font-semibold text-slate-800">Total</td>
                  {hasSenior && (
                    <td className="pt-2 text-right font-mono font-semibold text-slate-700">
                      {fmtAmt(totalRow.seniorK)}
                    </td>
                  )}
                  {hasSenior && (
                    <td className="pt-2 text-right font-mono font-semibold text-slate-700">
                      {fmtAmt(totalRow.termLoanK)}
                    </td>
                  )}
                  <td className="pt-2 text-right font-mono font-semibold text-slate-800">
                    {fmtAmt(totalRow.amountK)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          result.data && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {result.data}
            </p>
          )
        )}
      </div>

      {result.footnote && (
        <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-3">
          <span className="text-blue-400 flex-shrink-0 text-xs mt-0.5">ⓘ</span>
          <p className="text-[12px] text-blue-700 leading-relaxed">{result.footnote}</p>
        </div>
      )}

      <SourceBlock section={result.section} tableRef={result.tableRef} />
    </div>
  )
}

// ── Lease expirations ──────────────────────────────────────────────────────

function LeaseCard({ result }: { result: ExtractionResult }) {
  const allRows = result.leaseRows ?? []
  const dataRows = allRows.filter((r) => r.year !== "Total")
  const totalRow = allRows.find((r) => r.year === "Total")
  const hasPsf = allRows.some((r) => r.psf != null)
  const has24m =
    result.lease24mSqftM != null &&
    result.lease24mNerM != null &&
    result.lease24mPct != null

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          {result.title}
        </h3>
        <SectionRef section={result.section} />
      </div>

      {/* 24-month summary bar */}
      {has24m && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
            24-Month Total
          </span>
          <div className="flex items-center gap-3 text-[12px] text-slate-700">
            <span>{result.lease24mSqftM}M sq ft</span>
            <span className="text-slate-300">|</span>
            <span>${result.lease24mNerM}M NER</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold">{result.lease24mPct}%</span>
          </div>
        </div>
      )}

      <div className="flex-1">
        {allRows.length > 0 ? (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Year</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Sq Ft</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">NER $M</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">%</th>
                {hasPsf && (
                  <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">$/sq ft</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dataRows.map((row) => (
                <tr key={row.year}>
                  <td className="py-1.5 text-slate-700">{row.year}</td>
                  <td className="py-1.5 text-right text-slate-700">{row.sqftM}M</td>
                  <td className="py-1.5 text-right text-slate-700">${row.nerM}M</td>
                  <td className="py-1.5 text-right font-medium text-slate-700">{row.pct}%</td>
                  {hasPsf && (
                    <td className="py-1.5 text-right text-slate-600">
                      {row.psf != null ? `$${row.psf.toFixed(2)}` : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {totalRow && (
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="pt-2 font-semibold text-slate-800">Total</td>
                  <td className="pt-2 text-right font-semibold text-slate-800">{totalRow.sqftM}M</td>
                  <td className="pt-2 text-right font-semibold text-slate-800">${totalRow.nerM}M</td>
                  <td className="pt-2 text-right font-semibold text-slate-800">{totalRow.pct}%</td>
                  {hasPsf && (
                    <td className="pt-2 text-right font-semibold text-slate-800">
                      {totalRow.psf != null ? `$${totalRow.psf.toFixed(2)}` : "—"}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        ) : (
          result.data && (
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              {result.data}
            </p>
          )
        )}
      </div>

      {result.footnote && (
        <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-3">
          <span className="text-blue-400 flex-shrink-0 text-xs mt-0.5">ⓘ</span>
          <p className="text-[12px] text-blue-700 leading-relaxed">{result.footnote}</p>
        </div>
      )}

      <SourceBlock section={result.section} tableRef={result.tableRef} />
    </div>
  )
}

// ── Idle placeholder card ───────────────────────────────────────────────────

function IdleCard({ title }: { title: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 opacity-40 h-full">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {title}
      </h3>
    </div>
  )
}

// ── Public component ───────────────────────────────────────────────────────

const VISUALIZATION: Record<
  ExtractionId,
  (result: ExtractionResult) => React.ReactNode
> = {
  tenant_concentration: (r) => <TenantCard result={r} />,
  geographic_exposure: (r) => <GeoCard result={r} />,
  debt_maturity: (r) => <DebtCard result={r} />,
  lease_expirations: (r) => <LeaseCard result={r} />,
}

interface Props {
  id: ExtractionId
  title: string
  status: "idle" | "loading" | "done"
  result?: ExtractionResult | null
}

export function ResultCard({ id, title, status, result }: Props) {
  if (status === "idle") return <IdleCard title={title} />
  if (status === "loading") return <LoadingCard title={title} />

  // done
  if (!result || result.error) {
    return (
      <ErrorCard
        title={title}
        message={
          result?.error ?? "Could not locate this data in the filing. Verify manually."
        }
      />
    )
  }

  return <>{VISUALIZATION[id](result)}</>
}
