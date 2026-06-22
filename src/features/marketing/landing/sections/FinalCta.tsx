import ParallaxLayer from '../components/ParallaxLayer'
import Reveal from '../components/Reveal'
import { LandingButton } from '../components/landingUi'
import { landingContent } from '../content/landingContent'
import { scrollToId } from '../utils'

const { finalCta } = landingContent

const FinalCta = () => {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-teal-700 via-teal-700 to-sky-700 py-24 md:py-32">
      {/* Floating light orbs */}
      <ParallaxLayer speed={0.16} className="pointer-events-none absolute -left-10 top-6 h-56 w-56 rounded-full bg-white/15 blur-3xl" aria-hidden />
      <ParallaxLayer speed={-0.12} className="pointer-events-none absolute -right-12 bottom-0 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" aria-hidden />
      <div className="jd-dot-grid absolute inset-0 opacity-20" aria-hidden />

      {/* Floating sparkles */}
      <ParallaxLayer speed={0.3} className="pointer-events-none absolute left-[12%] top-[22%]" aria-hidden>
        <span className="jd-float block h-3 w-3 rounded-full bg-white/70" />
      </ParallaxLayer>
      <ParallaxLayer speed={0.45} className="pointer-events-none absolute right-[18%] top-[30%]" aria-hidden>
        <span className="jd-float-slow block h-2 w-2 rounded-full bg-white/80" />
      </ParallaxLayer>
      <ParallaxLayer speed={0.25} className="pointer-events-none absolute left-[24%] bottom-[20%]" aria-hidden>
        <span className="jd-float block h-2.5 w-2.5 rounded-full bg-white/60" />
      </ParallaxLayer>

      <div className="relative mx-auto max-w-3xl px-5 text-center md:px-8">
        <Reveal from="up">
          <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight text-white [text-wrap:balance] sm:text-5xl">
            {finalCta.title}
          </h2>
        </Reveal>
        <Reveal from="up" delay={100}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/90">{finalCta.subtitle}</p>
        </Reveal>
        <Reveal from="up" delay={180}>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <LandingButton to="/auth/signup" variant="white" size="lg" withArrow className="w-full sm:w-auto">
              {finalCta.primaryCta}
            </LandingButton>
            <LandingButton
              onClick={() => scrollToId('how-it-works')}
              size="lg"
              className="w-full bg-white/15 text-white ring-1 ring-white/40 backdrop-blur hover:bg-white/25 sm:w-auto"
            >
              {finalCta.secondaryCta}
            </LandingButton>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default FinalCta
