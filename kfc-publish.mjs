#!/usr/bin/env node
// kfc-publish.mjs — publish a new version of this tool to a KFC Hub.
// Zero-dependency (Node 18+ global fetch/FormData/Blob). Never does any git operation.
// This is the canonical copy; each kfc-ready project carries a copy of it in its root.
//
// Artifacts are AUTO-DERIVED from the manifest: for each component platform the artifact
// filename is `<artifact-template with {version} filled>`, looked up under --dist (default
// ./dist-kfc). So the common case is just:
//     node kfc-publish.mjs --version 1.2.0
// Web tools (empty platforms) publish the manifest with no files. Missing artifact files
// are skipped with a warning (e.g. a mac zip not built on Windows). When one platform key
// is declared by multiple components, the first component wins (others are skipped).
//
// Overrides / options:
//   --version <v>        (required)
//   --hub <url>          default env KFC_HUB or http://localhost:8787
//   --token <jwt>        default env KFC_TOKEN
//   --manifest <path>    default ./kfc.manifest.json
//   --dist <dir>         default ./dist-kfc  (where built artifacts live)
//   --artifact p=path    explicit artifact(s); if any given, AUTO-DERIVE is disabled
//   --dry-run            print what would be sent; do not POST
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

function parseArgs(argv) {
  const out = { artifacts: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    function val() {
      return argv[++i]
    }
    if (a === '--hub') out.hub = val()
    else if (a === '--token') out.token = val()
    else if (a === '--version') out.version = val()
    else if (a === '--manifest') out.manifest = val()
    else if (a === '--dist') out.dist = val()
    else if (a === '--artifact') out.artifacts.push(val())
    else if (a === '--dry-run') out.dryRun = true
    else {
      console.error(`unknown arg: ${a}`)
      process.exit(2)
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))
const hub = (args.hub ?? process.env.KFC_HUB ?? 'http://localhost:8787').replace(/\/$/, '')
const token = args.token ?? process.env.KFC_TOKEN ?? ''
const manifestPath = args.manifest ?? './kfc.manifest.json'
const distDir = args.dist ?? './dist-kfc'
if (!args.version) {
  console.error('error: --version is required')
  process.exit(2)
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const id = manifest.id
if (!id) {
  console.error('error: manifest has no id')
  process.exit(2)
}

// Resolve the platform -> file list, either from explicit --artifact or derived.
const resolved = [] // { platform, filePath, filename }
if (args.artifacts.length > 0) {
  for (const spec of args.artifacts) {
    const eq = spec.indexOf('=')
    if (eq < 0) {
      console.error(`error: bad --artifact "${spec}" (want platform=path)`)
      process.exit(2)
    }
    const platform = spec.slice(0, eq)
    const filePath = spec.slice(eq + 1)
    resolved.push({ platform, filePath, filename: basename(filePath) })
  }
} else {
  const seen = new Set()
  for (const comp of manifest.components ?? []) {
    for (const [platform, info] of Object.entries(comp.platforms ?? {})) {
      if (seen.has(platform)) continue // first component wins per platform key
      const filename = String(info.artifact ?? '').replaceAll('{version}', args.version)
      if (!filename) continue
      const filePath = join(distDir, filename)
      if (existsSync(filePath)) {
        resolved.push({ platform, filePath, filename })
        seen.add(platform)
      } else {
        console.warn(`skip ${platform}: ${filePath} not found`)
      }
    }
  }
}

const isWeb = (manifest.components ?? []).every((c) => c.kind === 'web')
if (resolved.length === 0 && !isWeb) {
  console.error(
    `error: no artifacts found under ${distDir} for ${id}@${args.version} — run the pack step first (e.g. npm run kfc:pack -- -Version ${args.version})`
  )
  process.exit(2)
}

console.log(`publish ${id}@${args.version} -> ${hub}`)
for (const r of resolved) console.log(`  ${r.platform}  <-  ${r.filePath}`)
if (isWeb) console.log('  (web: manifest only, no artifacts)')

if (args.dryRun) {
  console.log('dry-run: not sending.')
  process.exit(0)
}

const form = new FormData()
form.set('manifest', JSON.stringify(manifest))
form.set('version', args.version)
for (const r of resolved) {
  const bytes = await readFile(r.filePath)
  form.set(r.platform, new Blob([bytes]), r.filename)
}

const url = `${hub}/api/tools/${id}/versions`
const res = await fetch(url, {
  method: 'POST',
  headers: token ? { cookie: `kfc-token=${token}` } : {},
  body: form,
})
const text = await res.text()
console.log(`POST ${url} -> ${res.status}`)
console.log(text)
process.exit(res.ok ? 0 : 1)
