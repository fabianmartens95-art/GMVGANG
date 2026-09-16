const rawBaseUrl = process.env.STAGING_BASE_URL?.trim()
const expectedRevision = process.env.EXPECTED_REVISION?.trim()

if (!rawBaseUrl) throw new Error('STAGING_BASE_URL is required')
if (!expectedRevision) throw new Error('EXPECTED_REVISION is required')

const healthUrl = new URL('/health', rawBaseUrl)
const response = await fetch(healthUrl, {
  headers: { Accept: 'application/json' },
  redirect: 'error',
})
if (!response.ok) throw new Error(`Staging health failed with HTTP ${response.status}`)

const payload = await response.json()
if (payload?.ok !== true || payload?.service !== 'gmvgang-platform') {
  throw new Error('Staging health contract is invalid')
}
if (payload.revision !== expectedRevision) {
  throw new Error(`Deployed revision mismatch: expected ${expectedRevision}, received ${String(payload.revision)}`)
}

console.log(`Verified GMVGANG staging revision ${expectedRevision}`)
