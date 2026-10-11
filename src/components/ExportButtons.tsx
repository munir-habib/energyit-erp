import { exportToCsv, exportToExcel, exportToPdf } from '@/lib/export'
import { Button } from '@/components/ui/Button'

export function ExportButtons({
  filename,
  headers,
  rows,
  csv = false,
  pdf = true,
}: {
  filename: string
  headers: string[]
  rows: (string | number)[][]
  /** Mostra também o botão "Exportar CSV". */
  csv?: boolean
  /** Esconde o botão "Exportar PDF" (útil em tabelas densas onde o PDF não faz sentido). */
  pdf?: boolean
}) {
  return (
    <div className="flex gap-2">
      {csv && (
        <Button type="button" variant="secondary" size="sm" onClick={() => exportToCsv(filename, headers, rows)}>
          Exportar CSV
        </Button>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={() => void exportToExcel(filename, headers, rows)}>
        Exportar Excel
      </Button>
      {pdf && (
        <Button type="button" variant="secondary" size="sm" onClick={() => void exportToPdf(filename, headers, rows)}>
          Exportar PDF
        </Button>
      )}
    </div>
  )
}
