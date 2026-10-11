import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { BRAND_GREEN, INK } from '@/lib/pdf'
import { carregarLogo, LOGO_NOME } from '@/lib/logo'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Exporta exatamente as linhas passadas (já filtradas pelo ecrã) para .xlsx. */
export async function exportToExcel(filename: string, headers: string[], rows: (string | number)[][]) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Dados')
  sheet.addRow(headers)
  rows.forEach((r) => sheet.addRow(r))
  sheet.getRow(1).font = { bold: true }
  sheet.columns.forEach((col) => {
    col.width = 20
  })
  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  )
}

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Exporta exatamente as linhas passadas (já filtradas pelo ecrã) para .csv. */
export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(';'))
  const csv = '﻿' + lines.join('\r\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`)
}

/** Relatório simples: cabeçalho com logo VIKSA Group, tabela, data de geração. */
export async function exportToPdf(title: string, headers: string[], rows: (string | number)[][]) {
  const logo = await carregarLogo()
  const doc = new jsPDF({ compress: true })

  if (logo) {
    // O ficheiro do logo já traz o wordmark "VIKSA GROUP" desenhado — não repetir o nome em texto ao lado.
    const h = 13
    const w = (logo.width / logo.height) * h
    doc.addImage(logo.dataUrl, 'PNG', 14, 4, w, h)
  } else {
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(LOGO_NOME, 14, 14)
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(title, 196, 14, { align: 'right' })
  doc.setDrawColor(...BRAND_GREEN)
  doc.setLineWidth(0.8)
  doc.line(14, 21, 196, 21)

  doc.setTextColor(...INK)
  doc.setFontSize(8)
  doc.text(`Gerado em ${new Date().toLocaleString('pt-PT')}`, 14, 27)

  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows,
    headStyles: { fillColor: BRAND_GREEN, textColor: 255 },
    styles: { fontSize: 8, cellPadding: 3 },
  })

  doc.save(`${title.replace(/\s+/g, '-')}.pdf`)
}
