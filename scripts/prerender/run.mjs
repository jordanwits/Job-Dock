/**
 * Writes static HTML for every published content route.
 *
 * Runs after both builds: `vite build` produces dist/ and the index.html template, then
 * `vite build --ssr` produces dist-ssr/entry.js. This script renders each route and writes
 * dist/<path>/index.html.
 *
 * Vercel serves files from the filesystem before applying rewrites, so these win over the
 * `/(.*) -> /index.html` SPA fallback in vercel.json. Every other route keeps falling through
 * to the SPA exactly as before.
 *
 * The client still boots with createRoot, which discards this markup and re-renders. That is
 * deliberate: hydrateRoot would be faster, but any markup mismatch becomes a user-visible bug
 * on a live app, and the SEO benefit — crawlable text in the raw response — is identical.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT, SITE_URL, COLLECTIONS, collectEntries } from '../lib/content.mjs'

const distDir = join(ROOT, 'dist')
const ssrEntry = join(ROOT, 'dist-ssr', 'entry.js')

if (!existsSync(ssrEntry)) {
  console.error(`\n[prerender] missing ${ssrEntry} — run \`npm run build:ssr\` first\n`)
  process.exit(1)
}
if (!existsSync(join(distDir, 'index.html'))) {
  console.error(`\n[prerender] missing dist/index.html — run \`vite build\` first\n`)
  process.exit(1)
}

const template = readFileSync(join(distDir, 'index.html'), 'utf8')
const { renderArticle, renderHub } = await import(pathToFileURL(ssrEntry).href)
const entries = collectEntries().filter((e) => !e.meta.draft)

const escape = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Swaps the template's default head tags for this page's. */
function withHead(html, { title, description, canonical }) {
  const fullTitle = title.endsWith(' | CleanDock') ? title : `${title} | CleanDock`
  const swaps = [
    [/<title>[\s\S]*?<\/title>/, `<title>${escape(fullTitle)}</title>`],
    [
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/,
      `<meta name="description" content="${escape(description)}" />`,
    ],
    [/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escape(canonical)}" />`],
    [
      /<meta property="og:title" content="[\s\S]*?" \/>/,
      `<meta property="og:title" content="${escape(fullTitle)}" />`,
    ],
    [
      /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/>/,
      `<meta property="og:description" content="${escape(description)}" />`,
    ],
    [/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escape(canonical)}" />`],
    [
      /<meta name="twitter:title" content="[\s\S]*?" \/>/,
      `<meta name="twitter:title" content="${escape(fullTitle)}" />`,
    ],
    [
      /<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/>/,
      `<meta name="twitter:description" content="${escape(description)}" />`,
    ],
  ]

  let out = html
  const unmatched = []
  for (const [pattern, replacement] of swaps) {
    if (!pattern.test(out)) {
      unmatched.push(pattern.source.slice(0, 40))
      continue
    }
    out = out.replace(pattern, replacement)
  }
  // A silently unreplaced tag means every prerendered page ships the landing page's title or
  // canonical — the exact duplicate-content problem this work exists to prevent.
  if (unmatched.length) {
    throw new Error(`head tags not found in template: ${unmatched.join(', ')}`)
  }
  return out
}

function writePage(routePath, bodyHtml, head) {
  if (!bodyHtml || bodyHtml.length < 500) {
    throw new Error(`rendered body suspiciously short (${bodyHtml?.length ?? 0} chars)`)
  }
  const html = withHead(template, head).replace(
    '<div id="root"></div>',
    `<div id="root">${bodyHtml}</div>`
  )
  const outDir = join(distDir, routePath)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'index.html'), html, 'utf8')
}

const written = []
const failures = []

for (const [name, config] of Object.entries(COLLECTIONS)) {
  if (!config.hub) continue
  const path = `/${config.basePath}`
  try {
    writePage(path, renderHub(name, path), {
      title: config.title,
      description: config.description,
      canonical: `${SITE_URL}${path}`,
    })
    written.push(path)
  } catch (err) {
    failures.push(`${path}: ${err.message}`)
  }
}

for (const entry of entries) {
  try {
    const body = await renderArticle(entry.collection, entry.slug, entry.path)
    if (!body) throw new Error('registry returned no entry')
    writePage(entry.path, body, {
      title: entry.meta.title,
      description: entry.meta.description,
      canonical: `${SITE_URL}${entry.path}`,
    })
    written.push(entry.path)
  } catch (err) {
    failures.push(`${entry.path}: ${err.message}`)
  }
}

if (failures.length) {
  // Fail loudly. An un-prerendered page still works via the SPA, so this would otherwise
  // degrade unnoticed until someone checked Search Console weeks later.
  console.error('\n[prerender] failed:\n  ' + failures.join('\n  ') + '\n')
  process.exit(1)
}

console.log(`[prerender] wrote ${written.length} static pages:\n  ${written.join('\n  ')}`)
