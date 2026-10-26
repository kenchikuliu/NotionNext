import fs from 'node:fs/promises'

/** @type {[string, string, [string, string, string][]][]} */
const diagrams = [
  [
    'tool-choice',
    'Choose the job before the tool',
    [
      [
        'SOURCE CONTEXT',
        'Notion AI',
        'Keep approved notes and the draft together.'
      ],
      [
        'BRAND DRAFTING',
        'Jasper',
        'Coordinate team context and repeatable workflows.'
      ],
      ['EDITING', 'Grammarly', 'Review language inside supported writing apps.']
    ]
  ],
  [
    'draft-workflow',
    'Build a draft from checked material',
    [
      [
        '01  BRIEF',
        'One reader question + sources',
        'Name the outcome and collect approved evidence.'
      ],
      [
        '02  OUTLINE + DRAFT',
        'Review the structure first',
        'Draft a section; flag claims that need checking.'
      ],
      [
        '03  HUMAN REVIEW',
        'Verify and add your example',
        'Keep the meaning; remove unsupported promises.'
      ]
    ]
  ],
  [
    'publish-review',
    'Check the page before publishing',
    [
      [
        'EVIDENCE',
        'Facts, sources, and examples',
        'Review claims, caveats, dates, and attribution.'
      ],
      [
        'LIVE PAGE',
        'Readable on phone and desktop',
        'Check headings, tables, images, links, and metadata.'
      ],
      [
        'NEXT ACTION',
        'Offer a relevant next step',
        'Use a useful guide, reusable brief, or newsletter.'
      ]
    ]
  ]
]
const out = new URL('../public/images/blog-writing/', import.meta.url)
await fs.mkdir(out, { recursive: true })
for (const [name, title, rows] of diagrams) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="550" viewBox="0 0 900 550"><rect width="900" height="550" rx="24" fill="#f0f7f5"/><text x="38" y="58" fill="#133f36" font-family="Arial,sans-serif" font-size="31" font-weight="bold">${title}</text>${rows.map(([tag, label, detail], i) => `<g transform="translate(32,${88 + i * 148})"><rect width="836" height="132" rx="14" fill="white"/><rect width="7" height="132" rx="3" fill="#28745e"/><text x="25" y="31" fill="#28745e" font-family="Arial,sans-serif" font-size="18" font-weight="bold">${tag.replaceAll('&', '&amp;')}</text><text x="25" y="67" fill="#163c35" font-family="Arial,sans-serif" font-size="30" font-weight="bold">${label}</text><text x="25" y="105" fill="#435f58" font-family="Arial,sans-serif" font-size="24">${detail}</text></g>`).join('')}</svg>`
  await fs.writeFile(new URL(name + '.svg', out), svg)
}
