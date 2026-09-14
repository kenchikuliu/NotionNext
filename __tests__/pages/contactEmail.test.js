import fs from 'fs'
import path from 'path'

describe('public contact email', () => {
  test('keeps the About page on the charliiai.com address', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'pages/about.js'),
      'utf8'
    )

    expect(source).toContain('hello@charliiai.com')
    expect(source).not.toContain('charliiai2024@gmail.com')
  })
})
