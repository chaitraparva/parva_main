// Loads the employee roster from employees.seed.json into Postgres,
// hashing each person's initial password. Each person's `loginRoles` array
// in that file is used directly (which portal(s) they may sign in to) —
// it's set explicitly per person, not derived from job_title, so one
// person can hold more than one role (e.g. someone who is both HR and a
// Line Manager).
//
// Run once against a fresh database: `npm run seed` (after `npm run
// migrate` to apply schema.sql). Safe to re-run — it upserts on id.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import 'dotenv/config'
import { pool } from './src/db.js'
import { hashPassword } from './src/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const employees = JSON.parse(readFileSync(join(__dirname, 'employees.seed.json'), 'utf8'))

async function main() {
  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'Welcome@123'
  const passwordHash = await hashPassword(demoPassword)

  let seeded = 0
  for (const e of employees) {
    const loginRoles = Array.isArray(e.loginRoles) ? e.loginRoles : []
    await pool.query(
      `INSERT INTO employees (
         id, name, job_title, title, email, phone, team, manager_id, join_date,
         status, department, leads_assigned, conversions, base_salary,
         response_time, location, photo_url, company, password_hash, login_roles
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, job_title = EXCLUDED.job_title, title = EXCLUDED.title,
         email = EXCLUDED.email, phone = EXCLUDED.phone, team = EXCLUDED.team,
         manager_id = EXCLUDED.manager_id, join_date = EXCLUDED.join_date,
         status = EXCLUDED.status, department = EXCLUDED.department,
         leads_assigned = EXCLUDED.leads_assigned, conversions = EXCLUDED.conversions,
         base_salary = EXCLUDED.base_salary, response_time = EXCLUDED.response_time,
         location = EXCLUDED.location, photo_url = EXCLUDED.photo_url,
         company = EXCLUDED.company, login_roles = EXCLUDED.login_roles,
         updated_at = now()`,
      [
        e.id, e.name, e.role, e.title || null, e.email, e.phone || '', e.team || '',
        e.managerId || null, e.joinDate || '', e.status || 'active', e.department || '',
        e.leadsAssigned || 0, e.conversions || 0, e.baseSalary || 0, e.responseTime || 'N/A',
        e.location || '', e.photoUrl || null, e.company || '', passwordHash, loginRoles,
      ],
    )
    seeded++
  }

  console.log(`Seeded ${seeded} employees.`)
  const loginable = employees.filter((e) => Array.isArray(e.loginRoles) && e.loginRoles.length > 0).length
  console.log(`${loginable} of them can sign in to a portal; everyone's initial password is "${demoPassword}".`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
