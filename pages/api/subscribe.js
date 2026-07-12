import {
  buildLeadOwnerEmail,
  buildLeadUserConfirmationEmail,
  hasCloudflareEmailConfig,
  sendCloudflareEmail
} from '@/lib/integrations/cloudflare-email'
import {
  hasLeadDatabaseConfig,
  storeLeadInNotion
} from '@/lib/integrations/notion-leads'
import { syncAnalyticsPayload } from '@/lib/analytics/visitor-store'

function normalizeLocale(locale) {
  if (!locale) {
    return 'zh-CN'
  }
  return String(locale)
}

function getIpAddress(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (Array.isArray(forwarded)) {
    return forwarded[0]
  }
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || ''
}

function normalizeText(value, maxLength = 500) {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim().slice(0, maxLength)
}

/**
 * 接受邮件订阅
 * @param {*} req
 * @param {*} res
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const {
      email,
      firstName,
      lastName,
      first_name,
      last_name,
      locale,
      source,
      product,
      service,
      contact_method,
      contactMethod,
      message: leadMessage,
      pageUrl,
      referrer,
      visitor_id,
      user_id,
      first_touch
    } = req.body || {}

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      })
    }

    const lead = {
      email: String(email).trim().toLowerCase(),
      firstName: firstName || first_name || '',
      lastName: lastName || last_name || '',
      locale: normalizeLocale(locale),
      source: normalizeText(source, 120) || 'homepage_cta',
      product: normalizeText(product, 120),
      service: normalizeText(service, 160),
      contactMethod: normalizeText(contact_method || contactMethod, 200),
      message: normalizeText(leadMessage, 2000),
      pageUrl:
        normalizeText(pageUrl, 2000) ||
        process.env.NEXT_PUBLIC_LINK ||
        'https://www.charliiai.com',
      referrer: normalizeText(referrer || req.headers.referer || '', 2000),
      visitorId: typeof visitor_id === 'string' ? visitor_id.slice(0, 128) : '',
      userId: typeof user_id === 'string' ? user_id.slice(0, 128) : '',
      firstTouch:
        first_touch && typeof first_touch === 'object' ? first_touch : null,
      ip: getIpAddress(req),
      userAgent: req.headers['user-agent'] || '',
      submittedAt: new Date().toISOString()
    }

    try {
      const result = {
        stored_in_notion: false,
        owner_notified: false,
        user_notified: false,
        notion_page_id: null,
        analytics_synced: false,
        analytics_storage: null
      }

      if (hasLeadDatabaseConfig()) {
        const notionResult = await storeLeadInNotion(lead)
        result.stored_in_notion = true
        result.notion_page_id = notionResult.id
      }

      if (hasCloudflareEmailConfig()) {
        await sendCloudflareEmail(buildLeadOwnerEmail({ lead }))
        result.owner_notified = true

        await sendCloudflareEmail(buildLeadUserConfirmationEmail({ lead }))
        result.user_notified = true
      }

      if (
        !result.stored_in_notion &&
        !result.owner_notified &&
        !result.user_notified
      ) {
        return res.status(500).json({
          status: 'error',
          message:
            'Lead pipeline is not configured. Add Notion and Cloudflare Email environment variables.',
          ...result
        })
      }

      try {
        const analyticsResult = await syncAnalyticsPayload({
          visitor_id: lead.visitorId,
          user_id: lead.userId,
          first_touch: lead.firstTouch,
          source_page: lead.pageUrl,
          event: {
            event_name: 'lead_submitted',
            source: 'server',
            occurred_at: lead.submittedAt,
            properties: {
              form_name: lead.source || 'lead_form',
              lead_source: lead.source || 'homepage_cta',
              product: lead.product,
              service: lead.service,
              contact_method: lead.contactMethod,
              has_message: Boolean(lead.message),
              locale: lead.locale,
              page_url: lead.pageUrl,
              referrer: lead.referrer,
              stored_in_notion: result.stored_in_notion,
              owner_notified: result.owner_notified,
              user_notified: result.user_notified
            }
          }
        })
        result.analytics_synced = analyticsResult.ok
        result.analytics_storage = analyticsResult.storage || null
      } catch (analyticsError) {
        console.warn(
          'subscribe analytics sync skipped',
          analyticsError?.message || analyticsError
        )
      }

      return res.status(200).json({
        status: 'success',
        message: 'Lead captured successfully',
        ...result
      })
    } catch (error) {
      console.error('subscribe handler failed', error)
      return res.status(400).json({
        status: 'error',
        message: error?.message || 'Subscription failed!'
      })
    }
  } else {
    return res.status(405).json({
      status: 'error',
      message: 'Method not allowed'
    })
  }
}
