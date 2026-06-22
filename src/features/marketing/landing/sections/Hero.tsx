import PhoneFrame from '../components/PhoneFrame'
import HomeScreen from '../components/screens/HomeScreen'
import Reveal from '../components/Reveal'
import { LandingButton } from '../components/landingUi'
import { landingContent } from '../content/landingContent'
import { scrollToId } from '../utils'

const { hero } = landingContent

const Hero = ({ showInlinePhone }: { showInlinePhone: boolean }) => {
  return (
    <section className="relative isolate flex min-h-[100svh] items-center overflow-x-clip pt-28 pb-16 md:pt-32">
      {/* Hero background photo */}
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/marketing/landing/kitchen-bright.jpg')" }}
        aria-hidden
      />
      {/* Dark overlay 40% */}
      <div className="absolute inset-0 -z-10 bg-black/40" aria-hidden />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 md:px-8 lg:grid-cols-2 lg:gap-16">
        {/* Copy */}
        <div className="order-1 text-center lg:text-left">
          <Reveal from="up" delay={80}>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white [text-wrap:balance] sm:text-5xl lg:text-6xl">
              {hero.titleTop}{' '}
              <span className="relative whitespace-nowrap text-teal-300">
                {hero.titleHighlight}
                <svg
                  className="absolute -bottom-2 left-0 h-3 w-full text-teal-400"
                  viewBox="0 0 200 12"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <path d="M2 8c40-6 120-7 196-2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </span>{' '}
              {hero.titleEnd}
            </h1>
          </Reveal>
          <Reveal from="up" delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/80 [text-wrap:pretty] lg:mx-0">
              {hero.subtitle}
            </p>
          </Reveal>
          <Reveal from="up" delay={240}>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
              <LandingButton to="/auth/signup" variant="primary" size="lg" withArrow className="w-full sm:w-auto">
                {hero.primaryCta}
              </LandingButton>
              <LandingButton onClick={() => scrollToId('features')} variant="ghost" size="lg" className="w-full sm:w-auto">
                {hero.secondaryCta}
              </LandingButton>
            </div>
          </Reveal>
          <Reveal from="up" delay={320}>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
              {hero.chips.slice(0, 4).map((chip) => (
                <li key={chip} className="flex items-center gap-1.5 text-sm font-semibold text-white/70">
                  <svg className="h-3.5 w-3.5 text-teal-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {chip}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Phone slot (right) */}
        <div className="relative order-2 flex items-center justify-center">
          <span data-phone-stage={0} className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" aria-hidden />
          {showInlinePhone ? (
            <PhoneFrame>
              <HomeScreen />
            </PhoneFrame>
          ) : (
            <div className="hidden h-[clamp(420px,66vh,620px)] w-full lg:block" aria-hidden />
          )}
        </div>
      </div>
    </section>
  )
}

export default Hero
