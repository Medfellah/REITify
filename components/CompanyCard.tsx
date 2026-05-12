import type { FilingMeta } from "@/types"

interface Props {
  meta: FilingMeta
}

export function CompanyCard({ meta }: Props) {
  const initials = meta.ticker.slice(0, 3)

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4">
      {/* Ticker avatar */}
      <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-sm tracking-wide">{initials}</span>
      </div>

      {/* Company info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-900 text-sm leading-snug truncate">
          {meta.companyName}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {[meta.exchange, "Real Estate"].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Pills */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {meta.filingType && meta.fiscalYear && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {meta.filingType} {meta.fiscalYear}
          </span>
        )}
        {meta.filingDate && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            Filed {meta.filingDate}
          </span>
        )}
      </div>
    </div>
  )
}
