// Vercel serverless entry point. Vercel treats any exported Express app in
// /api/*.js as a request handler automatically — this file just re-exports
// the real app defined in server/src/index.js so the backend and frontend
// deploy together as one Vercel project (see vercel.json for how /api/*
// requests get routed here).
export { default } from '../server/src/index.js'
