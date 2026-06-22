import Reveal from '../components/Reveal'
import { LandingButton } from '../components/landingUi'
import { landingContent } from '../content/landingContent'
import { scrollToId } from '../utils'

const { pricing } = landingContent

const PricingTeaser = () => {
  return (
    <section id="pricing" className="relative scroll-mt-24 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-4xl px-5 md:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal from="up">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 [text-wrap:balance] sm:text-4xl md:text-[2.6rem]">
              {pricing.title}
            </h2>
          </Reveal>
          <Reveal from="up" delay={120}>
            <p className="mt-5 text-lg leading-relaxed text-slate-600 [text-wrap:pretty]">{pricing.subtitle}</p>
          </Reveal>
        </div>

        <Reveal from="up" delay={120}>
          <div className="relative mx-auto mt-12 max-w-xl overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-900/10 md:p-10">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-teal-400 via-sky-400 to-teal-400" aria-hidden />
            <div className="flex items-end justify-center gap-1">
              <span className="text-6xl font-extrabold tracking-tight text-slate-900">{pricing.price}</span>
              <span className="pb-2 text-lg font-semibold text-slate-400">{pricing.period}</span>
            </div>

            <ul className="mx-auto mt-8 max-w-sm space-y-3">
              {pricing.includes.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-600">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-[15px] text-slate-700">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <LandingButton to="/auth/signup" variant="primary" size="lg" withArrow className="w-full sm:w-auto">
                {pricing.primaryCta}
              </LandingButton>
              <LandingButton onClick={() => scrollToId('features')} variant="ghost" size="lg" className="w-full sm:w-auto">
                {pricing.secondaryCta}
              </LandingButton>
            </div>

            <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {pricing.chips.map((chip) => (
                <li key={chip} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export default PricingTeaser
