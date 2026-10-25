import fs from 'node:fs/promises'

/** @type {[string, string, [string, string, string][]][]} */
const diagrams = [
  [
    'choose-your-tool',
    'Choose the job before the tool',
    [
      [
        'NOTES + DRAFT',
        'Notion AI',
        'Keep sources, outlines, and drafts together.'
      ],
      ['AI EMAIL EDITING', 'Mailchimp', 'Edit copy inside the email workflow.'],
      ['SEND + MANAGE', 'Kit', 'Deliver issues and manage subscribers.']
    ]
  ],
  [
    'weekly-workflow',
    'One issue, four deliberate steps',
    [
      [
        '01  COLLECT',
        'Keep the evidence',
        'Save source links and your observations.'
      ],
      [
        '02  DRAFT',
        'Answer one question',
        'Use your brief, voice sample, and prompt.'
      ],
      [
        '03  REVIEW → 04  SEND',
        'Approve before publishing',
        'Verify claims, then test the actual email.'
      ]
    ]
  ],
  [
    'pre-send-checks',
    'Review the email your readers will receive',
    [
      [
        'EVIDENCE + VOICE',
        'Can you support every claim?',
        'Open sources. Remove invented experience.'
      ],
      [
        'INBOX + LINKS',
        'Does the actual email work?',
        'Test on a phone. Click each destination.'
      ],
      [
        'AUDIENCE + PERMISSION',
        'Is this the intended list?',
        'Check segment, sender, and unsubscribe.'
      ]
    ]
  ]
]
const out = new URL('../public/images/newsletter/', import.meta.url)
await fs.mkdir(out, { recursive: true })
for (const [name, title, rows] of diagrams) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="550" viewBox="0 0 900 550"><rect width="900" height="550" rx="24" fill="#f0f7f5"/><text x="38" y="58" fill="#133f36" font-family="Arial,sans-serif" font-size="31" font-weight="bold">${title}</text>${rows.map(([tag, label, detail], i) => `<g transform="translate(32,${88 + i * 148})"><rect width="836" height="132" rx="14" fill="white"/><rect width="7" height="132" rx="3" fill="#28745e"/><text x="25" y="31" fill="#28745e" font-family="Arial,sans-serif" font-size="18" font-weight="bold">${tag.replaceAll('&', '&amp;')}</text><text x="25" y="67" fill="#163c35" font-family="Arial,sans-serif" font-size="30" font-weight="bold">${label}</text><text x="25" y="105" fill="#435f58" font-family="Arial,sans-serif" font-size="25">${detail}</text></g>`).join('')}</svg>`
  await fs.writeFile(new URL(name + '.svg', out), svg)
}
