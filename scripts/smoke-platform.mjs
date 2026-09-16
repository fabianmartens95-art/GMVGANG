const rawBaseUrl = process.env.SMOKE_BASE_URL?.trim()
if (!rawBaseUrl) throw new Error('SMOKE_BASE_URL is required')

async function json(path, expectedStatus = 200) {
  const response = await fetch(new URL(path, rawBaseUrl), {
    headers: { Accept: 'application/json' },
    redirect: 'error',
  })
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned HTTP ${response.status}, expected ${expectedStatus}`)
  }
  return response.json()
}

const health = await json('/health')
if (health?.ok !== true || health?.service !== 'gmvgang-platform' || typeof health?.revision !== 'string') {
  throw new Error('Health contract failed')
}

const session = await json('/api/session')
if (session?.status !== 'anonymous' || !Array.isArray(session?.roles)) {
  throw new Error('Anonymous session contract failed')
}

console.log('GMVGANG remote smoke passed')
