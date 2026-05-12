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
