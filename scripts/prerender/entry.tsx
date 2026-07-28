/**
 * SSR entry for the prerender build.
 *
 * Renders content and hub pages to HTML strings at build time so crawlers get the article text
 * from the raw response instead of waiting on Google's render pass. Built separately from the
 * client bundle (`vite build --ssr`), so nothing here ships to browsers.
 *
 * Deliberately narrow: it imports the content feature and the marketing layout, and nothing
 * else. It does not import App, the auth stores, the API clients or the landing page — anything
 * touching `window` at module scope would crash the Node render, and a smaller graph is a
 * smaller audit.
 */
import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { ArticleShell } from '@/features/content/ContentPage'
import CollectionPage from '@/features/content/CollectionPage'
import { getEntry, type Collection } from '@/features/content/registry'

const articleModules = import.meta.glob<{ default: ComponentType<Record<string, unknown>> }>(
  '/src/content/*/*.mdx'
)

/** Renders one article route. Returns null if the slug isn't in the registry. */
export async function renderArticle(
  collection: Collection,
  slug: string,
  location: string
): Promise<string | null> {
  const entry = getEntry(collection, slug)
  if (!entry) return null

  const loader = articleModules[`/src/content/${collection}/${slug}.mdx`]
  if (!loader) return null

  // Awaited here, not passed through React.lazy — see ArticleShell's doc comment.
  const { default: Article } = await loader()

  return renderToString(
    <StaticRouter location={location}>
      <ArticleShell collection={collection} entry={entry} Article={Article} />
    </StaticRouter>
  )
}

/** Renders a collection hub page (/compare, /guides). */
export function renderHub(collection: Collection, location: string): string {
  return renderToString(
    <StaticRouter location={location}>
      <CollectionPage collection={collection} />
    </StaticRouter>
  )
}
