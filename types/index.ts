export type ExtractionId =
  | "tenant_concentration"
  | "geographic_exposure"
  | "debt_maturity"
  | "lease_expirations"

export interface ExtractionResult {
  id: ExtractionId
  title: string
  data: string | null
  citation: string | null
  section: string | null
  unit: string | null      // displayed once as a card-level badge (e.g. "figures in $000s")
  footnote: string | null  // important caveat from the filing (e.g. re-signed leases note)
  error: string | null
}

export interface Section {
  name: string
  content: string
}

export type SSEPayload =
  | { type: "extraction_start"; id: ExtractionId }
  | { type: "extraction_result"; id: ExtractionId; result: ExtractionResult }
  | { type: "fatal"; message: string }
  | { type: "done" }
