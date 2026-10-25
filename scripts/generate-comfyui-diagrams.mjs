import fs from 'node:fs/promises'

/** @type {[string, string, [string, string, string][]][]} */
const diagrams = [
  [
    'installation-choice',
    'Choose one installation route',
    [
      [
        'DESKTOP',
        'Managed local installation',
        'Follow the official guide for your operating system.'
      ],
      [
        'WINDOWS PORTABLE',
        'Extract the matching GPU package',
        'Use its bundled Python and included launcher.'
      ],
      [
        'MANUAL',
        'Control your own environment',
        'Follow hardware-specific dependency instructions.'
      ]
    ]
  ],
  [
    'first-workflow',
    'Read the beginner workflow in three stages',
    [
      [
        '01  LOAD + ENCODE',
        'Checkpoint and two prompts',
        'Load model, CLIP and VAE; encode the prompts.'
      ],
      [
        '02  SAMPLE',
        'KSampler + empty latent image',
        'Use model, conditioning, seed and image dimensions.'
      ],
      [
        '03  DECODE + SAVE',
        'VAE Decode → Save Image',
        'Turn the sampled latent into a saved pixel image.'
      ]
    ]
  ],
  [
    'troubleshooting-order',
    'Check the first failure in order',
    [
      [
        'MODEL',
        'Does the requested file exist?',
        'Check filename, folder and completed download.'
      ],
      [
        'NODES + INPUTS',
        'Does the graph have what it needs?',
        'Check node packages and matching input types.'
      ],
      [
        'MEMORY',
        'Does the workload fit?',
        'Try the example size and a batch of one image.'
      ]
    ]
  ]
]
const out = new URL('../public/images/comfyui/', import.meta.url)
await fs.mkdir(out, { recursive: true })
for (const [name, title, rows] of diagrams) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="550" viewBox="0 0 900 550"><rect width="900" height="550" rx="24" fill="#f0f7f5"/><text x="38" y="58" fill="#133f36" font-family="Arial,sans-serif" font-size="31" font-weight="bold">${title}</text>${rows.map(([tag, label, detail], i) => `<g transform="translate(32,${88 + i * 148})"><rect width="836" height="132" rx="14" fill="white"/><rect width="7" height="132" rx="3" fill="#28745e"/><text x="25" y="31" fill="#28745e" font-family="Arial,sans-serif" font-size="18" font-weight="bold">${tag.replaceAll('&', '&amp;')}</text><text x="25" y="67" fill="#163c35" font-family="Arial,sans-serif" font-size="30" font-weight="bold">${label}</text><text x="25" y="105" fill="#435f58" font-family="Arial,sans-serif" font-size="24">${detail}</text></g>`).join('')}</svg>`
  await fs.writeFile(new URL(name + '.svg', out), svg)
}
