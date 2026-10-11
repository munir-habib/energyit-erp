import ExcelJS from 'exceljs'

export interface ParsedSheet {
  headers: string[]
  rows: string[][]
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',' || ch === ';') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

function parseCsv(text: string): ParsedSheet {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }
  const [headerLine, ...rest] = lines
  return { headers: parseCsvLine(headerLine).map((h) => h.trim()), rows: rest.map(parseCsvLine) }
}

async function parseXlsx(file: File): Promise<ParsedSheet> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const sheet = workbook.worksheets[0]
  if (!sheet) return { headers: [], rows: [] }

  let headers: string[] = []
  const rows: string[][] = []
  sheet.eachRow((row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1).map((v) => (v == null ? '' : String(v)))
    if (rowNumber === 1) headers = values
    else rows.push(values)
  })
  return { headers, rows }
}

export async function parseSpreadsheet(file: File): Promise<ParsedSheet> {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv(await file.text())
  return parseXlsx(file)
}
