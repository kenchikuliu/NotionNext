#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { get, list } from '@vercel/blob';

const DEFAULT_PREFIX = 'analytics/visitors/';
const DEFAULT_LIMIT = 5000;
const DEFAULT_MAX_READ_ERRORS = 25;
const DEFAULT_WARN_LIMIT = 5;
const FUNNEL_EVENTS = [
  'home_viewed',
  'page_intent_viewed',
  'article_viewed',
  'article_read_50',
  'article_read_90',
  'cta_clicked',
  'plan_selected',
  'pricing_viewed',
  'checkout_started',
  'checkout_cancelled',
  'form_submitted',
  'lead_submitted',
  'payment_succeeded',
];

function arg(name) {
  const eq = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(eq));
  if (hit) return hit.slice(eq.length);
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function usage() {
  console.log(`Analytics Blob Report

Usage:
  node scripts/analytics-blob-report.mjs
  node scripts/analytics-blob-report.mjs --include-smoke
  node scripts/analytics-blob-report.mjs --limit 1000 --out-dir tmp/analytics-blob-report/manual
  node scripts/analytics-blob-report.mjs --max-read-errors 100 --warn-limit 10

Required env:
  BLOB_READ_WRITE_TOKEN
`);
}

async function configureProxy() {
  const hasProxy =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.ALL_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy ||
    process.env.all_proxy;

  if (!hasProxy) return;

  try {
    const { EnvHttpProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new EnvHttpProxyAgent());
  } catch {
    // Continue without proxy support if undici is unavailable.
  }
}

function csvCell(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows, headers) {
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n');
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item) || '(unknown)';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function topMap(map, limit = 20) {
  return Object.fromEntries(Object.entries(map).slice(0, limit));
}

function topReadErrors(errors, limit = 5) {
  return Object.fromEntries(
    Object.entries(errors || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
  );
}

function readErrorMessage(error) {
  return String(error?.message || error || 'Unknown read error').slice(0, 300);
}

function visitorIdFromCacheKey(cacheKey = '') {
  const marker = ':visitor:';
  const index = cacheKey.lastIndexOf(marker);
  return index >= 0 ? cacheKey.slice(index + marker.length) : '';
}

function hashFromPathname(pathname = '') {
  return pathname.replace(DEFAULT_PREFIX, '').split('/')[0]?.replace(/\.json$/, '') || '';
}

function eventTimestamp(event = {}, fallback = '') {
  return event.received_at || event.occurred_at || fallback || '';
}

function isTestVisitor(visitor) {
  const visitorId = visitor.visitor_id || '';
  const firstTouch = visitor.first_touch || {};
  const sourcePage = String(visitor.source_page || '').toLowerCase();
  if (visitorId.startsWith('codex-')) return true;
  if (firstTouch.traffic_source === 'codex' || firstTouch.utm_source === 'codex') return true;
  if (sourcePage.includes('codex') || sourcePage.includes('smoke')) return true;
  return visitor.events.some((event) => {
    const properties = event.properties || {};
    const haystack = [
      event.source,
      properties.source,
      properties.session_id,
      properties.order_no,
      properties.page_path,
      properties.landing_page,
      properties.href
    ].map((value) => String(value || '').toLowerCase()).join(' ');

    return haystack.includes('codex') || haystack.includes('smoke');
  });
}

function ensureVisitor(visitors, key, visitorHash = '') {
  if (!visitors.has(key)) {
    visitors.set(key, {
      visitor_key: key,
      visitor_hash: visitorHash,
      visitor_id: visitorIdFromCacheKey(key),
      user_id: '',
      source_page: '',
      first_touch: null,
      first_seen_at: '',
      last_seen_at: '',
      events: [],
    });
  }
  return visitors.get(key);
}

function updateSeen(visitor, timestamp) {
  if (!timestamp) return;
  if (!visitor.first_seen_at || timestamp < visitor.first_seen_at) {
    visitor.first_seen_at = timestamp;
  }
  if (!visitor.last_seen_at || timestamp > visitor.last_seen_at) {
    visitor.last_seen_at = timestamp;
  }
}

function addEvent(visitor, event, fallbackTimestamp = '') {
  if (!event || typeof event !== 'object') return;
  const receivedAt = eventTimestamp(event, fallbackTimestamp);
  const nextEvent = {
    ...event,
    received_at: receivedAt,
  };
  visitor.events.push(nextEvent);
  updateSeen(visitor, receivedAt);
}

function applyRecord(visitors, record, visitorHash = '') {
  if (!record || typeof record !== 'object') return;

  const cacheKey = record.cache_key || visitorHash;
  const visitor = ensureVisitor(visitors, cacheKey, visitorHash);
  if (!visitor.visitor_id) visitor.visitor_id = visitorIdFromCacheKey(cacheKey);

  if (record.first_touch && typeof record.first_touch === 'object' && !visitor.first_touch) {
    visitor.first_touch = record.first_touch;
  }
  if (record.user_id) visitor.user_id = record.user_id;
  if (record.source_page) visitor.source_page = record.source_page;

  addEvent(visitor, record.event, record.received_at);
  updateSeen(visitor, record.received_at);
}

function applyLegacyState(visitors, state, visitorHash = '') {
  if (!state || typeof state !== 'object') return;

  const cacheKey = state.cache_key || visitorHash;
  const visitor = ensureVisitor(visitors, cacheKey, visitorHash);
  if (!visitor.visitor_id) visitor.visitor_id = visitorIdFromCacheKey(cacheKey);
  if (state.first_touch && typeof state.first_touch === 'object' && !visitor.first_touch) {
    visitor.first_touch = state.first_touch;
  }
  if (state.user_id) visitor.user_id = state.user_id;
  if (state.source_page) visitor.source_page = state.source_page;
  updateSeen(visitor, state.created_at);
  updateSeen(visitor, state.updated_at);

  for (const event of Array.isArray(state.events) ? state.events : []) {
    addEvent(visitor, event, state.updated_at);
  }
}

function dedupeVisitorEvents(visitor) {
  const seen = new Set();
  visitor.events = visitor.events
    .filter((event) => {
      const key = [
        event.received_at || '',
        event.occurred_at || '',
        event.event_name || '',
        event.source || '',
        JSON.stringify(event.properties || {}),
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => String(a.received_at || '').localeCompare(String(b.received_at || '')));
}

async function readBlobJson(pathname) {
  const result = await get(pathname, {
    access: 'private',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  if (!result?.stream) return null;
  const raw = await new Response(result.stream).text();
  return raw ? JSON.parse(raw) : null;
}

async function listBlobItems(prefix, maxBlobs) {
  const items = [];
  let cursor;

  do {
    const remaining = maxBlobs - items.length;
    const result = await list({
      prefix,
      cursor,
      limit: Math.min(1000, remaining),
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    items.push(...(result.blobs || []));
    cursor = result.hasMore && items.length < maxBlobs ? result.cursor : undefined;
  } while (cursor && items.length < maxBlobs);

  return items;
}

function buildRows(visitors) {
  const visitorRows = visitors.map((visitor) => {
    const firstTouch = visitor.first_touch || {};
    return {
      visitor_id: visitor.visitor_id,
      user_id: visitor.user_id,
      first_seen_at: visitor.first_seen_at,
      last_seen_at: visitor.last_seen_at,
      event_count: visitor.events.length,
      traffic_source: firstTouch.traffic_source || firstTouch.utm_source || '',
      traffic_medium: firstTouch.traffic_medium || firstTouch.utm_medium || '',
      traffic_campaign: firstTouch.traffic_campaign || firstTouch.utm_campaign || '',
      landing_page: firstTouch.landing_page || '',
      referrer_host: firstTouch.referrer_host || '',
      source_page: visitor.source_page,
      has_first_touch: Boolean(visitor.first_touch),
      is_test: isTestVisitor(visitor),
    };
  });

  const eventRows = visitors.flatMap((visitor) => {
    const firstTouch = visitor.first_touch || {};
    return visitor.events.map((event) => {
      const properties = event.properties || {};
      return {
        visitor_id: visitor.visitor_id,
        received_at: event.received_at || '',
        occurred_at: event.occurred_at || '',
        event_name: event.event_name || '',
        source: event.source || '',
        page_path: properties.page_path || '',
        intent: properties.intent || '',
        product: properties.product || '',
        service: properties.service || '',
        label: properties.label || '',
        href: properties.href || '',
        cta_position: properties.cta_position || '',
        checkout_type: properties.checkout_type || '',
        provider: properties.provider || '',
        form_name: properties.form_name || '',
        traffic_source: firstTouch.traffic_source || firstTouch.utm_source || '',
        landing_page: firstTouch.landing_page || '',
        is_test: isTestVisitor(visitor),
      };
    });
  });

  return { visitorRows, eventRows };
}

function buildSummary(allVisitors, visibleVisitors, blobItems, includeSmoke, readStats) {
  const visibleEvents = visibleVisitors.flatMap((visitor) => visitor.events);
  const eventCounts = countBy(visibleEvents, (event) => event.event_name);
  const visitorFunnel = {};
  for (const eventName of FUNNEL_EVENTS) {
    const visitorsWithEvent = visibleVisitors.filter((visitor) =>
      visitor.events.some((event) => event.event_name === eventName)
    );
    visitorFunnel[eventName] = {
      visitors: visitorsWithEvent.length,
      events: eventCounts[eventName] || 0,
    };
  }

  const sourceCounts = countBy(visibleVisitors, (visitor) => {
    const firstTouch = visitor.first_touch || {};
    return firstTouch.traffic_source || firstTouch.utm_source || 'direct';
  });
  const landingCounts = countBy(visibleVisitors, (visitor) => visitor.first_touch?.landing_page || '(unknown)');
  const leadVisitors = visibleVisitors.filter((visitor) =>
    visitor.events.some((event) => event.event_name === 'lead_submitted')
  );
  const paidVisitors = visibleVisitors.filter((visitor) =>
    visitor.events.some((event) => event.event_name === 'payment_succeeded')
  );

  return {
    generated_at: new Date().toISOString(),
    blob: {
      prefix: DEFAULT_PREFIX,
      objects_scanned: blobItems.length,
      record_objects: blobItems.filter((item) => item.pathname.includes('/records/')).length,
      legacy_state_objects: blobItems.filter((item) => !item.pathname.includes('/records/')).length,
      read_successes: readStats.successes,
      read_skipped: readStats.skipped,
      read_errors: topReadErrors(readStats.errors),
    },
    filters: {
      include_smoke: includeSmoke,
      excluded_test_visitors: allVisitors.length - visibleVisitors.length,
    },
    visitors: {
      total: visibleVisitors.length,
      with_first_touch: visibleVisitors.filter((visitor) => visitor.first_touch).length,
      with_user_id: visibleVisitors.filter((visitor) => visitor.user_id).length,
      with_lead: leadVisitors.length,
      with_payment: paidVisitors.length,
    },
    events: {
      total: visibleEvents.length,
      by_name: eventCounts,
      funnel: visitorFunnel,
    },
    acquisition: {
      top_sources: topMap(sourceCounts),
      top_landing_pages: topMap(landingCounts),
    },
    latest_visitors: visibleVisitors
      .slice()
      .sort((a, b) => String(b.last_seen_at || '').localeCompare(String(a.last_seen_at || '')))
      .slice(0, 20)
      .map((visitor) => ({
        visitor_id: visitor.visitor_id,
        last_seen_at: visitor.last_seen_at,
        event_count: visitor.events.length,
        traffic_source: visitor.first_touch?.traffic_source || visitor.first_touch?.utm_source || '',
        landing_page: visitor.first_touch?.landing_page || '',
        last_event: visitor.events.at(-1)?.event_name || '',
      })),
  };
}

function buildMarkdown(summary, outDir) {
  const funnelLines = Object.entries(summary.events.funnel).map(
    ([eventName, stats]) => `| ${eventName} | ${stats.visitors} | ${stats.events} |`
  );
  const sourceLines = Object.entries(summary.acquisition.top_sources).map(
    ([source, count]) => `| ${source} | ${count} |`
  );

  return [
    '# Analytics Blob Report',
    '',
    `Generated at: ${summary.generated_at}`,
    `Output: ${outDir}`,
    '',
    `Visitors: ${summary.visitors.total}`,
    `Visitors with first-touch: ${summary.visitors.with_first_touch}`,
    `Visitors with lead: ${summary.visitors.with_lead}`,
    `Visitors with payment: ${summary.visitors.with_payment}`,
    `Events: ${summary.events.total}`,
    `Blob read skipped: ${summary.blob.read_skipped}`,
    `Excluded test visitors: ${summary.filters.excluded_test_visitors}`,
    '',
    '## Funnel',
    '',
    '| Event | Visitors | Events |',
    '| --- | ---: | ---: |',
    ...funnelLines,
    '',
    '## Sources',
    '',
    '| Source | Visitors |',
    '| --- | ---: |',
    ...sourceLines,
    '',
  ].join('\n');
}

async function run() {
  await configureProxy();
  if (hasFlag('help') || hasFlag('h')) {
    usage();
    process.exit(0);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN. Run `vercel env pull /tmp/charlii.env` and source it, or set the env manually.');
  }

  const prefix = arg('prefix') || DEFAULT_PREFIX;
  const limit = Number(arg('limit') || DEFAULT_LIMIT);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('--limit must be a positive integer');
  }
  const maxReadErrors = Number(arg('max-read-errors') || DEFAULT_MAX_READ_ERRORS);
  if (!Number.isInteger(maxReadErrors) || maxReadErrors < 1) {
    throw new Error('--max-read-errors must be a positive integer');
  }
  const warnLimit = Number(arg('warn-limit') || DEFAULT_WARN_LIMIT);
  if (!Number.isInteger(warnLimit) || warnLimit < 0) {
    throw new Error('--warn-limit must be a non-negative integer');
  }

  const includeSmoke = hasFlag('include-smoke');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(arg('out-dir') || path.join('tmp', 'analytics-blob-report', timestamp));
  const blobItems = await listBlobItems(prefix, limit);
  const visitors = new Map();
  const readStats = {
    successes: 0,
    skipped: 0,
    errors: {},
  };
  let consecutiveReadErrors = 0;

  for (const item of blobItems) {
    let json = null;
    try {
      json = await readBlobJson(item.pathname);
      consecutiveReadErrors = 0;
      if (json) readStats.successes += 1;
    } catch (error) {
      const message = readErrorMessage(error);
      readStats.skipped += 1;
      readStats.errors[message] = (readStats.errors[message] || 0) + 1;
      consecutiveReadErrors += 1;

      if (readStats.skipped <= warnLimit) {
        console.warn(`[analytics-blob-report] skipped ${item.pathname}: ${message}`);
      } else if (readStats.skipped === warnLimit + 1) {
        console.warn('[analytics-blob-report] further skipped blob reads suppressed; see summary blob.read_errors.');
      }

      if (readStats.successes === 0 && consecutiveReadErrors >= maxReadErrors) {
        const topError = Object.entries(readStats.errors).sort((a, b) => b[1] - a[1])[0]?.[0] || message;
        throw new Error(
          `Blob listing succeeded but the first ${consecutiveReadErrors} object reads failed. ` +
            `Top error: ${topError}. Check BLOB_READ_WRITE_TOKEN store/access, or raise --max-read-errors.`
        );
      }

      continue;
    }
    if (!json) continue;

    const visitorHash = hashFromPathname(item.pathname);
    if (item.pathname.includes('/records/')) {
      applyRecord(visitors, json, visitorHash);
    } else {
      applyLegacyState(visitors, json, visitorHash);
    }
  }

  const allVisitors = [...visitors.values()];
  for (const visitor of allVisitors) {
    dedupeVisitorEvents(visitor);
  }

  const visibleVisitors = includeSmoke ? allVisitors : allVisitors.filter((visitor) => !isTestVisitor(visitor));
  const { visitorRows, eventRows } = buildRows(visibleVisitors);
  const summary = buildSummary(allVisitors, visibleVisitors, blobItems, includeSmoke, readStats);
  const report = buildMarkdown(summary, outDir);

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  await fs.writeFile(path.join(outDir, 'visitors.csv'), toCsv(visitorRows, [
    'visitor_id',
    'user_id',
    'first_seen_at',
    'last_seen_at',
    'event_count',
    'traffic_source',
    'traffic_medium',
    'traffic_campaign',
    'landing_page',
    'referrer_host',
    'source_page',
    'has_first_touch',
    'is_test',
  ]));
  await fs.writeFile(path.join(outDir, 'events.csv'), toCsv(eventRows, [
    'visitor_id',
    'received_at',
    'occurred_at',
    'event_name',
    'source',
    'page_path',
    'intent',
    'product',
    'service',
    'label',
    'href',
    'cta_position',
    'checkout_type',
    'provider',
    'form_name',
    'traffic_source',
    'landing_page',
    'is_test',
  ]));
  await fs.writeFile(path.join(outDir, 'report.md'), report);

  const latestDir = path.resolve('tmp', 'analytics-blob-report');
  await fs.mkdir(latestDir, { recursive: true });
  await fs.writeFile(path.join(latestDir, 'latest-summary.json'), JSON.stringify(summary, null, 2));
  await fs.writeFile(path.join(latestDir, 'latest-report.md'), report);

  console.log(report);
}

run().catch((error) => {
  console.error('[analytics-blob-report] failed:', error?.message || error);
  process.exit(1);
});
