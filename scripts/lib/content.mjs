/**
 * Shared content-collection logic for the build scripts.
 *
 * Single source of truth for build-content.mjs (manifest + sitemap) and prerender/run.mjs.
 * Previously the prerender step re-parsed the generated TypeScript to recover the entry list,
 * which broke the moment the file's formatting changed.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SITE_URL = 'https://www.thecleandock.com'

/**
 * Must stay in sync with COLLECTIONS in src/features/content/registry.ts — these scripts are
 * plain Node and can't import the TypeScript module. `basePath: ''` puts a collection at the
 * site root; `hub` means /<basePath> renders a listing page.
 */
export const COLLECTIONS = {
  compare: {
    basePath: 'compare',
    hub: true,
    title: 'CleanDock compared',
    description:
      'Honest comparisons between CleanDock and the other software cleaning businesses consider, with current pricing and where each tool genuinely fits best.',
  },
  guides: {
    basePath: 'guides',
    hub: true,
    title: 'Guides for cleaning businesses',
    description:
      'Practical guides on pricing, scheduling, invoicing, and winning clients, written for cleaning-business owners rather than general small-business advice.',
  },
  solutions: { basePath: '', hub: false },
}

/** Routes not backed by MDX. changefreq/priority are hints only; Google ignores them. */
export const STATIC_ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/auth/signup', changefreq: 'monthly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/compare', changefreq: 'weekly', priority: '0.7' },
  { path: '/guides', changefreq: 'weekly', priority: '0.7' },
  { path: '/auth/login', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/email-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/sms-consent', changefreq: 'yearly', priority: '0.3' },
]

const REQUIRED_FIELDS = ['title', 'description', 'summary', 'updated']

export function entryPath(collection, slug) {
  const { basePath } = COLLECTIONS[collection]
  return basePath ? `/${basePath}/${slug}` : `/${slug}`
}

/**
 * Reads every content file. Throws on invalid frontmatter rather than returning partial data —
 * a page missing a description is invisible in the UI and only surfaces in Search Console weeks
 * later, so it should stop the build.
 */
export function collectEntries() {
  const contentRoot = join(ROOT, 'src', 'content')
  const entries = []
  const problems = []

  for (const collection of Object.keys(COLLECTIONS)) {
    const dir = join(contentRoot, collection)
    if (!existsSync(dir)) continue

    for (const file of readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
      const slug = file.replace(/\.mdx$/, '')
      const { data } = matter(readFileSync(join(dir, file), 'utf8'))

      const missing = REQUIRED_FIELDS.filter((f) => !data[f])
      if (missing.length) {
        problems.push(`${collection}/${file}: missing frontmatter [${missing.join(', ')}]`)
        continue
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.updated))) {
        problems.push(`${collection}/${file}: "updated" must be YYYY-MM-DD, got "${data.updated}"`)
        continue
      }

      entries.push({
        collection,
        slug,
        path: entryPath(collection, slug),
        meta: {
          title: data.title,
          description: data.description,
          summary: data.summary,
          updated: String(data.updated),
          ...(data.navLabel ? { navLabel: data.navLabel } : {}),
          ...(data.targetQuery ? { targetQuery: data.targetQuery } : {}),
          ...(data.draft ? { draft: true } : {}),
        },
      })
    }
  }

  if (problems.length) {
    const err = new Error('invalid frontmatter:\n  ' + problems.join('\n  '))
    err.problems = problems
    throw err
  }

  return entries.sort((a, b) => b.meta.updated.localeCompare(a.meta.updated))
}
