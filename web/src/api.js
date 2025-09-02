// Thin client for your FastAPI endpoint
export async function runAgent({ query, noSearch = false, maxResults = 3 }) {
  const resp = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      no_search: noSearch,
      max_results: maxResults
    })
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`API ${resp.status}: ${text || 'request failed'}`)
  }
  return resp.json() // { answer, sources: string[] }
}
