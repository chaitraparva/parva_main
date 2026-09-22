# Parva Group CRM / HR Portal

A React + Vite + TypeScript + Tailwind CSS HR/CRM portal covering both
companies under Parva Group — **Parva Realty** and **Diago Finance**. It's
a self-contained demo: everything lives in memory for the session (seeded
from `src/data/mockData.ts`), nothing is sent to a server, and refreshing
the page resets it back to the sample data.

## Running it locally

You need Node.js 18+ and `pnpm`.

```bash
pnpm install
pnpm dev          # http://localhost:8443 (or whatever PORT you set)
```

`pnpm run build` + `pnpm run preview` builds and serves the production
bundle the same way.

## Logging in

There's no real account system. Pick a role on the login screen and click
"Sign in as…":

- **CRM Executive** and **Line Manager** cover many real people across both
  companies — a "Sign in as" dropdown appears once you pick the role, so you
  can choose exactly who you're signing in as.
- **HR Manager**, **Director** and **Finance Manager** are shared,
  Group-level roles held by one person each across both companies, so those
  three sign straight in as that person.

The forgot-password / reset-password flow on the login screen is a
simulated demo flow; it doesn't send real email.

## Company structure

Every employee record carries a `company` field (`Parva Realty` or
`Diago Finance`), and the Employee Directory can filter by it. The
Director, HR Head and Finance Head sit at the Group level, overseeing both
companies; everyone else reports up within their own company to leadership
that ultimately reports to the Group Director. The Organisation Chart
screen renders this whole tree, with a company badge on every node.

## Project layout

- `src/` — the React frontend (the entire app)
- `src/App.tsx` — top-level state, routing between screens, and the login/role handling
- `src/data/mockData.ts` — the seeded demo dataset (employees, leaves, payroll, etc.)
- `src/screens/` — one folder/file per screen, organised roughly by role
- `src/components/` — shared layout and UI pieces
