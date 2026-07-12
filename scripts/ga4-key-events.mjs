#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

function arg(name) {
  const eq = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(eq));
  if (hit) return hit.slice(eq.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return undefined;
}

function usage() {
  console.log(`GA4 key event setup

Usage:
  node scripts/ga4-key-events.mjs --dry-run
  node scripts/ga4-key-events.mjs
  node scripts/ga4-key-events.mjs --property-id 123456789

Required env:
  GA4_PROPERTY_ID
  GOOGLE_API_ACCESS_TOKEN OR (GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET + GOOGLE_OAUTH_REFRESH_TOKEN)

Optional:
  --config analytics/ga4-key-events.json
  --counting-method ONCE_PER_SESSION
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
    // Continue without proxy dispatcher when undici is unavailable.
  }
}

async function getAccessToken() {
  const direct = process.env.GOOGLE_API_ACCESS_TOKEN?.trim();
  if (direct) return direct;

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing auth env. Provide GOOGLE_API_ACCESS_TOKEN or OAuth trio.');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Token refresh failed: ${response.status} ${text}`);

  const json = JSON.parse(text);
  if (!json.access_token) throw new Error('Token response missing access_token');
  return json.access_token;
}

async function requestJson(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    const error = new Error(`Request failed ${response.status} ${url}: ${JSON.stringify(json).slice(0, 1200)}`);
    error.status = response.status;
    error.payload = json;
    throw error;
  }

  return json;
}

async function loadConfig(configPath) {
  const absolutePath = path.resolve(process.cwd(), configPath);
  const config = JSON.parse(await fs.readFile(absolutePath, 'utf8'));
  const keyEvents = (config.keyEvents || []).map((event) => {
    if (typeof event === 'string') return { eventName: event };
    return event;
  });

  if (!keyEvents.length) {
    throw new Error(`No keyEvents found in ${configPath}`);
  }

  return { config, keyEvents };
}

async function listKeyEvents(propertyId, token) {
  const events = [];
  let pageToken = '';

  do {
    const query = new URLSearchParams({ pageSize: '200' });
    if (pageToken) query.set('pageToken', pageToken);

    const json = await requestJson(
      `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/keyEvents?${query.toString()}`,
      token
    );

    events.push(...(json.keyEvents || []));
    pageToken = json.nextPageToken || '';
  } while (pageToken);

  return events;
}

async function createKeyEvent(propertyId, token, eventName, countingMethod) {
  return requestJson(
    `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/keyEvents`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        eventName,
        countingMethod,
      }),
    }
  );
}

async function run() {
  await configureProxy();
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    process.exit(0);
  }

  const configPath = arg('config') || 'analytics/ga4-key-events.json';
  const propertyId = (arg('property-id') || process.env.GA4_PROPERTY_ID || '')
    .replace('properties/', '')
    .trim();
  const dryRun = process.argv.includes('--dry-run');
  const defaultCountingMethod = arg('counting-method') || 'ONCE_PER_SESSION';

  if (!propertyId) throw new Error('Missing GA4_PROPERTY_ID or --property-id');

  const { config, keyEvents } = await loadConfig(configPath);
  const token = await getAccessToken();
  const existing = await listKeyEvents(propertyId, token);
  const existingNames = new Set(existing.map((event) => event.eventName));

  console.log(`GA4 property: ${propertyId}`);
  console.log(`Site: ${config.site || 'unknown'}`);
  console.log(`Config: ${configPath}`);
  console.log(dryRun ? 'Mode: dry-run' : 'Mode: create missing key events');

  for (const event of keyEvents) {
    const eventName = event.eventName;
    const countingMethod = event.countingMethod || defaultCountingMethod;

    if (!/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) {
      throw new Error(`Invalid GA4 event name: ${eventName}`);
    }

    if (existingNames.has(eventName)) {
      console.log(`exists  ${eventName}`);
      continue;
    }

    if (dryRun) {
      console.log(`create  ${eventName} (${countingMethod})`);
      continue;
    }

    try {
      await createKeyEvent(propertyId, token, eventName, countingMethod);
      console.log(`created ${eventName} (${countingMethod})`);
    } catch (error) {
      if (error.status === 409 || /already exists/i.test(error.message)) {
        console.log(`exists  ${eventName}`);
        continue;
      }
      throw error;
    }
  }
}

run().catch((error) => {
  console.error('[ga4-key-events] failed:', error?.message || error);
  process.exit(1);
});
