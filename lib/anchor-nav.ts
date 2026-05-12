export interface AnchorSpec {
  startText: string  // exact text marking the section start (case-sensitive)
  stopText: string   // exact text at which to stop collecting
  maxChars?: number  // safety cap if stopText is not found (default 50 000)
}

/**
 * Extract a section of cleaned filing text between two literal anchor strings.
 * Returns from startText (inclusive) up to but not including stopText.
 * If stopText is not found, returns up to maxChars from the start position.
 */
export function extractByAnchor(cleanText: string, spec: AnchorSpec): string {
  const start = cleanText.indexOf(spec.startText)
  if (start === -1) return ""

  const searchFrom = start + spec.startText.length
  const stop = cleanText.indexOf(spec.stopText, searchFrom)
  const end =
    stop === -1
      ? Math.min(cleanText.length, start + (spec.maxChars ?? 50_000))
      : stop

  return cleanText.slice(start, end)
}
