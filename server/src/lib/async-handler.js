// Express 4 does not catch a rejected promise thrown inside an `async`
// route handler — an unhandled rejection bypasses the centralized error
// handler in index.js entirely, and by default crashes the whole Node
// process (taking down every other in-flight request with it, not just the
// one that failed). Wrap every async route handler with this so a thrown
// error becomes a normal 500 response instead of an outage.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
