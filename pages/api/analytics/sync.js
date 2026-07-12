import { syncAnalyticsPayload } from '@/lib/analytics/visitor-store'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, message: 'Method not allowed' })
  }

  const result = await syncAnalyticsPayload(req.body)

  if (!result.ok) {
    return res.status(result.statusCode || 400).json({
      ok: false,
      message: result.message || 'Unable to sync analytics state'
    })
  }

  return res.status(200).json(result)
}
