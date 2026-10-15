import { resolveTrafficSource } from '@/lib/analytics/traffic-source'

describe('first-touch traffic source', () => {
  it.each([
    'https://charliiai.com/article',
    'https://www.charliiai.com/article',
    'https://learn.charliiai.com/lesson',
    'https://imgly.charliiai.com/image'
  ])('treats %s as first-party navigation', referrer => {
    expect(
      resolveTrafficSource({
        referrer,
        currentHostname: 'www.charliiai.com'
      })
    ).toEqual({
      referrerHost: undefined,
      trafficSource: 'direct',
      trafficMedium: 'none',
      attributionBasis: 'unknown'
    })
  })

  it('keeps a real external referrer distinct from lookalike hosts', () => {
    expect(
      resolveTrafficSource({
        referrer: 'https://charliiai.com.example.net/article',
        currentHostname: 'charliiai.com'
      })
    ).toEqual({
      referrerHost: 'charliiai.com.example.net',
      trafficSource: 'charliiai.com.example.net',
      trafficMedium: 'referral',
      attributionBasis: 'external_referrer'
    })
  })

  it('uses campaign source ahead of an external referrer', () => {
    expect(
      resolveTrafficSource({
        referrer: 'https://google.com/search',
        currentHostname: 'charliiai.com',
        campaignSource: 'newsletter'
      })
    ).toEqual({
      referrerHost: 'google.com',
      trafficSource: 'newsletter',
      trafficMedium: 'referral',
      attributionBasis: 'utm'
    })
  })

  it('does not label an invalid referrer as referral', () => {
    expect(
      resolveTrafficSource({
        referrer: 'not a URL',
        currentHostname: 'charliiai.com'
      }).trafficMedium
    ).toBe('none')
  })
})
