// A shared Supabase admin client (service-role key — bypasses RLS, never
// exposed to the frontend) used for two things that have nothing to do with
// our own Postgres pool: sending password-reset emails through Supabase's
// own mailer (auth.resetPasswordForEmail) and verifying the token from the
// link it sends (auth.getUser). Built lazily for the same reason
// server/src/routes/documents.js does it — createClient() throws
// immediately if SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are missing, and we
// don't want that to crash the whole server before any request needs it.
import { createClient } from '@supabase/supabase-js'

let client
export function getSupabaseAdmin() {
    if (!client) {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to send password-reset emails.')
        }
        client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        })
    }
    return client
}