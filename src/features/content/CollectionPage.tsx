import { Link } from 'react-router-dom'
import MarketingLayout from '@/features/marketing/components/MarketingLayout'
import { useSeo } from '@/lib/seo'
import { getEntries, COLLECTIONS, type Collection } from './registry'

interface CollectionPageProps {
  collection: Collection
}

/**
 * Hub page listing everything in one collection. Exists as much for crawlers as for readers:
 * it gives every article an internal link from a real page rather than the sitemap alone.
 */
const CollectionPage = ({ collection }: CollectionPageProps) => {
  const hub = COLLECTIONS[collection]
  const entries = getEntries(collection)

  useSeo({
    title: hub.title,
    description: hub.description,
    path: `/${collection}`,
  })

  return (
    <MarketingLayout>
      <div className="px-4 pb-20 pt-32 md:px-6 md:pt-40">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-balance text-3xl font-bold text-slate-900 md:text-4xl">
            {hub.title}
          </h1>
          <p className="mt-4 text-lg text-slate-600">{hub.blurb}</p>

          {entries.length === 0 ? (
            <p className="mt-12 text-slate-500">Nothing published here yet.</p>
          ) : (
            <ul className="mt-12 divide-y divide-slate-200 border-t border-slate-200">
              {entries.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    to={entry.path}
                    className="group block py-6 transition-colors hover:bg-slate-50/80"
                  >
                    <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900 group-hover:text-teal-700">
                      {entry.meta.title}
                      {entry.meta.draft && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-800">
                          Draft
                        </span>
                      )}
                    </h2>
                    <p className="mt-2 text-slate-600">{entry.meta.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </MarketingLayout>
  )
}

export default CollectionPage
