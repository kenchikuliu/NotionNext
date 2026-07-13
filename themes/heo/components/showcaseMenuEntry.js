const SHOWCASE_URL = 'https://showcase.charliiai.com/?lang=en&ref=main-site'

export const showcaseMenuEntry = {
  id: 'charliiai-ai-services',
  name: 'AI Services',
  href: SHOWCASE_URL,
  target: '_self',
  show: true,
  highlight: true
}

export function withShowcaseMenuEntry(links = []) {
  const safeLinks = Array.isArray(links) ? links : []
  const alreadyExists = safeLinks.some(link => {
    return (
      typeof link?.href === 'string' &&
      link.href.includes('showcase.charliiai.com')
    )
  })

  if (alreadyExists) {
    return safeLinks
  }

  const [firstLink, ...restLinks] = safeLinks
  if (firstLink?.href === '/') {
    return [firstLink, showcaseMenuEntry, ...restLinks]
  }

  return [showcaseMenuEntry, ...safeLinks]
}
