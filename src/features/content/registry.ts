/**
 * Marketing content registry.
 *
 * Articles live in `src/content/<collection>/<slug>.mdx` and are discovered at build time —
 * adding a file is the only step needed to publish a page. Nothing here is hand-maintained.
 *
 * Frontmatter is loaded eagerly (Vite tree-shakes it down to just the `meta` export, so the
 * article bodies stay out of the main bundle) while the components themselves are loaded
 * lazily, one chunk per article.
 */
import type { ComponentType } from 'react'
import { manifest } from './manifest.generated'

/** YAML frontmatter every content file must declare. */
export interface ContentMeta {
  title: string
  /** Meta description. 150–160 characters. */
  description: string
  /** ISO date, used for sitemap lastmod and the "updated" line. */
  updated: string
  /** One-line summary shown on the collection hub page. */
  summary: string
  /** Search query this page targets. Editorial note only — never rendered. */
  targetQuery?: string
  /** Excluded from routes, hubs and the sitemap while true. */
  draft?: boolean
}

export type Collection = 'compare' | 'guides'

export const COLLECTIONS: Record<Collection, { title: string; description: string; blurb: string }> = {
  compare: {
    title: 'CleanDock compared',
    description:
      'Honest comparisons between CleanDock and the other software cleaning businesses consider, with current pricing and where each tool genuinely fits best.',
    blurb: 'How CleanDock stacks up against the other tools cleaning businesses look at.',
  },
  guides: {
    title: 'Guides for cleaning businesses',
    description:
      'Practical guides on pricing, scheduling, invoicing, and winning clients — written for cleaning-business owners, not general small-business advice.',
    blurb: 'Practical advice on pricing, scheduling, and getting paid.',
  },
}

export interface ContentEntry {
  collection: Collection
  slug: string
  path: string
  meta: ContentMeta
  load: () => Promise<{ default: ComponentType }>
}

/**
 * Article bodies, one lazily-loaded chunk each.
 *
 * Deliberately NOT paired with an eager `import: 'meta'` glob to read frontmatter: that would
 * put every MDX file in the static import graph, Rollup would stop code-splitting them, and all
 * fifteen articles would land in the main bundle. Frontmatter comes from the generated manifest
 * instead — see scripts/build-content.mjs.
 */
const componentModules = import.meta.glob<{ default: ComponentType }>('/src/content/*/*.mdx')

const entries: ContentEntry[] = manifest
  .flatMap((item) => {
    const loader = componentModules[`/src/content/${item.collection}/${item.slug}.mdx`]
    if (!loader || !(item.collection in COLLECTIONS)) {
      // Manifest out of step with the files on disk — regenerate with `npm run build:content`.
      if (import.meta.env.DEV) {
        console.warn(`[content] no module for ${item.path}; run npm run build:content`)
      }
      return []
    }
    return [
      {
        collection: item.collection as Collection,
        slug: item.slug,
        path: item.path,
        meta: item.meta,
        load: loader,
      },
    ]
  })
  // Drafts are routable in dev so they can be previewed, and stripped from production builds.
  // import.meta.env.DEV is statically replaced, so this whole branch is dead code in prod.
  .filter((entry) => import.meta.env.DEV || !entry.meta.draft)
  // Newest first on the hub pages.
  .sort((a, b) => b.meta.updated.localeCompare(a.meta.updated))

export function getEntries(collection?: Collection): ContentEntry[] {
  return collection ? entries.filter((e) => e.collection === collection) : entries
}

export function getEntry(collection: Collection, slug: string): ContentEntry | undefined {
  return entries.find((e) => e.collection === collection && e.slug === slug)
}
