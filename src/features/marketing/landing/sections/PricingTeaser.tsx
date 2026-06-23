import Reveal from '../components/Reveal'
import { LandingButton } from '../components/landingUi'
import { landingContent } from '../content/landingContent'
import { SIGNUP_PLANS } from '@/features/auth/constants/plans'

const { pricing } = landingContent

// The middle tier is the one most crews land on, so we spotlight it.
const POPULAR_PLAN = 'team'

const PricingTeaser = () => {
  return (
    <section id="pricing" className="relative scroll-mt-24 bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
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

        <div className="mx-auto mt-14 grid max-w-md items-stretch gap-6 lg:max-w-none lg:grid-cols-3">
          {SIGNUP_PLANS.map((plan, i) => {
            const isPopular = plan.id === POPULAR_PLAN
            const [amount, period] = plan.price.split('/')
            return (
              <Reveal key={plan.id} from="up" delay={i * 100}>
                <div
                  className={`relative flex h-full flex-col rounded-[2rem] bg-white p-8 transition-transform duration-300 ${
                    isPopular
                      ? 'border-2 border-teal-400 shadow-2xl shadow-teal-500/15 md:-translate-y-3'
                      : 'border border-slate-200 shadow-sm hover:-translate-y-1'
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md shadow-teal-500/30">
                      Most popular
                    </span>
                  )}

                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                  </div>

                  <div className="mt-6 flex items-end gap-1">
                    <span className="text-5xl font-extrabold tracking-tight text-slate-900">{amount}</span>
                    {period && <span className="pb-1.5 text-base font-semibold text-slate-400">/{period}</span>}
                  </div>

                  <ul className="mt-7 space-y-3 border-t border-slate-100 pt-7">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
                            isPopular ? 'bg-teal-500 text-white' : 'bg-teal-100 text-teal-600'
                          }`}
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden>
                            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="text-[15px] leading-snug text-slate-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex flex-1 items-end">
                    <LandingButton
                      to={`/auth/signup?plan=${plan.id}`}
                      variant={isPopular ? 'primary' : 'ghost'}
                      size="lg"
                      withArrow={isPopular}
                      className="w-full"
                    >
                      Start free trial
                    </LandingButton>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>

        <Reveal from="up" delay={120}>
          <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {pricing.chips.map((chip) => (
              <li key={chip} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                {chip}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

export default PricingTeaser
