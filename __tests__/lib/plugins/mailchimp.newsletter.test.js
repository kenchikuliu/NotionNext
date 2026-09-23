import { subscribeToNewsletter } from '@/lib/plugins/mailchimp'

describe('newsletter submission privacy', () => {
  it('does not create a legacy visitor ID or send first-touch details for the homepage newsletter', async () => {
    fetch.mockResolvedValue({
      json: () => Promise.resolve({ status: 'success' })
    })

    await subscribeToNewsletter({
      email: 'reader@example.com',
      source: 'heo_home_cta',
      newsletter_consent: true
    })

    const requestBody = JSON.parse(fetch.mock.calls[0][1].body)
    expect(requestBody).toEqual({
      email: 'reader@example.com',
      source: 'heo_home_cta',
      newsletter_consent: true
    })
  })
})
