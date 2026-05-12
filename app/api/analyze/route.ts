import { validateFilingUrl, fetchRaw, cleanHtml } from "@/lib/fetch-filing"
import { extractFilingMeta } from "@/lib/extract-meta"
import { extractByAnchor } from "@/lib/anchor-nav"
import { EXTRACTION_CONFIGS, MODEL_ID, runExtraction } from "@/lib/extract"
import type { SSEPayload, RunStats } from "@/types"

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

        let rawHtml: string
        try {
          rawHtml = await fetchRaw(url)
        } catch (err) {
          send({
            type: "fatal",
            message: `Could not fetch filing: ${err instanceof Error ? err.message : String(err)}`,
          })
          controller.close()
          return
        }

        // Extract company metadata and emit immediately
        const meta = await extractFilingMeta(rawHtml, url)
        send({ type: "filing_meta", meta })

        const cleanText = cleanHtml(rawHtml)
        const startTime = Date.now()
        let totalTokensIn = 0
        let totalTokensOut = 0

        for (const config of EXTRACTION_CONFIGS) {
          send({ type: "extraction_start", id: config.id })
          const chunk = extractByAnchor(cleanText, config.anchorSpec)
          const result = await runExtraction(config, chunk)
          totalTokensIn += result.tokensIn ?? 0
          totalTokensOut += result.tokensOut ?? 0
          send({ type: "extraction_result", id: config.id, result })
        }

        const stats: RunStats = {
          durationMs: Date.now() - startTime,
          model: MODEL_ID,
          totalTokensIn,
          totalTokensOut,
        }
        send({ type: "done", stats })
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
