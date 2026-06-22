import ScreenShell from './ScreenShell'

const days = [
  { d: 'M', n: 16 },
  { d: 'T', n: 17 },
  { d: 'W', n: 18, today: true },
  { d: 'T', n: 19 },
  { d: 'F', n: 20 },
  { d: 'S', n: 21 },
]

const jobs = [
  { time: '8:00', title: 'Recurring · Oakwood Dr', tag: 'Weekly', accent: 'bg-teal-500', soft: 'bg-teal-50 text-teal-700 ring-teal-200' },
  { time: '10:30', title: 'Move-out · 14 Birch St', tag: '3bd', accent: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700 ring-sky-200' },
  { time: '1:00', title: 'Office turnover · Lumen Co', tag: 'Crew', accent: 'bg-indigo-500', soft: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
]

/** Mock JobDock week calendar — reinforces scheduling + recurring cleans. */
const WeekCalendarScreen = () => {
  return (
    <ScreenShell>
      <div className="flex h-full flex-col px-4 pb-4">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-[15px] font-extrabold tracking-tight text-slate-900">This week</p>
            <p className="text-[9px] font-semibold text-slate-400">June 2026</p>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M8 7V3M16 7V3M4 11h16M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" strokeLinecap="round" />
            </svg>
          </span>
        </div>

        {/* Weekday strip */}
        <div className="flex justify-between">
          {days.map((day) => (
            <div
              key={day.n}
              className={`flex h-12 w-9 flex-col items-center justify-center rounded-xl text-center ${
                day.today ? 'bg-teal-500 text-white shadow-sm shadow-teal-500/30' : 'text-slate-500'
              }`}
            >
              <span className="text-[9px] font-semibold opacity-80">{day.d}</span>
              <span className="text-[13px] font-extrabold">{day.n}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="mt-3 space-y-2">
          {jobs.map((job) => (
            <div key={job.time} className="flex items-stretch gap-2">
              <div className="w-9 pt-1 text-right text-[9px] font-bold text-slate-400">{job.time}</div>
              <div className="relative flex-1 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${job.accent}`} />
                <div className="flex items-center justify-between pl-1.5">
                  <p className="text-[11px] font-bold text-slate-800">{job.title}</p>
                  <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ring-1 ${job.soft}`}>
                    {job.tag}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 pl-1.5">
                  <span className="h-4 w-4 rounded-full bg-gradient-to-br from-teal-300 to-sky-400 ring-2 ring-white" />
                  <span className="-ml-1.5 h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 to-rose-400 ring-2 ring-white" />
                  <span className="ml-1 text-[8px] font-semibold text-slate-400">2 cleaners</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Floating add */}
        <div className="mt-auto flex justify-end pt-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/40">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      </div>
    </ScreenShell>
  )
}

export default WeekCalendarScreen
