#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const NOTION_API_BASE = 'https://api.notion.com/v1'
const DEFAULT_NOTION_VERSION = '2022-06-28'
const DEFAULT_MAX_PAGES = 1000
const TERMINAL_STATUSES = new Set(['won', 'lost', 'nurture'])
const OPEN_STATUSES = new Set([
  '',
  'submitted',
  'waitlist',
  'new',
  'contacted',
  'qualified'
])

function arg(name) {
  const eq = `--${name}=`
  const hit = process.argv.find(item => item.startsWith(eq))
  if (hit) return hit.slice(eq.length)
  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  return undefined
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function parseEnvText(text) {
  const env = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[match[1]] = value.replace(/\\n/g, '').replace(/\\-/g, '-')
  }
  return env
}

async function loadEnv() {
  const file = arg('env-file')
  if (!file) return process.env
  return {
    ...process.env,
    ...parseEnvText(await fs.readFile(file, 'utf8'))
  }
}

function normalizeDatabaseId(value = '') {
  const hex = String(value).match(/[a-fA-F0-9]/g)?.join('') || ''
  return hex.slice(0, 32)
}

function normalizeStatus(value = '') {
  return String(value || '').trim().toLowerCase()
}

function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(rows, headers) {
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(','))
  ].join('\n')
}

function propertyText(property) {
  if (!property) return ''
  if (property.type === 'title') {
    return (property.title || []).map(item => item.plain_text || '').join('')
  }
  if (property.type === 'rich_text') {
    return (property.rich_text || [])
      .map(item => item.plain_text || '')
      .join('')
  }
  if (property.type === 'email') return property.email || ''
  if (property.type === 'url') return property.url || ''
  if (property.type === 'select') return property.select?.name || ''
  if (property.type === 'status') return property.status?.name || ''
  if (property.type === 'number') return property.number ?? ''
  if (property.type === 'date') return property.date?.start || ''
  if (property.type === 'checkbox') return property.checkbox ? 'true' : ''
  return ''
}

function findByPriority(schema, checks) {
  for (const check of checks) {
    const entry = Object.entries(schema).find(([name, property]) =>
      check(name, property)
    )
    if (entry) return entry
  }
  return null
}

function detectProperties(schema) {
  return {
    status: findByPriority(schema, [
      (name, property) =>
        ['select', 'status'].includes(property.type) && /^status$/i.test(name),
      (name, property) =>
        ['select', 'status'].includes(property.type) &&
        /lead status|outcome status|stage/i.test(name)
    ]),
    revenue: findByPriority(schema, [
      (name, property) =>
        property.type === 'number' && /^revenue usd$/i.test(name),
      (name, property) =>
        property.type === 'number' && /revenue|amount|value|usd/i.test(name)
    ]),
    closedAt: findByPriority(schema, [
      (name, property) =>
        property.type === 'date' && /^closed at$/i.test(name),
      (name, property) =>
        property.type === 'date' && /closed|close|won at|lost at/i.test(name)
    ]),
    outcomeNote: findByPriority(schema, [
      (name, property) =>
        property.type === 'rich_text' && /^outcome note$/i.test(name),
      (name, property) =>
        property.type === 'rich_text' && /outcome.*note|reason/i.test(name)
    ]),
    pageUrl: findByPriority(schema, [
      (name, property) => property.type === 'url' && /^pageurl$/i.test(name),
      (name, property) =>
        ['url', 'rich_text'].includes(property.type) &&
        /page[-_ ]?url|landing|source|url/i.test(name)
    ])
  }
}

function hasOption(property, optionName) {
  if (!property) return false
  const options =
    property.type === 'status'
      ? property.status?.options || []
      : property.select?.options || []
  return options.some(option => option.name === optionName)
}

function buildStatusUpdate(property, status) {
  if (property.type === 'status') {
    return { status: { name: status } }
  }
  return { select: { name: status } }
}

async function notionRequest(env, requestPath, init = {}) {
  const response = await fetch(`${NOTION_API_BASE}${requestPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': env.NOTION_API_VERSION || DEFAULT_NOTION_VERSION,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(data?.message || `Notion request failed: ${response.status}`)
  }
  return data
}

async function listLeadPages(env, databaseId, maxPages) {
  const rows = []
  let cursor
  do {
    const body = {
      page_size: Math.min(100, maxPages - rows.length),
      sorts: [{ timestamp: 'created_time', direction: 'descending' }]
    }
    if (cursor) body.start_cursor = cursor
    const result = await notionRequest(env, `/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body)
    })
    rows.push(...(result.results || []))
    cursor = result.has_more ? result.next_cursor : null
  } while (cursor && rows.length < maxPages)
  return rows
}

function summarizeRows(pages, detected) {
  const rows = pages.map(page => {
    const properties = page.properties || {}
    const status = detected.status
      ? propertyText(properties[detected.status[0]])
      : ''
    const revenue = detected.revenue
      ? Number(propertyText(properties[detected.revenue[0]]) || 0)
      : 0
    const closedAt = detected.closedAt
      ? propertyText(properties[detected.closedAt[0]])
      : ''
    const outcomeNote = detected.outcomeNote
      ? propertyText(properties[detected.outcomeNote[0]])
      : ''

    return {
      page_id: page.id,
      created_time: page.created_time,
      status,
      revenue_usd: Number.isFinite(revenue) ? revenue : 0,
      closed_at: closedAt,
      has_outcome_note: Boolean(outcomeNote),
      page_url: detected.pageUrl
        ? propertyText(properties[detected.pageUrl[0]])
        : '',
      notion_url: page.url || ''
    }
  })

  const statusCounts = {}
  for (const row of rows) {
    const key = row.status || '(empty)'
    statusCounts[key] = (statusCounts[key] || 0) + 1
  }

  const unresolvedRows = rows.filter(row => {
    const status = normalizeStatus(row.status)
    if (TERMINAL_STATUSES.has(status)) return false
    if (row.closed_at || row.has_outcome_note || row.revenue_usd > 0) return false
    return OPEN_STATUSES.has(status) || !status
  })

  const closedRows = rows.filter(row => {
    const status = normalizeStatus(row.status)
    return (
      TERMINAL_STATUSES.has(status) ||
      row.closed_at ||
      row.has_outcome_note ||
      row.revenue_usd > 0
    )
  })

  return {
    rows,
    summary: {
      lead_count: rows.length,
      status_counts: statusCounts,
      closed_or_outcome_count: closedRows.length,
      unresolved_count: unresolvedRows.length,
      revenue_rows: rows.filter(row => row.revenue_usd > 0).length,
      revenue_total_usd: rows.reduce((sum, row) => sum + row.revenue_usd, 0)
    },
    unresolvedRows
  }
}

async function writeOutputs(outDir, summary, rows, unresolvedRows) {
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(
    path.join(outDir, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`
  )
  await fs.writeFile(
    path.join(outDir, 'leads.csv'),
    `${toCsv(rows, [
      'page_id',
      'created_time',
      'status',
      'revenue_usd',
      'closed_at',
      'has_outcome_note',
      'page_url',
      'notion_url'
    ])}\n`
  )
  await fs.writeFile(
    path.join(outDir, 'unresolved-leads.csv'),
    `${toCsv(unresolvedRows, [
      'page_id',
      'created_time',
      'status',
      'revenue_usd',
      'closed_at',
      'has_outcome_note',
      'page_url',
      'notion_url'
    ])}\n`
  )
}

async function applyDefaultStatus(env, pages, detected, statusName) {
  const statusEntry = detected.status
  if (!statusEntry) {
    throw new Error('Unable to detect a Status select/status property')
  }
  const [statusPropertyName, statusProperty] = statusEntry
  if (!hasOption(statusProperty, statusName)) {
    throw new Error(`Status option does not exist: ${statusName}`)
  }

  let updated = 0
  for (const page of pages) {
    const current = propertyText(page.properties?.[statusPropertyName])
    if (current) continue
    await notionRequest(env, `/pages/${page.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          [statusPropertyName]: buildStatusUpdate(statusProperty, statusName)
        }
      })
    })
    updated += 1
    await new Promise(resolve => setTimeout(resolve, 80))
  }
  return updated
}

async function main() {
  const env = await loadEnv()
  const databaseId = normalizeDatabaseId(
    env.LEAD_NOTION_DATABASE_ID || env.NOTION_LEAD_DATABASE_ID || ''
  )
  if (!env.NOTION_API_KEY || databaseId.length !== 32) {
    throw new Error('NOTION_API_KEY and LEAD_NOTION_DATABASE_ID are required')
  }

  const maxPages = Number(arg('max-pages') || DEFAULT_MAX_PAGES)
  const outDir = path.resolve(
    arg('out-dir') ||
      path.join(
        'tmp',
        'notion-lead-outcome-report',
        new Date().toISOString().replace(/[:.]/g, '-')
      )
  )
  const defaultStatus = arg('apply-default-status')

  const database = await notionRequest(env, `/databases/${databaseId}`)
  const detected = detectProperties(database.properties || {})
  const pages = await listLeadPages(env, databaseId, maxPages)

  let appliedDefaultStatus = 0
  if (defaultStatus) {
    if (!hasFlag('yes')) {
      throw new Error(
        '--apply-default-status requires --yes because it writes to Notion'
      )
    }
    appliedDefaultStatus = await applyDefaultStatus(
      env,
      pages,
      detected,
      defaultStatus
    )
  }

  const refreshedPages = defaultStatus
    ? await listLeadPages(env, databaseId, maxPages)
    : pages
  const { rows, summary, unresolvedRows } = summarizeRows(
    refreshedPages,
    detected
  )
  const output = {
    generated_at: new Date().toISOString(),
    database_title: (database.title || [])
      .map(item => item.plain_text || '')
      .join(''),
    detected_properties: {
      status: detected.status?.[0] || null,
      revenue: detected.revenue?.[0] || null,
      closed_at: detected.closedAt?.[0] || null,
      outcome_note: detected.outcomeNote?.[0] || null,
      page_url: detected.pageUrl?.[0] || null
    },
    applied_default_status: defaultStatus || null,
    applied_default_status_count: appliedDefaultStatus,
    ...summary
  }

  await writeOutputs(outDir, output, rows, unresolvedRows)
  console.log(JSON.stringify({ out_dir: outDir, ...output }, null, 2))
}

main().catch(error => {
  console.error(`[notion-lead-outcome-report] ${error?.message || error}`)
  process.exit(1)
})
