import Reveal from '../components/Reveal'
import { Kicker } from '../components/landingUi'
import { landingContent } from '../content/landingContent'

const { about } = landingContent

/**
 * Plain-language "what is this product" band. Sits below the phone region (outside the 3D phone
 * choreography) and states JobDock's purpose and core functionality in crawlable text.
 */
const WhatIs = () => {
  return (
    <section id="what-is-jobdock" className="relative bg-white py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
        <Reveal from="up">
          <Kicker>{about.kicker}</Kicker>
        </Reveal>
        <Reveal from="up" delay={80}>
          <h2 className="mt-5 text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 [text-wrap:balance] sm:text-4xl">
            {about.title}
          </h2>
        </Reveal>
        <Reveal from="up" delay={160}>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 [text-wrap:pretty]">
            {about.body}
          </p>
        </Reveal>
      </div>
    </section>
  )
}

export default WhatIs
