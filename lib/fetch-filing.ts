import { parse } from "node-html-parser"

const ALLOWED_HOSTS = ["www.sec.gov", "sec.gov"]

export function validateFilingUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "Invalid URL"
  }
  if (parsed.protocol !== "https:") return "URL must use HTTPS"
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return "URL must be from sec.gov (e.g. https://www.sec.gov/Archives/…)"
  }
  return null
}

export async function fetchAndClean(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  let response: Response
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // SEC EDGAR requires a User-Agent with a contact email per their access policy
        "User-Agent": "REITify/1.0 mfellah@mba2027.hbs.edu",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch filing: HTTP ${response.status}`)
  }

  const rawHtml = await response.text()
  return cleanHtml(rawHtml)
}

function cleanHtml(rawHtml: string): string {
  const root = parse(rawHtml)

  // Remove non-content elements
  root
    .querySelectorAll("script, style, nav, header, footer, iframe, noscript")
    .forEach((el) => el.remove())

  let html = root.toString()

  // Preserve table rows as tab-separated lines
  html = html.replace(/<\/tr>/gi, "\n")
  html = html.replace(/<\/t[dh]>/gi, "\t")
  html = html.replace(/<br\s*\/?>/gi, "\n")
  html = html.replace(/<\/p>/gi, "\n\n")
  html = html.replace(/<\/div>/gi, "\n")
  html = html.replace(/<\/h[1-6]>/gi, "\n\n")

  // Strip all remaining tags
  html = html.replace(/<[^>]+>/g, "")

  // Decode HTML entities
  html = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, h: string) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/&[a-z]{2,6};/gi, " ")

  // Normalize whitespace
  html = html.replace(/[ \t]+/g, " ")
  html = html.replace(/\n[ \t]+/g, "\n")
  html = html.replace(/[ \t]+\n/g, "\n")
  html = html.replace(/\n{3,}/g, "\n\n")

  return html.trim()
}
