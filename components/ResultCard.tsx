"use client"

import type { ExtractionResult } from "@/types"

interface Props {
  title: string
  status: "idle" | "loading" | "done"
  result?: ExtractionResult | null
}

export function ResultCard({ title, status, result }: Props) {
  if (status === "idle") {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 opacity-40">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          {title}
        </h3>
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin flex-shrink-0" />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-600">
            {title}
          </h3>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-slate-100 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
          <div className="h-3 bg-slate-100 rounded w-5/6" />
          <div className="h-3 bg-slate-100 rounded w-2/3" />
        </div>
      </div>
    )
  }

  // done
  const hasError = !result || result.error !== null

  return (
    <div
      className={`bg-white rounded-xl p-6 border ${
        hasError ? "border-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-700">
          {title}
        </h3>
        {!hasError && result?.section && (
          <span className="text-xs text-slate-400 shrink-0 pt-0.5">
            {result.section}
          </span>
        )}
      </div>

      {hasError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-sm text-amber-800">
            ⚠ Could not locate this data in the filing. Verify manually.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed mb-4">
            {result?.data}
          </p>
          {result?.citation && (
            <div className="border-l-4 border-slate-200 pl-4 bg-slate-50 rounded-r-lg py-3 pr-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
                Source
              </p>
              <div className="max-h-44 overflow-y-auto">
                <p className="text-xs text-slate-500 italic leading-relaxed">
                  &ldquo;{result.citation}&rdquo;
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
