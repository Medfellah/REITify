import type { Section } from "@/types"

// Split cleaned 10-K text into Item-level sections using SEC filing structure
export function parseSections(cleanText: string): Section[] {
  // Match "ITEM 1.", "ITEM 1A.", "ITEM 7A." etc. — title text on same line is optional
  const itemPattern = /(?:^|\n)(ITEM\s+\d+[A-Z]?\.(?:[ \t]+[^\n]{1,80})?)/gi
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

  if (sections.length === 0) {
    sections.push({ name: "Full Filing", content: cleanText })
  }

  return sections
}

// Score text against keyword signals.
// Multi-word phrases get a 100× bonus per occurrence — a single exact phrase
// match dominates any number of individual word hits, which ensures the window
// containing "top 25 customers" beats windows dense with just "customer".
export function scoreText(text: string, keys: string[]): number {
  const lower = text.toLowerCase()
  let score = 0
  for (const key of keys) {
    const lk = key.toLowerCase()
    if (lk.includes(" ")) {
      // Exact phrase: 100 points per occurrence
      score += (lower.split(lk).length - 1) * 100
    } else {
      // Single word: 1 point per occurrence
      score += lower.split(lk).length - 1
    }
  }
  return score
}

// Select and return the most relevant text for a given set of keyword signals
export function selectChunk(sections: Section[], keys: string[]): string {
  if (sections.length === 0) return ""

  const scored = sections.map((s) => ({
    section: s,
    // Section name match weighted 3× — hitting the right Item matters
    score: scoreText(s.name, keys) * 3 + scoreText(s.content, keys),
  }))

  scored.sort((a, b) => b.score - a.score)

  const top = scored.slice(0, 2).map((s) => s.section)
  let combined = top
    .map((s) => `=== ${s.name} ===\n${s.content}`)
    .join("\n\n")

  // Trim to ~25k token budget (100k chars)
  if (combined.length > 100_000) {
    combined = trimToRelevant(combined, keys)
  }

  return combined
}

// Paragraph-aware windowing: groups ~5k chars at paragraph breaks so tables
// are never cut mid-row, then scores each window and keeps the most relevant.
function trimToRelevant(text: string, keys: string[], maxChars = 80_000): string {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0)
  const targetWindowSize = 5_000

  const windows: Array<{ text: string; order: number }> = []
  let current = ""
  let order = 0

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > targetWindowSize && current.length > 0) {
      windows.push({ text: current, order: order++ })
      current = para
    } else {
      current += (current ? "\n\n" : "") + para
    }
  }
  if (current.trim()) {
    windows.push({ text: current, order: order++ })
  }

  const capacity = Math.max(4, Math.floor(maxChars / targetWindowSize))
  return windows
    .map((w) => ({ ...w, score: scoreText(w.text, keys) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, capacity)
    .sort((a, b) => a.order - b.order)
    .map((w) => w.text)
    .join("\n\n")
}
