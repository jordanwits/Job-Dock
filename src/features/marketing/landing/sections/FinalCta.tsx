import Reveal from '../components/Reveal'
import { LandingButton } from '../components/landingUi'
import { landingContent } from '../content/landingContent'
import { scrollToId } from '../utils'

const { finalCta } = landingContent

const FinalCta = () => {
  return (
    <section className="relative isolate overflow-hidden bg-teal-700 py-24 md:py-32">
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
