import { validateFilingUrl, fetchAndClean } from "@/lib/fetch-filing"
import { parseSections, selectChunk } from "@/lib/chunk-sections"
import { EXTRACTION_CONFIGS, runExtraction } from "@/lib/extract"
import type { SSEPayload } from "@/types"

// Requires Vercel Pro; Hobby plan caps at 60s which may be tight for large filings
export const maxDuration = 300

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url: string }
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: SSEPayload) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        )
      }

      try {
        const validationError = validateFilingUrl(url)
        if (validationError) {
          send({ type: "fatal", message: validationError })
          controller.close()
          return
        }

        let cleanText: string
        try {
          cleanText = await fetchAndClean(url)
        } catch (err) {
          send({
            type: "fatal",
            message: `Could not fetch filing: ${err instanceof Error ? err.message : String(err)}`,
          })
          controller.close()
          return
        }

        const sections = parseSections(cleanText)

        for (const config of EXTRACTION_CONFIGS) {
          send({ type: "extraction_start", id: config.id })
          const chunk = selectChunk(sections, config.sectionKeys)
          const result = await runExtraction(config, chunk)
          send({ type: "extraction_result", id: config.id, result })
        }

        send({ type: "done" })
      } catch (err) {
        send({
          type: "fatal",
          message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
