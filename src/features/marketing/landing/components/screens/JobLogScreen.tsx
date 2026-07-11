import ScreenShell from './ScreenShell'

const checklist = [
  { label: 'Kitchen + appliances', done: true },
  { label: 'Bathrooms · 2', done: true },
  { label: 'Bedrooms + linens', done: false },
]

/** Mock CleanDock job-log screen — before/after photos, time tracking, checklist. */
const JobLogScreen = () => {
  return (
    <ScreenShell>
      <div className="flex h-full flex-col px-4 pb-4">
        <div className="flex items-center justify-between py-2">
          <p className="text-[15px] font-extrabold tracking-tight text-slate-900">Job log</p>
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-700 ring-1 ring-teal-200">
            In progress
          </span>
        </div>

        <p className="text-[11px] font-bold text-slate-700">Birch Street move-out</p>
        <p className="text-[9px] text-slate-400">14 Birch St · Marla Hayes</p>

        {/* Timer */}
        <div className="mt-2.5 flex items-center gap-2 rounded-2xl bg-gradient-to-br from-teal-500 to-sky-500 px-3 py-2.5 text-white shadow-sm shadow-teal-500/30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 1.5M9 2h6" strokeLinecap="round" />
          </svg>
          <div className="leading-tight">
            <p className="text-[8px] font-semibold uppercase tracking-wider opacity-80">Time on site</p>
            <p className="text-[14px] font-extrabold tabular-nums">01:42:08</p>
          </div>
          <span className="ml-auto rounded-lg bg-white/20 px-2 py-1 text-[9px] font-bold">Pause</span>
        </div>

        {/* Before / after */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: 'Before', src: '/marketing/landing/living-room-white.jpg' },
            { label: 'After', src: '/marketing/landing/bedroom-turnover.jpg' },
          ].map((shot) => (
            <div key={shot.label} className="relative overflow-hidden rounded-xl ring-1 ring-slate-200">
              <img src={shot.src} alt="" className="h-16 w-full object-cover" draggable={false} />
              <span className="absolute left-1 top-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[8px] font-bold text-white">
                {shot.label}
              </span>
            </div>
          ))}
        </div>

        {/* Checklist */}
        <div className="mt-3 space-y-1.5">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-md ${
                  item.done ? 'bg-teal-500 text-white' : 'border border-slate-300 bg-white'
                }`}
              >
                {item.done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={`text-[10px] font-semibold ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-auto rounded-xl bg-slate-900 py-2.5 text-center text-[11px] font-bold text-white">
          Mark complete
        </div>
      </div>
    </ScreenShell>
  )
}

export default JobLogScreen
