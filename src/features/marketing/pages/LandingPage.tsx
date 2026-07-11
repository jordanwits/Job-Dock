import { lazy, Suspense, useEffect } from 'react'
import MarketingLayout from '../components/MarketingLayout'
import Hero from '../landing/sections/Hero'
import Stage from '../landing/sections/Stage'
import Testimonials from '../landing/sections/Testimonials'
import PricingTeaser from '../landing/sections/PricingTeaser'
import FinalCta from '../landing/sections/FinalCta'
import { landingContent } from '../landing/content/landingContent'
import { useMediaQuery } from '../landing/hooks/useMediaQuery'
import { useReducedMotion } from '../landing/hooks/useReducedMotion'
import { scrollToId } from '../landing/utils'

// Code-split the WebGL phone so three.js stays out of the main bundle.
const PhoneScene = lazy(() => import('../landing/phone3d/PhoneScene'))

/**
 * Customer-facing sales landing page for CleanDock (cleaning businesses).
 * A single 3D phone travels down the page, spinning a full turn between feature stages and
 * swapping its screen to match each one. On mobile / reduced-motion, each stage shows a static
 * phone instead and the WebGL layer is never loaded.
 */
const LandingPage = () => {
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const timer = setTimeout(() => scrollToId(hash), 120)
    return () => clearTimeout(timer)
  }, [])

  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const reduced = useReducedMotion()
  const use3D = isDesktop && !reduced
  const showInlinePhone = !use3D

  return (
    <MarketingLayout>
      {/* The phone travels through this region (hero + feature stages). */}
      <div
        data-phone-region
        className="relative bg-gradient-to-b from-white via-sky-50/40 to-white"
      >
        <Hero showInlinePhone={showInlinePhone} />
        {landingContent.stages.map((s, i) => (
          <Stage
            key={s.id}
            index={i + 1}
            stage={s}
            showInlinePhone={showInlinePhone}
            id={i === 0 ? 'features' : undefined}
          />
        ))}
      </div>

      {use3D && (
        <Suspense fallback={null}>
          <PhoneScene />
        </Suspense>
      )}

      <Testimonials />
      <PricingTeaser />
      <FinalCta />
    </MarketingLayout>
  )
}

export default LandingPage
