/**
 * CSV Export Utility
 * Converts data arrays to CSV format and triggers download
 */

export function downloadCsv(data: Record<string, unknown>[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn('No data to export')
    return
  }

  // Get headers from first object
  const headers = Object.keys(data[0])

  // Escape CSV values (handle commas, quotes, newlines)
  const escapeCsvValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return ''
    }
    const str = String(value)
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Build CSV content
  const csvRows: string[] = []
  
  // Add header row
  csvRows.push(headers.map(escapeCsvValue).join(','))

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => escapeCsvValue(row[header]))
    csvRows.push(values.join(','))
  }

  const csvContent = csvRows.join('\n')

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
