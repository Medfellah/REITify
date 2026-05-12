"use client"

interface Props {
  url: string
  onChange: (url: string) => void
  onSubmit: () => void
  disabled: boolean
}

export function UrlInput({ url, onChange, onSubmit, disabled }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
        SEC EDGAR Filing URL
      </label>
      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !disabled && url.trim()) onSubmit()
          }}
          placeholder="https://www.sec.gov/Archives/edgar/data/…/filing.htm"
          disabled={disabled}
          className="flex-1 px-4 py-3 rounded-lg border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
        <button
          onClick={onSubmit}
          disabled={disabled || !url.trim()}
          className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {disabled ? "Analyzing…" : "Analyze →"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        HTML format only (.htm). Paste the direct filing link from SEC EDGAR.
      </p>
    </div>
  )
}
