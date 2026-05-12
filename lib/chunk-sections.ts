import type { Section } from "@/types"

// Split cleaned 10-K text into Item-level sections using SEC filing structure
export function parseSections(cleanText: string): Section[] {
  // Matches "ITEM 1.", "ITEM 1A.", "ITEM 7.", etc. — case-insensitive
  const itemPattern = /(?:^|\n)(ITEM\s+\d+[A-Z]?\.[ \t]+[^\n]{3,80})/gi
  const sections: Section[] = []
  let lastIndex = 0
  let lastName = "Preamble"

  for (const match of cleanText.matchAll(itemPattern)) {
    const start = match.index!
    if (start > lastIndex) {
      const content = cleanText.slice(lastIndex, start).trim()
      if (content.length > 100) {
        sections.push({ name: lastName, content })
      }
    }
    lastName = match[1].trim().replace(/\s+/g, " ")
    lastIndex = start
  }

  const tail = cleanText.slice(lastIndex).trim()
  if (tail.length > 100) {
    sections.push({ name: lastName, content: tail })
  }

  // Fallback: if no Item headers found, treat the whole doc as one section
  if (sections.length === 0) {
    sections.push({ name: "Full Filing", content: cleanText })
  }

  return sections
}

// Select and return the most relevant text for a given set of keyword signals
export function selectChunk(sections: Section[], keys: string[]): string {
  if (sections.length === 0) return ""

  const lower = (s: string) => s.toLowerCase()
  const lowerKeys = keys.map((k) => k.toLowerCase())

  // Score each section by keyword hits in name and content
  const scored = sections.map((s) => {
    const nameScore = lowerKeys.reduce(
      (acc, k) => acc + (lower(s.name).includes(k) ? 20 : 0),
      0
    )
    const contentScore = lowerKeys.reduce(
      (acc, k) => acc + (lower(s.content).split(k).length - 1),
      0
    )
    return { section: s, score: nameScore + contentScore }
  })

  scored.sort((a, b) => b.score - a.score)

  const top = scored.slice(0, 2).map((s) => s.section)
  let combined = top
    .map((s) => `=== ${s.name} ===\n${s.content}`)
    .join("\n\n")

  // Trim to ~25k token budget (100k chars)
  if (combined.length > 100_000) {
    combined = trimToRelevant(combined, lowerKeys)
  }

  return combined
}

// Secondary chunking: score 5k-char windows and keep the most relevant ones
function trimToRelevant(
  text: string,
  keys: string[],
  maxChars = 80_000
): string {
  const windowSize = 5_000
  const windows: Array<{ text: string; index: number; score: number }> = []

  for (let i = 0; i < text.length; i += windowSize) {
    const chunk = text.slice(i, i + windowSize)
    const lower = chunk.toLowerCase()
    const score = keys.reduce(
      (acc, k) => acc + (lower.split(k).length - 1),
      0
    )
    windows.push({ text: chunk, index: Math.floor(i / windowSize), score })
  }

  const capacity = Math.floor(maxChars / windowSize)
  return windows
    .sort((a, b) => b.score - a.score)
    .slice(0, capacity)
    .sort((a, b) => a.index - b.index)
    .map((w) => w.text)
    .join("")
}
