import { Suspense, lazy, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import MarketingLayout from '@/features/marketing/components/MarketingLayout'
import { NotFoundPage } from '@/features/marketing'
import { useSeo } from '@/lib/seo'
import { getEntry, COLLECTIONS, type Collection } from './registry'

interface ContentPageProps {
  collection: Collection
}

/**
 * MDX emits plain <a> tags, which would full-page-reload on internal links and throw away the
 * SPA. Route those through react-router instead; anything off-site opens in a new tab.
 */
const mdxComponents = {
  a: ({ href = '', children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const isInternal = href.startsWith('/') && !href.startsWith('//')
    if (isInternal) {
      return (
        <Link to={href} {...rest}>
          {children}
        </Link>
      )
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    )
  },
}

/**
 * Renders one MDX article. The body is code-split per article, so visiting a guide never
 * downloads the other fourteen.
 */
const ContentPage = ({ collection }: ContentPageProps) => {
  const { slug = '' } = useParams()
  const entry = getEntry(collection, slug)

  // Hooks must run unconditionally, so resolve the lazy component before the early return.
  const Article = useMemo(
    () => (entry ? lazy(entry.load) : null),
    [entry]
  )

  if (!entry || !Article) return <NotFoundPage />

  return <ArticleShell collection={collection} entry={entry} Article={Article} />
}

const ArticleShell = ({
  collection,
  entry,
  Article,
}: {
  collection: Collection
  entry: NonNullable<ReturnType<typeof getEntry>>
  Article: React.ComponentType<{ components?: Record<string, unknown> }>
}) => {
  useSeo({
    title: entry.meta.title,
    description: entry.meta.description,
    path: entry.path,
  })

  const hub = COLLECTIONS[collection]

  return (
    <MarketingLayout>
      <article className="px-4 pb-20 pt-32 md:px-6 md:pt-40">
        <div className="mx-auto max-w-3xl">
          <nav aria-label="Breadcrumb" className="mb-8 text-sm">
            <Link to={`/${collection}`} className="text-teal-700 hover:text-teal-800">
              {hub.title}
            </Link>
          </nav>

          <h1 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
            {entry.meta.title}
          </h1>
          <p className="mt-4 text-lg text-slate-600">{entry.meta.summary}</p>
          <p className="mt-6 border-t border-slate-200 pt-4 text-sm text-slate-500">
            Updated{' '}
            <time dateTime={entry.meta.updated}>
              {new Date(`${entry.meta.updated}T00:00:00`).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          </p>

          <div className="prose prose-slate mt-10 max-w-none prose-headings:text-slate-900 prose-a:text-teal-700 prose-a:no-underline hover:prose-a:underline prose-table:text-sm">
            <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
              <Article components={mdxComponents} />
            </Suspense>
          </div>
        </div>
      </article>
    </MarketingLayout>
  )
}

export default ContentPage
