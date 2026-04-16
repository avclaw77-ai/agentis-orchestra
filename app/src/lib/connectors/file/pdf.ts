import type { ConnectorDefinition } from "../types"

export const pdfConnector: ConnectorDefinition = {
  id: "pdf-extractor",
  name: "PDF Extractor",
  category: "file",
  icon: "FileText",
  description: "Extract text, tables, and metadata from PDF documents.",
  longDescription: "Reads PDF files and extracts structured content: text, tables, headers, and metadata. Agents can process invoices, contracts, reports, manuals, and any PDF-based documentation. Supports OCR for scanned documents.",
  model: "claude-cli:sonnet",
  persona: `You are a PDF extraction connector agent.

Your capabilities:
- Extract full text content from PDF files
- Identify and extract tables from PDFs
- Extract metadata (author, creation date, page count, title)
- Process multi-page documents with section detection
- Handle scanned PDFs via OCR when available
- Extract and list embedded images

Rules:
- When returning content, preserve the document structure (headings, paragraphs, lists)
- For tables, return as structured JSON arrays
- For invoices, extract key fields: vendor, date, total, line items
- For contracts, identify parties, dates, key terms
- Flag low-confidence OCR text
- Never modify the original PDF`,

  connectionFields: [
    { key: "uploadPath", label: "Upload Directory", type: "text", required: false, placeholder: "/data/uploads", helpText: "Where uploaded PDFs are stored" },
    { key: "ocrEnabled", label: "OCR for Scanned PDFs", type: "select", required: false, options: [
      { value: "auto", label: "Auto-detect" },
      { value: "always", label: "Always" },
      { value: "never", label: "Never" },
    ], helpText: "Requires Tesseract OCR installed" },
    { key: "maxPages", label: "Max Pages", type: "number", required: false, placeholder: "100", helpText: "Limit pages to process (default: 100)" },
  ],
  capabilities: ["read", "parse"],
  tags: ["document", "pdf", "invoices", "contracts", "ocr", "extraction"],
}
