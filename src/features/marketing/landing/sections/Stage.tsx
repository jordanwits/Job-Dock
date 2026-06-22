import { cn } from '@/lib/utils'
import Reveal from '../components/Reveal'
import PhoneFrame from '../components/PhoneFrame'
import { Kicker } from '../components/landingUi'
import { SCREENS } from '../phone3d/phoneStages'
import { landingContent } from '../content/landingContent'

type StageData = (typeof landingContent.stages)[number]

interface StageProps {
  /** Position in the phone journey (hero is 0, so the first content stage is 1). */
  index: number
  stage: StageData
  /** When true (mobile / reduced motion), render a static phone here instead of the shared 3D one. */
  showInlinePhone: boolean
  /** Optional anchor id for nav. */
  id?: string
}

const Stage = ({ index, stage, showInlinePhone, id }: StageProps) => {
  const Screen = SCREENS[stage.screen]
  const phoneLeft = stage.side === 'left'

  return (
    <section id={id} className="relative flex min-h-[100svh] scroll-mt-24 items-center overflow-x-clip py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 md:px-8 lg:grid-cols-2 lg:gap-16">
        {/* Phone slot */}
        <div className={cn('relative order-2 flex items-center justify-center', phoneLeft ? 'lg:order-1' : 'lg:order-2')}>
          {/* Centre marker the 3D phone aligns to (always present, zero-size). */}
          <span data-phone-stage={index} className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" aria-hidden />
          {showInlinePhone ? (
            <PhoneFrame>
              <Screen />
            </PhoneFrame>
          ) : (
            <div className="hidden h-[clamp(420px,66vh,620px)] w-full lg:block" aria-hidden />
          )}
        </div>

        {/* Text */}
        <div className={cn('order-1', phoneLeft ? 'lg:order-2' : 'lg:order-1')}>
          <Reveal from="up">
            <Kicker>{stage.kicker}</Kicker>
          </Reveal>
          <Reveal from="up" delay={80}>
            <h2 className="mt-5 text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 [text-wrap:balance] sm:text-4xl md:text-[2.6rem]">
              {stage.title}
            </h2>
          </Reveal>
          <Reveal from="up" delay={140}>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-600 [text-wrap:pretty]">{stage.body}</p>
          </Reveal>
          <Reveal from="up" delay={200}>
            <ul className="mt-7 space-y-3">
              {stage.points.map((p) => (
                <li key={p} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-500 text-white">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="text-[15px] leading-relaxed text-slate-700">{p}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

export default Stage
