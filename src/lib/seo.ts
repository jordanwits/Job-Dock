/**
 * Per-route SEO metadata.
 *
 * index.html ships one static <head>, so without this every route would serve the landing
 * page's title, description and canonical URL. useSeo() rewrites those tags on mount and
 * restores the index.html defaults on unmount.
 *
 * Googlebot renders JS, so tags written here are picked up — but only on the render pass,
 * which is slower than parsing static HTML. Keep index.html's defaults accurate too.
 */
import { useEffect } from 'react'

/** Canonical host. All redirects (apex, http, non-www) land here. */
export const SITE_URL = 'https://www.thecleandock.com'

const BRAND_SUFFIX = ' | CleanDock'

interface SeoOptions {
  /** Page title. BRAND_SUFFIX is appended unless it's already there. */
  title: string
  /** meta[name=description]. Aim for 150–160 characters. */
  description: string
  /** Route path used to build the canonical URL, e.g. '/privacy'. */
  path: string
  /** Keep this page out of the search index (gated, thin, or transactional pages). */
  noindex?: boolean
}

function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

function readMeta(attr: 'name' | 'property', key: string): string {
  return document.head.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? ''
}

/**
 * Snapshot of index.html's tags, captured at import time (before any route mounts) so
 * unmount can restore them rather than leaving another page's metadata behind.
 */
const DEFAULTS = {
  title: document.title,
  description: readMeta('name', 'description'),
  ogTitle: readMeta('property', 'og:title'),
  ogDescription: readMeta('property', 'og:description'),
  twitterTitle: readMeta('name', 'twitter:title'),
  twitterDescription: readMeta('name', 'twitter:description'),
}

export function useSeo({ title, description, path, noindex = false }: SeoOptions): void {
  useEffect(() => {
    const fullTitle = title.endsWith(BRAND_SUFFIX) ? title : `${title}${BRAND_SUFFIX}`
    // Trailing slash only on the root; '/privacy/' and '/privacy' must not both be canonical.
    const canonical = path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path.replace(/\/$/, '')}`

    document.title = fullTitle
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow')
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('property', 'og:url', canonical)
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', description)
    setCanonical(canonical)

    return () => {
      document.title = DEFAULTS.title
      setMeta('name', 'description', DEFAULTS.description)
      setMeta('name', 'robots', 'index, follow')
      setMeta('property', 'og:title', DEFAULTS.ogTitle)
      setMeta('property', 'og:description', DEFAULTS.ogDescription)
      setMeta('property', 'og:url', `${SITE_URL}/`)
      setMeta('name', 'twitter:title', DEFAULTS.twitterTitle)
      setMeta('name', 'twitter:description', DEFAULTS.twitterDescription)
      setCanonical(`${SITE_URL}/`)
    }
  }, [title, description, path, noindex])
}
