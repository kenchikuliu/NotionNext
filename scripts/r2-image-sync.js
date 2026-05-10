#!/usr/bin/env node

const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawnSync } = require('child_process')

const SUPPORTED_RASTER_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.tif',
  '.tiff'
])

function fail(message, details) {
  if (details) {
    console.error(message, details)
  } else {
    console.error(message)
  }
  process.exit(1)
}

function printHelp() {
  console.log(`Usage:
  node scripts/r2-image-sync.js --bucket <bucket> --public-base-url <url> [options] <file ...>

Options:
  --prefix <path>         Prefix object keys with a folder-like path
  --preserve-relative-from <dir>
                          Preserve each file's path relative to this directory
  --quality <number>      WebP quality for raster sources, default 82
  --manifest <file>       Write a JSON manifest with source/target mappings
  --dry-run               Convert and print mappings without uploading

Environment variables:
  R2_IMAGE_BUCKET
  R2_PUBLIC_BASE_URL`)
}

function parseArgs(argv) {
  const args = {
    files: [],
    prefix: '',
    preserveRelativeFrom: '',
    quality: 82,
    bucket: process.env.R2_IMAGE_BUCKET || '',
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',
    manifest: '',
    dryRun: false
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--bucket') {
      args.bucket = argv[++i] || ''
    } else if (arg === '--public-base-url') {
      args.publicBaseUrl = (argv[++i] || '').replace(/\/+$/, '')
    } else if (arg === '--prefix') {
      args.prefix = (argv[++i] || '').replace(/^\/+|\/+$/g, '')
    } else if (arg === '--preserve-relative-from') {
      args.preserveRelativeFrom = argv[++i] || ''
    } else if (arg === '--quality') {
      args.quality = Number(argv[++i] || 82)
    } else if (arg === '--manifest') {
      args.manifest = argv[++i] || ''
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      args.files.push(arg)
    }
  }

  return args
}

function runOrFail(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...options
  })

  if (result.status !== 0) {
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\n${result.stderr || result.stdout}`
    )
  }

  return result.stdout.trim()
}

function ensureCommand(command) {
  const result = spawnSync('bash', ['-lc', `command -v ${command}`], {
    stdio: ['ignore', 'pipe', 'ignore'],
    encoding: 'utf8'
  })
  if (result.status !== 0 || !result.stdout.trim()) {
    fail(`Required command not found: ${command}`)
  }
}

function slugToAltText(input) {
  return path
    .basename(input, path.extname(input))
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.webp') return 'image/webp'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  return 'application/octet-stream'
}

function buildObjectKey(prefix, originalPath, outputExt, preserveRelativeFrom) {
  if (preserveRelativeFrom) {
    const relative = path.relative(path.resolve(preserveRelativeFrom), path.resolve(originalPath))
    if (relative.startsWith('..')) {
      fail(`File is outside preserve-relative-from base: ${originalPath}`)
    }
    const normalized = relative.split(path.sep).join('/')
    const withoutExt = normalized.replace(/\.[^.\/]+$/, '')
    const withExt = `${withoutExt}${outputExt}`
    return prefix ? `${prefix}/${withExt}` : withExt
  }

  const fileName = path.basename(originalPath, path.extname(originalPath))
  const digest = crypto
    .createHash('sha1')
    .update(path.resolve(originalPath))
    .digest('hex')
    .slice(0, 10)
  const cleanPrefix = prefix ? `${prefix}/` : ''
  return `${cleanPrefix}${fileName}-${digest}${outputExt}`
}

function convertToWebp(sourcePath, quality) {
  const ext = path.extname(sourcePath).toLowerCase()
  if (!SUPPORTED_RASTER_EXTENSIONS.has(ext)) {
    return {
      convertedPath: sourcePath,
      outputExt: ext || '',
      contentType: inferContentType(sourcePath),
      converted: false
    }
  }

  ensureCommand('cwebp')

  const tempOutput = path.join(
    os.tmpdir(),
    `${path.basename(sourcePath, ext)}-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}.webp`
  )

  runOrFail('cwebp', ['-quiet', '-q', String(quality), sourcePath, '-o', tempOutput])

  return {
    convertedPath: tempOutput,
    outputExt: '.webp',
    contentType: 'image/webp',
    converted: true
  }
}

function uploadToR2(bucket, objectKey, filePath, contentType) {
  const args = [
    'r2',
    'object',
    'put',
    `${bucket}/${objectKey}`,
    '--remote',
    '--file',
    filePath,
    '--content-type',
    contentType
  ]

  let lastError = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      runOrFail('wrangler', args)
      return
    } catch (error) {
      lastError = error
      if (attempt < 3) {
        console.warn(
          `Retrying upload (${attempt}/3 failed): ${bucket}/${objectKey}`
        )
      }
    }
  }

  throw lastError
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.bucket) {
    fail('Missing bucket. Pass --bucket or set R2_IMAGE_BUCKET.')
  }

  if (!args.publicBaseUrl) {
    fail('Missing public base URL. Pass --public-base-url or set R2_PUBLIC_BASE_URL.')
  }

  if (!args.files.length) {
    fail('No files provided.')
  }

  ensureCommand('wrangler')

  const manifest = []

  for (const input of args.files) {
    const sourcePath = path.resolve(input)
    if (!fs.existsSync(sourcePath)) {
      fail(`File not found: ${sourcePath}`)
    }

    const { convertedPath, outputExt, contentType, converted } = convertToWebp(
      sourcePath,
      args.quality
    )

    const objectKey = buildObjectKey(
      args.prefix,
      sourcePath,
      outputExt,
      args.preserveRelativeFrom
    )
    const publicUrl = `${args.publicBaseUrl}/${objectKey}`

    if (!args.dryRun) {
      uploadToR2(args.bucket, objectKey, convertedPath, contentType)
    }

    manifest.push({
      source: sourcePath,
      uploaded: !args.dryRun,
      converted,
      objectKey,
      publicUrl,
      altSuggestion: slugToAltText(sourcePath)
    })

    if (converted && convertedPath !== sourcePath && fs.existsSync(convertedPath)) {
      fs.unlinkSync(convertedPath)
    }
  }

  if (args.manifest) {
    fs.writeFileSync(path.resolve(args.manifest), JSON.stringify(manifest, null, 2))
  }

  console.log(JSON.stringify(manifest, null, 2))
}

main()
