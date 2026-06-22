import Reveal from '../components/Reveal'
import { landingContent } from '../content/landingContent'

const { testimonials } = landingContent

const Stars = () => (
  <div className="flex gap-0.5" aria-hidden>
    {Array.from({ length: 5 }).map((_, i) => (
      <svg key={i} className="h-4 w-4 text-[#D4AF37]" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9L10 1.5Z" />
      </svg>
    ))}
  </div>
)

const avatarGradients = ['from-teal-300 to-sky-400', 'from-amber-300 to-rose-400', 'from-indigo-300 to-violet-400']

const Testimonials = () => {
  return (
    <section className="relative bg-gradient-to-b from-sky-50/60 to-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal from="up">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 [text-wrap:balance] sm:text-4xl md:text-[2.75rem]">
              {testimonials.title}
            </h2>
          </Reveal>
          <Reveal from="up" delay={120}>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {testimonials.note}
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {testimonials.items.map((t, i) => (
            <Reveal key={t.author} from="up" delay={i * 100}>
              <figure className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
                <Stars />
                <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-slate-700">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                  {i === 0 ? (
                    <img
                      src="/marketing/landing/owner-apron.jpg"
                      alt=""
                      className="h-11 w-11 rounded-full object-cover ring-2 ring-white"
                      loading="lazy"
                    />
                  ) : (
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradients[i]} text-sm font-extrabold text-white`}>
                      {t.author.charAt(0)}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.author}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                    <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-600">{t.tag}</p>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Testimonials
