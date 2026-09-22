// Postgres columns are snake_case; the frontend's TypeScript types are all
// camelCase. These two helpers convert row objects at the API boundary so
// neither side has to think about the other's naming convention.

export function toCamel(row) {
  if (row === null || typeof row !== 'object') return row
  if (Array.isArray(row)) return row.map(toCamel)
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
    out[camelKey] = value
  }
  return out
}

export function toSnake(obj) {
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
    out[snakeKey] = value
  }
  return out
}
