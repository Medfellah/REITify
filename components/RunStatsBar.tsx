import type { RunStats } from "@/types"

interface Props {
  stats: RunStats
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
        {label}
      </span>
      <span className="text-sm font-bold text-slate-700">{value}</span>
    </div>
  )
}

function shortModelName(model: string): string {
  // "claude-sonnet-4-6" → "Sonnet 4.6"
  return model
    .replace(/^claude-/, "")
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
}

export function RunStatsBar({ stats }: Props) {
  const secs = (stats.durationMs / 1000).toFixed(1) + "s"
  const model = shortModelName(stats.model)
  const tIn = stats.totalTokensIn.toLocaleString()
  const tOut = stats.totalTokensOut.toLocaleString()

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-3">
      <div className="grid grid-cols-4 divide-x divide-slate-100">
        <Stat label="Duration" value={secs} />
        <Stat label="Model" value={model} />
        <Stat label="Tokens In" value={tIn} />
        <Stat label="Tokens Out" value={tOut} />
      </div>
    </div>
  )
}
