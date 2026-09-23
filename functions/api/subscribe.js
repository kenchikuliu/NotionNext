import {
  hasGrowthEmailTransport,
  sendGrowthEmail
} from '../_shared/growth-email.js'
import { growthContext } from '../_shared/growth-attribution.js'
import {
  clientIp,
  consumeRateLimit,
  isSameOrigin,
  normalizeEmail,
  randomId,
  sha256
} from '../_shared/auth.js'

const NOTION_API_BASE = 'https://api.notion.com/v1'
const DEFAULT_NOTION_VERSION = '2022-06-28'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

function normalizeEnv(env, key) {
  const value = env?.[key]
  return typeof value === 'string'
    ? value
        .replace(/\\n/g, '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
    : value
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
}

function normalizeText(value, maxLength = 500) {
  return value === undefined || value === null
    ? ''
    : String(value).trim().slice(0, maxLength)
}

function isInquiryLead(lead) {
  return (
    Boolean(
      lead.product || lead.service || lead.message || lead.contactMethod
    ) || /inquiry|recharge|chongzhi|contact/i.test(lead.source)
  )
}

async function prepareNewsletterSubscriber(env, lead, request) {
  if (!env?.AUTH_KV) throw new Error('Newsletter storage is not configured')
  const digest = await sha256(lead.email)
  const key = `newsletter:subscriber:${digest}`
  const existing = await env.AUTH_KV.get(key, 'json')
  if (
    existing?.status === 'subscribed' ||
    (existing?.status === 'pending_confirmation' &&
      existing?.verificationStatus === 'sent' &&
      existing?.expiresAt > Date.now())
  ) {
    return { key, digest, subscriber: existing, duplicate: true }
  }

  const unsubscribeToken = randomId()
  const verificationToken = randomId()
  const subscriptionId = crypto.randomUUID()
  const subscriber = {
    ...existing,
    email: lead.email,
    status: 'pending_confirmation',
    verificationStatus: 'pending',
    locale: lead.locale,
    source: lead.source,
    pageUrl: (() => {
      try {
        const page = new URL(lead.pageUrl)
        return page.origin === new URL(request.url).origin
          ? page.origin + page.pathname
          : new URL(request.url).origin + '/'
      } catch {
        return new URL(request.url).origin + '/'
      }
    })(),
    referrer: (() => {
      try {
        return new URL(lead.referrer).origin
      } catch {
        return ''
      }
    })(),
    consent: true,
    consentSource: 'website_subscription_form',
    consentAt: lead.submittedAt,
    updatedAt: lead.submittedAt,
    subscriptionId,
    verificationToken,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    analyticsContext: growthContext(request),
    unsubscribedAt: null,
    unsubscribeToken,
    unsubscribeUrl: `https://www.charliiai.com/unsubscribe?token=${unsubscribeToken}`
  }
  await env.AUTH_KV.put(key, JSON.stringify(subscriber))
  await env.AUTH_KV.put(`newsletter:verify:${verificationToken}`, key, {
    expirationTtl: 24 * 60 * 60
  })
  await env.AUTH_KV.put(`newsletter:unsubscribe:${unsubscribeToken}`, key)
  if (existing?.unsubscribeToken) {
    await env.AUTH_KV.delete(
      `newsletter:unsubscribe:${existing.unsubscribeToken}`
    )
  }
  return { key, digest, subscriber, duplicate: false }
}

async function updateNewsletterSubscriber(env, key, subscriber, values) {
  const updated = {
    ...subscriber,
    ...values,
    updatedAt: new Date().toISOString()
  }
  await env.AUTH_KV.put(key, JSON.stringify(updated))
  return updated
}

function hasLeadDatabaseConfig(env) {
  return Boolean(
    normalizeEnv(env, 'NOTION_API_KEY') &&
      normalizeEnv(env, 'LEAD_NOTION_DATABASE_ID')
  )
}

async function notionRequest(env, path, init = {}) {
  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${normalizeEnv(env, 'NOTION_API_KEY')}`,
      'Notion-Version':
        normalizeEnv(env, 'NOTION_API_VERSION') || DEFAULT_NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      data?.message || `Notion request failed with status ${response.status}`
    )
  }
  return data
}

function findProperty(properties, predicate) {
  return Object.entries(properties || {}).find(([name, property]) =>
    predicate(name, property)
  )
}

function richText(content) {
  return { rich_text: [{ text: { content: String(content).slice(0, 2000) } }] }
}

function title(content) {
  return { title: [{ text: { content: String(content).slice(0, 2000) } }] }
}

function select(content) {
  return { select: { name: String(content).slice(0, 100) } }
}

function buildLeadProperties(schema, lead) {
  const properties = {}
  const titleEntry =
    findProperty(schema, (_, property) => property.type === 'title') || []
  const emailEntry = findProperty(
    schema,
    (_, property) => property.type === 'email'
  )
  const createdEntry = findProperty(
    schema,
    (name, property) =>
      property.type === 'date' && /created|submitted/i.test(name)
  )
  const sourceEntry = findProperty(
    schema,
    (name, property) =>
      ['rich_text', 'select'].includes(property.type) &&
      /source|channel/i.test(name)
  )
  const localeEntry = findProperty(
    schema,
    (name, property) =>
      ['rich_text', 'select'].includes(property.type) &&
      /locale|language|lang/i.test(name)
  )
  const statusEntry = findProperty(
    schema,
    (name, property) =>
      ['select', 'status'].includes(property.type) && /status/i.test(name)
  )
  const pageUrlEntry = findProperty(
    schema,
    (name, property) =>
      ['url', 'rich_text'].includes(property.type) &&
      /page|landing|source|url|link/i.test(name)
  )
  const noteEntry = findProperty(
    schema,
    (name, property) =>
      property.type === 'rich_text' &&
      /note|details|meta|message|context/i.test(name)
  )

  if (titleEntry[0]) {
    properties[titleEntry[0]] = title(`CharliiAI lead ${lead.email}`)
  }
  if (emailEntry?.[0]) properties[emailEntry[0]] = { email: lead.email }
  if (createdEntry?.[0]) {
    properties[createdEntry[0]] = { date: { start: lead.submittedAt } }
  }
  if (sourceEntry?.[0]) {
    properties[sourceEntry[0]] =
      sourceEntry[1].type === 'select'
        ? select(lead.source)
        : richText(lead.source)
  }
  if (localeEntry?.[0]) {
    properties[localeEntry[0]] =
      localeEntry[1].type === 'select'
        ? select(lead.locale)
        : richText(lead.locale)
  }
  if (statusEntry?.[0]) {
    const options =
      statusEntry[1].type === 'status'
        ? statusEntry[1].status?.options
        : statusEntry[1].select?.options
    const preferred =
      options?.find(option => /new|lead|todo|not started/i.test(option.name)) ||
      options?.[0]
    if (preferred?.name) {
      properties[statusEntry[0]] =
        statusEntry[1].type === 'status'
          ? { status: { name: preferred.name } }
          : select(preferred.name)
    }
  }
  if (pageUrlEntry?.[0]) {
    properties[pageUrlEntry[0]] =
      pageUrlEntry[1].type === 'url'
        ? { url: lead.pageUrl.slice(0, 2000) }
        : richText(lead.pageUrl)
  }
  if (noteEntry?.[0]) {
    properties[noteEntry[0]] = richText(
      JSON.stringify(
        {
          product: lead.product,
          service: lead.service,
          contactMethod: lead.contactMethod,
          message: lead.message,
          referrer: lead.referrer,
          ip: lead.ip,
          userAgent: lead.userAgent
        },
        null,
        2
      )
    )
  }
  return properties
}

async function storeLeadInNotion(env, lead) {
  const databaseId = normalizeEnv(env, 'LEAD_NOTION_DATABASE_ID')
  const database = await notionRequest(env, `/databases/${databaseId}`, {
    method: 'GET'
  })
  const properties = buildLeadProperties(database.properties, lead)
  if (!Object.keys(properties).length) {
    throw new Error('Unable to map Notion lead database properties')
  }
  const created = await notionRequest(env, '/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties
    })
  })
  return { id: created.id, url: created.url || null }
}

function getIp(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    ''
  )
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export async function onRequestPost({ request, env }) {
  let body = {}
  try {
    body = await request.json()
  } catch {
    return json({ status: 'error', message: 'Invalid JSON body' }, 400)
  }

  const email = normalizeEmail(body.email)
  if (!email)
    return json({ status: 'error', message: 'Invalid email address' }, 400)

  const lead = {
    email,
    firstName: normalizeText(body.firstName || body.first_name, 120),
    lastName: normalizeText(body.lastName || body.last_name, 120),
    locale: normalizeText(body.locale, 40) || 'zh-CN',
    source: normalizeText(body.source, 120) || 'homepage_cta',
    product: normalizeText(body.product, 120),
    service: normalizeText(body.service, 160),
    contactMethod: normalizeText(
      body.contact_method || body.contactMethod,
      200
    ),
    message: normalizeText(body.message, 2000),
    pageUrl: normalizeText(body.pageUrl, 2000) || 'https://www.charliiai.com',
    referrer: normalizeText(
      body.referrer || request.headers.get('referer'),
      2000
    ),
    ip: getIp(request),
    userAgent: request.headers.get('user-agent') || '',
    submittedAt: new Date().toISOString()
  }

  const result = {
    stored_in_kv: false,
    stored_in_notion: false,
    owner_notified: false,
    user_notified: false,
    notion_page_id: null,
    user_email_provider: null,
    duplicate: false,
    analytics_synced: false,
    analytics_reason: null
  }

  try {
    const inquiry = isInquiryLead(lead)

    if (!inquiry) {
      if (!isSameOrigin(request) || body.newsletter_consent !== true) {
        return json(
          {
            status: 'error',
            message:
              'Subscription consent and a same-origin request are required.'
          },
          403
        )
      }
      if (!hasGrowthEmailTransport(env) || !env?.AUTH_KV) {
        return json(
          {
            status: 'error',
            message: 'Newsletter confirmation is unavailable.'
          },
          503
        )
      }
      const emailLimit = await consumeRateLimit(
        env.AUTH_KV,
        'newsletter-email',
        email,
        3,
        3600
      )
      const ipLimit = await consumeRateLimit(
        env.AUTH_KV,
        'newsletter-ip',
        clientIp(request),
        10,
        3600
      )
      if (!emailLimit.allowed || !ipLimit.allowed) {
        return json(
          { status: 'error', message: 'Please try again later.' },
          429
        )
      }
      const newsletter = await prepareNewsletterSubscriber(env, lead, request)
      result.stored_in_kv = true
      result.duplicate = newsletter.duplicate
      if (newsletter.duplicate) {
        return json({
          status: 'success',
          message:
            lead.locale === 'zh-CN'
              ? '请检查邮箱中的验证邮件；已订阅的地址无需重复提交。'
              : 'Check your inbox for the verification link. Existing subscriptions do not need another request.',
          ...result
        })
      }
      try {
        await sendGrowthEmail(env, {
          eventId: `newsletter:${newsletter.subscriber.subscriptionId}:verify`,
          templateId: 'email_verification',
          to: lead.email,
          input: {
            verify_url: `https://www.charliiai.com/confirm-subscription?token=${newsletter.subscriber.verificationToken}`
          }
        })
        await updateNewsletterSubscriber(
          env,
          newsletter.key,
          newsletter.subscriber,
          {
            verificationStatus: 'sent'
          }
        )
      } catch {
        console.error('newsletter verification failed')
        return json(
          {
            status: 'error',
            message:
              'Could not send the verification email. Please try again later.',
            ...result
          },
          502
        )
      }
      return json({
        status: 'success',
        message:
          lead.locale === 'zh-CN'
            ? '请查收验证邮件，点击确认后订阅才会生效。'
            : 'Check your inbox. Your subscription becomes active after email verification.',
        ...result,
        user_notified: true,
        user_email_provider: 'central-cloudflare'
      })
    }

    if (hasLeadDatabaseConfig(env)) {
      const notionResult = await storeLeadInNotion(env, lead)
      result.stored_in_notion = true
      result.notion_page_id = notionResult.id
    }

    if (hasGrowthEmailTransport(env)) {
      const ownerEmail =
        normalizeEnv(env, 'LEAD_OWNER_EMAIL') || 'kenchikuliu@outlook.com'
      const reference = `CHARLII-${crypto.randomUUID()}`
      try {
        await sendGrowthEmail(env, {
          eventId: `contact:${reference}:owner`,
          templateId: 'contact_notification',
          to: ownerEmail,
          replyTo: lead.email,
          input: {
            reference,
            requester_name: [lead.firstName, lead.lastName]
              .filter(Boolean)
              .join(' '),
            requester_email: lead.email,
            product: lead.product || lead.service || lead.source,
            message: `Service: ${lead.service || 'not provided'}\nPreferred contact: ${lead.contactMethod || 'not provided'}\nMessage: ${lead.message || 'not provided'}\nPage: ${lead.pageUrl}\nReferrer: ${lead.referrer || 'direct'}\nIP: ${lead.ip || 'unknown'}\nUser agent: ${lead.userAgent || 'unknown'}`
          }
        })
        result.owner_notified = true
      } catch (error) {
        console.error('owner notification failed', error)
        return json(
          {
            status: 'error',
            message:
              'We could not deliver your request to the team. Please try again shortly.',
            ...result
          },
          502
        )
      }

      try {
        await sendGrowthEmail(env, {
          eventId: `contact:${reference}:receipt`,
          templateId: 'contact_received',
          to: lead.email,
          input: {
            reference,
            recipient_name: lead.firstName,
            expected_reply: 'two business days'
          }
        })
        result.user_notified = true
        result.user_email_provider = 'central-cloudflare'
      } catch (error) {
        console.error('user confirmation failed', error)
        return json(
          {
            status: 'error',
            message:
              'We could not send the confirmation email. Please try again shortly.',
            ...result
          },
          502
        )
      }
    } else {
      return json(
        {
          status: 'error',
          message: 'Lead email delivery is not configured.',
          ...result
        },
        503
      )
    }

    return json({
      status: 'success',
      message: 'Lead captured successfully.',
      ...result
    })
  } catch (error) {
    return json(
      {
        status: 'error',
        message:
          'Subscription is temporarily unavailable. Please try again later.',
        ...result
      },
      503
    )
  }
}
