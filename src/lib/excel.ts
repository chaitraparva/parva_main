import * as XLSX from 'xlsx'

function buildWorksheet(headers: string[], rows: (string | number)[][]) {
  const data: (string | number)[][] = [headers, ...rows]
  const worksheet = XLSX.utils.aoa_to_sheet(data)
  worksheet['!cols'] = headers.map((h, i) => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[i] ?? '').length))
    return { wch: Math.min(Math.max(maxLen + 2, 10), 42) }
  })
  return worksheet
}

/**
 * Builds a real .xlsx workbook from column headers + row data and triggers
 * a browser download. Used anywhere HR or an employee needs to pull data
 * out into Excel (expense claims, paysheets, etc.) rather than a plain CSV.
 */
export function downloadExcel(filename: string, sheetName: string, headers: string[], rows: (string | number)[][]) {
  const worksheet = buildWorksheet(headers, rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  XLSX.writeFile(workbook, filename)
}

/**
 * Same as downloadExcel but returns the workbook as a Blob instead of
 * triggering a download directly — used when the .xlsx needs to be bundled
 * into a ZIP alongside other files (e.g. receipt photos) rather than
 * downloaded on its own.
 */
export function buildExcelBlob(sheetName: string, headers: string[], rows: (string | number)[][]): Blob {
  const worksheet = buildWorksheet(headers, rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  const arrayBuffer: ArrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  return new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
