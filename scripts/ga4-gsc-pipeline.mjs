#!/usr/bin/env node
import { createSign } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];
function arg(name) {
  const eq = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(eq));
  if (hit) return hit.slice(eq.length);
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

function usage() {
  console.log(`GA4 + GSC pipeline\n\nUsage:\n  node scripts/ga4-gsc-pipeline.mjs\n  node scripts/ga4-gsc-pipeline.mjs --days 7\n  node scripts/ga4-gsc-pipeline.mjs --start-date 2026-05-01 --end-date 2026-05-10\n\nRequired env:\n  GA4_PROPERTY_ID\n  GSC_SITE_URL\n  GOOGLE_API_ACCESS_TOKEN OR GOOGLE_SERVICE_ACCOUNT_KEY_JSON/GOOGLE_SERVICE_ACCOUNT_KEY_PATH OR (GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_OAUTH_REFRESH_TOKEN)`);
}

function utcDate(d) {
  return d.toISOString().slice(0, 10);
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
    // If undici is not installed, continue without dispatcher override.
  }
}

async function requestText(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(5_000) });
    return { ok: response.ok, status: response.status, text: await response.text() };
  } catch {
    const args = ['--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', '--request', options.method || 'GET'];
    for (const [name, value] of Object.entries(options.headers || {})) {
      args.push('--header', `${name}: ${value}`);
    }
    if (options.body !== undefined) args.push('--data-binary', String(options.body));
    args.push('--write-out', '\n%{http_code}', url);
    const { stdout } = await execFile('curl', args, { env: process.env, maxBuffer: 20 * 1024 * 1024 });
    const splitAt = stdout.lastIndexOf('\n');
    const status = Number(stdout.slice(splitAt + 1));
    return { ok: status >= 200 && status < 300, status, text: stdout.slice(0, splitAt) };
  }
}

function minusDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return utcDate(d);
}

async function getAccessToken() {
  const direct = process.env.GOOGLE_API_ACCESS_TOKEN?.trim();
  if (direct) return direct;

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON?.trim();
  const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim();
  if (serviceAccountJson || serviceAccountPath) {
    const raw = serviceAccountJson || (await fs.readFile(serviceAccountPath, 'utf8'));
    const key = JSON.parse(raw);
    if (!key.client_email || !key.private_key) {
      throw new Error('Service account key must include client_email and private_key.');
    }

    const tokenUri = key.token_uri || 'https://oauth2.googleapis.com/token';
    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const signingInput = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: key.client_email,
      scope: GOOGLE_SCOPES.join(' '),
      aud: tokenUri,
      exp: now + 3600,
      iat: now,
    })}`;
    const signature = createSign('RSA-SHA256').update(signingInput).sign(key.private_key);
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${signature.toString('base64url')}`,
    });
    const response = await requestText(tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = response.text;
    if (!response.ok) throw new Error(`Service account token failed: ${response.status} ${text}`);
    const token = JSON.parse(text).access_token;
    if (!token) throw new Error('Service account token response missing access_token.');
    return token;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing auth env. Provide an access token, service account key, or OAuth trio.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await requestText('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const txt = res.text;
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${txt}`);

  const json = JSON.parse(txt);
  if (!json.access_token) throw new Error('Token response missing access_token');
  return json.access_token;
}

async function postJson(url, token, body) {
  const res = await requestText(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = res.text;
  let json = {};
  try {
    json = txt ? JSON.parse(txt) : {};
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${txt.slice(0, 500)}`);
  }
  if (!res.ok) throw new Error(`Request failed ${res.status} ${url}: ${JSON.stringify(json).slice(0, 1200)}`);
  return json;
}

function num(v) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function pct(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

async function run() {
  await configureProxy();
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    process.exit(0);
  }

  const daysArg = arg('days');
  const days = daysArg ? Number(daysArg) : 28;
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new Error('--days must be an integer between 1 and 365');
  }

  const endDate = arg('end-date') || minusDays(utcDate(new Date()), 1);
  const startDate = arg('start-date') || minusDays(endDate, days - 1);
  const prevEndDate = minusDays(startDate, 1);
  const prevStartDate = minusDays(prevEndDate, days - 1);

  const ga4PropertyId = (process.env.GA4_PROPERTY_ID || '').replace('properties/', '').trim();
  const gscSiteUrl = (process.env.GSC_SITE_URL || '').trim();
  const siteOrigin = (process.env.PIPELINE_SITE_ORIGIN || '').trim();

  if (!ga4PropertyId) throw new Error('Missing GA4_PROPERTY_ID');
  if (!gscSiteUrl) throw new Error('Missing GSC_SITE_URL');
  if (gscSiteUrl.startsWith('sc-domain:') && !siteOrigin) {
    throw new Error('Missing PIPELINE_SITE_ORIGIN for sc-domain property');
  }

  const token = await getAccessToken();

  const gscUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl)}/searchAnalytics/query`;
  const ga4Url = `https://analyticsdata.googleapis.com/v1beta/properties/${ga4PropertyId}:runReport`;

  const gscCurrent = await postJson(gscUrl, token, {
    startDate,
    endDate,
    rowLimit: 1,
  });
  const gscPrevious = await postJson(gscUrl, token, {
    startDate: prevStartDate,
    endDate: prevEndDate,
    rowLimit: 1,
  });

  const ga4Payload = (s, e) => ({
    dateRanges: [{ startDate: s, endDate: e }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'engagedSessions' },
      { name: 'eventCount' },
    ],
    limit: '1',
  });

  const ga4Current = await postJson(ga4Url, token, ga4Payload(startDate, endDate));
  const ga4Previous = await postJson(ga4Url, token, ga4Payload(prevStartDate, prevEndDate));

  const gscCur = gscCurrent.rows?.[0] || {};
  const gscPrev = gscPrevious.rows?.[0] || {};
  const ga4Cur = ga4Current.rows?.[0]?.metricValues || [];
  const ga4Prev = ga4Previous.rows?.[0]?.metricValues || [];

  const summary = {
    generatedAt: new Date().toISOString(),
    ranges: {
      current: { startDate, endDate },
      previous: { startDate: prevStartDate, endDate: prevEndDate },
    },
    config: {
      ga4PropertyId,
      gscSiteUrl,
      siteOrigin,
    },
    gsc: {
      current: {
        clicks: num(gscCur.clicks),
        impressions: num(gscCur.impressions),
        ctr: num(gscCur.ctr),
        position: num(gscCur.position),
      },
      previous: {
        clicks: num(gscPrev.clicks),
        impressions: num(gscPrev.impressions),
        ctr: num(gscPrev.ctr),
        position: num(gscPrev.position),
      },
    },
    ga4: {
      current: {
        sessions: num(ga4Cur[0]?.value),
        totalUsers: num(ga4Cur[1]?.value),
        engagedSessions: num(ga4Cur[2]?.value),
        eventCount: num(ga4Cur[3]?.value),
      },
      previous: {
        sessions: num(ga4Prev[0]?.value),
        totalUsers: num(ga4Prev[1]?.value),
        engagedSessions: num(ga4Prev[2]?.value),
        eventCount: num(ga4Prev[3]?.value),
      },
    },
  };

  const delta = {
    gsc: {
      clicks: pct(summary.gsc.current.clicks, summary.gsc.previous.clicks),
      impressions: pct(summary.gsc.current.impressions, summary.gsc.previous.impressions),
    },
    ga4: {
      sessions: pct(summary.ga4.current.sessions, summary.ga4.previous.sessions),
      totalUsers: pct(summary.ga4.current.totalUsers, summary.ga4.previous.totalUsers),
    },
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'tmp', 'ga4-gsc-pipeline', ts);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'summary.json'), JSON.stringify({ ...summary, delta }, null, 2));

  const report = [
    `# GA4 + GSC Pipeline Report`,
    '',
    `Generated at: ${summary.generatedAt}`,
    `Site: ${gscSiteUrl}`,
    `GA4 property: ${ga4PropertyId}`,
    '',
    `Current range: ${startDate} ~ ${endDate}`,
    `Previous range: ${prevStartDate} ~ ${prevEndDate}`,
    '',
    `GSC clicks: ${summary.gsc.current.clicks} (prev ${summary.gsc.previous.clicks})`,
    `GSC impressions: ${summary.gsc.current.impressions} (prev ${summary.gsc.previous.impressions})`,
    `GA4 sessions: ${summary.ga4.current.sessions} (prev ${summary.ga4.previous.sessions})`,
    `GA4 users: ${summary.ga4.current.totalUsers} (prev ${summary.ga4.previous.totalUsers})`,
    '',
    `Output: ${outDir}`,
  ].join('\n');

  await fs.writeFile(path.join(outDir, 'report.md'), report);
  const latestDir = path.join(process.cwd(), 'tmp', 'ga4-gsc-pipeline');
  await fs.writeFile(path.join(latestDir, 'latest-report.md'), report);

  console.log(report);
}

run().catch((err) => {
  console.error('[ga4-gsc-pipeline] failed:', err?.message || err);
  process.exit(1);
});
