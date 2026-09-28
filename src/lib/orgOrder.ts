import type { Employee } from '../types'

// The exact row order of Deeksha's master roster spreadsheet (the Google
// Sheet she shared on 2026-09-28) — starts with Neelesh, then Akshitha/
// Chaitra, then each branch's people, matching how she actually organizes
// the company rather than a computed rule (it isn't alphabetical, and
// isn't a strict "manager before every report" hierarchy sort either —
// e.g. Renuka Rani's branch is grouped together before Rabia Kapoor's
// direct reports, which a generic hierarchy walk wouldn't reproduce). Kept
// as an explicit list, same pattern as ATTENDANCE_EXCLUDED_IDS elsewhere in
// this codebase, so it's a one-line edit to reorder later — see also
// server/employees.seed.json, whose rows follow this same order.
export const ROSTER_SHEET_ORDER: string[] = [
    'DF230001', // Neelesh H P
    'DF230002', // Akshitha Rautri
    'PA230046', // Chaitra
    'DF230003', // Ravishankar
    'DF230029', // Yatheesh SP
    'DF230036', // Chandramathi
    'DF230044', // Satish Kumar D
    'DF230008', // Renuka Rani
    'DF230006', // Thejavathi J N
    'DF230038', // Mohsin
    'DF230011', // Arun Kumar A
    'DF230012', // Adithi A
    'DF230010', // Suhas S Vasishta
    'DF230037', // Vishwas V
    'DF230017', // Nazish Khan
    'DF230016', // Nino Samunnitha
    'DF230033', // Harshitaa R R
    'DF230019', // Ranjitha H S
    'DF230040', // Manoj H
    'DF230034', // Subhash H N
    'DF230027', // Nandini B. Madagunaki
    'DF230004', // Shradha Tapliyal
    'DF230042', // Meghashree
    'DF230007', // Rabia Kapoor
    'DF230045', // Amit Naudiyal
    'DF230035', // Avi Chauhan
    'DF230032', // Prashanth Mandoli
    'DF230043', // Tejasvi Anand
    'DF230030', // Vishal Kumar
    'PA230028', // Deekshitha M.V
    'PA230018', // Nagesh N
    'PA230041', // Vijaya Vaishnavi A
    'PA230047', // Ajoy Rameshan
    'PA230048', // Ankita Nair
    'DF230020', // Prajwal J
    'PH230001', // Anjana
    'PH230002', // Sushma
]

// Sorts by position in ROSTER_SHEET_ORDER. Anyone not on that list (not in
// the spreadsheet — e.g. Mausin, or someone added after the sheet was
// shared) is appended at the end, A-Z, rather than silently dropped.
export function sortByRosterOrder<T extends Pick<Employee, 'id' | 'name'>>(list: T[]): T[] {
    const indexOf = new Map(ROSTER_SHEET_ORDER.map((id, i) => [id, i]))
    return [...list].sort((a, b) => {
        const ai = indexOf.has(a.id) ? indexOf.get(a.id)! : Infinity
        const bi = indexOf.has(b.id) ? indexOf.get(b.id)! : Infinity
        if (ai !== bi) return ai - bi
        return a.name.localeCompare(b.name)
    })
}
