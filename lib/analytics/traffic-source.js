export function resolveTrafficSource({ referrer, currentHostname, campaignSource }) {
  let referrerHost

  if (referrer) {
    try {
      const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '')
      const currentHost = (currentHostname || '')
        .toLowerCase()
        .replace(/^www\./, '')
      const firstParty =
        host === 'charliiai.com' || host.endsWith('.charliiai.com')

      if (host && host !== currentHost && !firstParty) referrerHost = host
    } catch {
      // An invalid referrer provides no reliable source.
    }
  }

  const source = campaignSource || referrerHost
  return {
    referrerHost,
    trafficSource: source || 'direct',
    trafficMedium: referrerHost ? 'referral' : 'none',
    attributionBasis: campaignSource
      ? 'utm'
      : referrerHost
        ? 'external_referrer'
        : 'unknown'
  }
}
