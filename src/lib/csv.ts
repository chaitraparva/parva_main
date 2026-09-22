function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Builds a CSV string from column headers + row objects, triggers a browser
 * download, and returns the CSV text (useful for tests).
 */
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const lines = [headers, ...rows].map(row => row.map(escapeCsvCell).join(','))
  const csv = lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  return csv
}
