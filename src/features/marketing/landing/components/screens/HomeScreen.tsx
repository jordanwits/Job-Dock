import ScreenShell from './ScreenShell'

/** Mock CleanDock home/today dashboard — used on the hero stage. */
const HomeScreen = () => {
  return (
    <ScreenShell>
      <div className="flex h-full flex-col px-4 pb-4">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[10px] font-semibold text-slate-400">Good morning</p>
            <p className="text-[15px] font-extrabold tracking-tight text-slate-900">Sparkle Maids</p>
          </div>
          <span className="h-9 w-9 rounded-full bg-gradient-to-br from-teal-400 to-sky-500" />
        </div>

        {/* Today summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 p-3 text-white shadow-sm shadow-teal-500/30">
            <p className="text-[9px] font-semibold uppercase tracking-wider opacity-80">Today</p>
            <p className="text-[20px] font-extrabold leading-tight">5 cleans</p>
            <p className="text-[9px] opacity-80">2 crews out</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Collected</p>
            <p className="text-[20px] font-extrabold leading-tight text-slate-900">$1,240</p>
            <p className="text-[9px] font-semibold text-emerald-600">+3 paid today</p>
          </div>
        </div>

        {/* Next up */}
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Next up</p>
        <div className="mt-1.5 space-y-2">
          {[
            { time: '9:00', name: 'Oakwood Dr', tag: 'Recurring', accent: 'bg-teal-500' },
            { time: '11:30', name: '14 Birch St', tag: 'Move-out', accent: 'bg-sky-500' },
          ].map((j) => (
            <div key={j.time} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5">
              <span className={`h-9 w-1 rounded-full ${j.accent}`} />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-800">{j.name}</p>
                <p className="text-[9px] text-slate-400">{j.time} AM · {j.tag}</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-around rounded-2xl bg-slate-100/80 p-1.5">
          {['Today', 'Jobs', 'Clients', 'Pay'].map((t, i) => (
            <span
              key={t}
              className={`rounded-xl px-3 py-1.5 text-[9px] font-bold ${i === 0 ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-400'}`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </ScreenShell>
  )
}

export default HomeScreen
