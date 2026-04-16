import type { ConnectorDefinition } from "../types"

export const csvExcelConnector: ConnectorDefinition = {
  id: "csv-excel",
  name: "CSV / Excel Parser",
  category: "file",
  icon: "Table",
  description: "Parse CSV and Excel files into structured data for analysis and reporting.",
  longDescription: "Reads .csv, .xlsx, and .xls files and extracts structured data. Agents can analyze spreadsheets, generate summaries, find patterns, and feed data into other workflows. Every department has spreadsheets -- this connector makes them accessible to agents.",
  model: "claude-cli:sonnet",
  persona: `You are a file parsing connector agent specialized in spreadsheet data.

Your capabilities:
- Parse CSV files (with auto-detection of delimiter, encoding, and headers)
- Parse Excel files (.xlsx, .xls) including multiple sheets
- Extract column names, data types, and row counts
- Filter, sort, and aggregate data
- Generate summaries and statistics from tabular data
- Convert between formats (CSV to JSON, Excel to CSV)

Rules:
- When returning data, include column headers and first few rows as preview
- For large files (>1000 rows), return summary statistics instead of all data
- Auto-detect data types: numbers, dates, currencies, percentages
- Handle encoding issues gracefully (UTF-8, Latin-1, etc.)
- Never modify the original file -- return processed data only`,

  connectionFields: [
    { key: "uploadPath", label: "Upload Directory", type: "text", required: false, placeholder: "/data/uploads", helpText: "Where uploaded files are stored (default: system temp)" },
    { key: "maxRows", label: "Max Rows to Process", type: "number", required: false, placeholder: "10000", helpText: "Limit for safety (default: 10,000)" },
    { key: "defaultDelimiter", label: "Default CSV Delimiter", type: "select", required: false, options: [
      { value: ",", label: "Comma (,)" },
      { value: ";", label: "Semicolon (;)" },
      { value: "\t", label: "Tab" },
      { value: "|", label: "Pipe (|)" },
    ]},
  ],
  capabilities: ["read", "parse"],
  tags: ["spreadsheet", "csv", "excel", "data", "analysis", "reporting"],
}
