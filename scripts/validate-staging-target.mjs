const rawStaging = process.env.STAGING_BASE_URL?.trim()
const rawPrimary = process.env.PRIMARY_BASE_URL?.trim()

if (!rawStaging) throw new Error('STAGING_BASE_URL is required')

const staging = new URL(rawStaging)
if (staging.protocol !== 'https:') throw new Error('Staging target must use HTTPS')
if (staging.username || staging.password || staging.search || staging.hash) {
  throw new Error('Staging target must be a clean origin URL')
}

if (rawPrimary) {
  const primary = new URL(rawPrimary)
  if (primary.origin === staging.origin) {
    throw new Error('Refusing to run staging verification against the primary target')
  }
}

console.log(`Validated staging target: ${staging.origin}`)
