export async function sendPush(title: string, body: string, url?: string) {
  const key = process.env.BARK_API_KEY
  if (!key) return

  try {
    const base = `https://api.day.app/${encodeURIComponent(key)}/${encodeURIComponent(title)}/${encodeURIComponent(body)}`
    const apiUrl = url ? `${base}?url=${encodeURIComponent(url)}` : base

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    await fetch(apiUrl, { method: 'POST', signal: controller.signal })

    clearTimeout(timeout)
  } catch {
    // Never throw on error
  }
}
