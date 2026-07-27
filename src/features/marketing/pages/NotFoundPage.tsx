import { Link } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import MarketingSection from '../components/MarketingSection'
import { useSeo } from '@/lib/seo'

/**
 * Catch-all for unmatched public routes.
 *
 * Vercel rewrites every path to index.html, so unknown URLs return HTTP 200 rather than 404.
 * Previously they silently redirected to `/`, which reads to Google as a soft 404 (or as
 * duplicate content) and lets junk URLs into the index. Rendering a real "not found" page with
 * a noindex directive is the SPA-side fix; a true 404 status would need a Vercel function.
 */
const NotFoundPage = () => {
  useSeo({
    title: 'Page Not Found',
    description: 'That page does not exist.',
    path: '/404',
    noindex: true,
  })

  return (
    <MarketingLayout>
      <MarketingSection variant="gradient-dark" className="pt-32 pb-16 md:pt-40 md:pb-20">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Page not found</h1>
            <p className="text-lg text-white/70">
              That link is broken or the page has moved.
            </p>
          </div>
        </div>
      </MarketingSection>

      <MarketingSection variant="light">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-slate-600 mb-8">
              Try starting from the homepage, or log in to get back to your dashboard.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-blue px-6 text-base font-medium text-white hover:bg-primary-blue/90"
              >
                Go to homepage
              </Link>
              <Link
                to="/auth/login"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-primary-blue/20 px-6 text-base font-medium text-primary-blue hover:bg-primary-blue/5"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      </MarketingSection>
    </MarketingLayout>
  )
}

export default NotFoundPage
