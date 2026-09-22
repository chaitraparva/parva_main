import JSZip from 'jszip'

/** Reads a File (e.g. a receipt photo picked from disk) into a base64 data URL. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Triggers a browser download of an already-built Blob. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Triggers a browser download of a data URL (e.g. a receipt image). */
export function downloadDataUrl(filename: string, dataUrl: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function dataUrlToBase64(dataUrl: string): { base64: string; mime: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/)
  if (match) return { mime: match[1], base64: match[2] }
  return { mime: 'application/octet-stream', base64: dataUrl }
}

/**
 * Bundles a set of files (an Excel workbook + one or more receipt images)
 * into a single .zip and triggers the download — used for HR's "Download
 * All" action so a whole employee's expense sheet and every attached
 * receipt travel together in one file.
 */
export async function downloadZip(filename: string, files: { name: string; blob?: Blob; dataUrl?: string }[]) {
  const zip = new JSZip()
  for (const f of files) {
    if (f.blob) {
      zip.file(f.name, f.blob)
    } else if (f.dataUrl) {
      const { base64 } = dataUrlToBase64(f.dataUrl)
      zip.file(f.name, base64, { base64: true })
    }
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(filename, zipBlob)
}

/**
 * Generates a clearly-labelled placeholder receipt image (an SVG data URL)
 * for older demo claims that were seeded without a real uploaded photo, so
 * "view / download receipt" always has something honest to show rather
 * than silently failing. Freshly submitted claims carry the employee's
 * actual uploaded photo instead of this.
 */
export function placeholderReceiptDataUrl(opts: { category: string; amount: number; date: string; employeeName: string }): string {
  const { category, amount, date, employeeName } = opts
  const amountText = `Rs ${amount.toLocaleString('en-IN')}`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="640" viewBox="0 0 500 640">
    <rect width="500" height="640" fill="#FAF8F5"/>
    <rect x="24" y="24" width="452" height="592" rx="14" fill="#FFFFFF" stroke="#E5DFD5" stroke-width="2"/>
    <rect x="24" y="24" width="452" height="88" rx="14" fill="#1C2B4A"/>
    <rect x="24" y="88" width="452" height="24" fill="#1C2B4A"/>
    <text x="250" y="72" font-family="Georgia, serif" font-size="22" fill="#C9A96E" text-anchor="middle">Parva Group</text>
    <text x="250" y="95" font-family="Arial, sans-serif" font-size="11" letter-spacing="2" fill="#FAF8F5" text-anchor="middle">SAMPLE RECEIPT — DEMO DATA</text>
    <text x="60" y="180" font-family="Arial, sans-serif" font-size="13" fill="#7A7065">Employee</text>
    <text x="60" y="204" font-family="Arial, sans-serif" font-size="18" fill="#1C2B4A" font-weight="bold">${escapeXml(employeeName)}</text>
    <text x="60" y="250" font-family="Arial, sans-serif" font-size="13" fill="#7A7065">Category</text>
    <text x="60" y="274" font-family="Arial, sans-serif" font-size="18" fill="#1C2B4A" font-weight="bold">${escapeXml(category)}</text>
    <text x="60" y="320" font-family="Arial, sans-serif" font-size="13" fill="#7A7065">Date</text>
    <text x="60" y="344" font-family="Arial, sans-serif" font-size="18" fill="#1C2B4A" font-weight="bold">${escapeXml(date)}</text>
    <text x="60" y="410" font-family="Arial, sans-serif" font-size="13" fill="#7A7065">Amount</text>
    <text x="60" y="446" font-family="Georgia, serif" font-size="34" fill="#1C2B4A" font-weight="bold">${escapeXml(amountText)}</text>
    <line x1="60" y1="500" x2="440" y2="500" stroke="#E5DFD5" stroke-width="1.5" stroke-dasharray="4 4"/>
    <text x="250" y="560" font-family="Arial, sans-serif" font-size="11" fill="#B8AFA0" text-anchor="middle">No original scan was attached for this seeded demo claim.</text>
    <text x="250" y="580" font-family="Arial, sans-serif" font-size="11" fill="#B8AFA0" text-anchor="middle">This placeholder stands in for the receipt photo.</text>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
