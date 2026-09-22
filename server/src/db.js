import pg from 'pg'
import 'dotenv/config'

const { Pool, types } = pg

// pg returns NUMERIC columns (base_salary, net_pay, amount, ratings, etc.)
// as strings by default, to avoid silent precision loss on very large
// values — but every one of those columns in this schema is a plain JS
// number on the frontend, so parse them as floats here instead of leaving
// every route to remember to convert.
types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)))

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env (locally) or set it in your host\'s environment variables.')
}

// Supabase (like RDS) requires SSL. rejectUnauthorized: false trusts its
// certificate chain without pinning the specific CA bundle — fine for
// getting started; for stricter verification later, download Supabase's CA
// bundle and pass it as `ca` here instead.
//
// Pool size: on Vercel, every request can run in its own fresh serverless
// instance, so a normal-sized connection pool (10+) multiplied across many
// concurrent requests can exhaust Postgres's connection limit fast. Keep
// the pool tiny there and pair it with Supabase's "Transaction pooler"
// connection string (port 6543, in your Supabase project's Database
// settings) instead of the direct connection (port 5432) — that pooler is
// built for exactly this many-short-lived-connections pattern. Locally,
// a normal pool against the direct connection is fine.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: process.env.VERCEL ? 1 : 10,
})

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err)
})

export async function query(text, params) {
  return pool.query(text, params)
}
