"use client"

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

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          {result.title}
        </h3>
        <SectionRef section={result.section} />
      </div>
      <UnitPill unit={result.unit} />

      <div className="mt-3 space-y-2.5 flex-1">
        {rows.slice(0, 10).map((row) => (
          <HBar
            key={row.rank}
            label={`${row.rank}. ${row.name}`}
            pct={row.pct}
            maxPct={maxPct}
            color="bg-blue-500"
          />
        ))}
        {rows.length === 0 && result.data && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {result.data}
          </p>
        )}
      </div>

      {(result.tenantTop10Pct != null || result.tenantTop25Pct != null) && (
        <div className="flex gap-2 mt-3">
          {result.tenantTop10Pct != null && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
              Top 10: {result.tenantTop10Pct}%
            </span>
          )}
          {result.tenantTop25Pct != null && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700">
              Top 25: {result.tenantTop25Pct}%
            </span>
          )}
        </div>
      )}

      <SourceBlock section={result.section} tableRef={result.tableRef} />
    </div>
  )
}

// ── Geographic exposure ────────────────────────────────────────────────────

function GeoCard({ result }: { result: ExtractionResult }) {
  const rows = result.geoRows ?? []
  const maxGBV = rows.length > 0 ? rows[0].gbvM : 1

  function fmt(n: number) {
    return n >= 1000
      ? `$${(n / 1000).toFixed(1)}B`
      : `$${n.toLocaleString()}M`
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          {result.title}
        </h3>
        <SectionRef section={result.section} />
      </div>
      <UnitPill unit={result.unit} />

      <div className="mt-3 space-y-2.5 flex-1">
        {rows.map((row) => (
          <HBar
            key={row.region}
            label={row.region}
            pct={row.gbvM}
            maxPct={maxGBV}
            color="bg-emerald-500"
            rightLabel={fmt(row.gbvM)}
          />
        ))}
        {rows.length === 0 && result.data && (
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {result.data}
          </p>
        )}
      </div>

      {result.californiaNOIPct != null && (
        <div className="mt-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
            California: {result.californiaNOIPct}% of consolidated NOI
          </span>
        </div>
      )}

      <SourceBlock section={result.section} tableRef={result.tableRef} />
    </div>
  )
}

// ── Debt maturity ──────────────────────────────────────────────────────────

function DebtCard({ result }: { result: ExtractionResult }) {
  const rows = result.debtRows ?? []
  const dataRows = rows.filter((r) => r.year !== "Total")
  const totalRow = rows.find((r) => r.year === "Total")

  function fmtAmt(k: number) {
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
                <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">
                  Year
                </th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {dataRows.map((row) => (
                <tr key={row.year}>
                  <td className="py-1.5 text-slate-700 flex items-center gap-1.5">
                    {row.year}
                    {row.year === "2025" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600">
                        near term
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono text-slate-700">
                    {fmtAmt(row.amountK)}
                  </td>
                </tr>
              ))}
            </tbody>
            {totalRow && (
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="pt-2 font-semibold text-slate-800">Total</td>
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

      <SourceBlock section={result.section} tableRef={result.tableRef} />
    </div>
  )
}

// ── Lease expirations ──────────────────────────────────────────────────────

function LeaseCard({ result }: { result: ExtractionResult }) {
  const rows = result.leaseRows ?? []
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
        {rows.length > 0 ? (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Year</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">Sq Ft</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">NER $M</th>
                <th className="text-right text-[10px] uppercase tracking-wider text-slate-400 pb-1.5 font-medium">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row) => (
                <tr key={row.year}>
                  <td className="py-1.5 text-slate-700">{row.year}</td>
                  <td className="py-1.5 text-right text-slate-700">{row.sqftM}M</td>
                  <td className="py-1.5 text-right text-slate-700">${row.nerM}M</td>
                  <td className="py-1.5 text-right font-medium text-slate-700">{row.pct}%</td>
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
