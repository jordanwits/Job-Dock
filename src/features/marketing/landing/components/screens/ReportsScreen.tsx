import ScreenShell from './ScreenShell'

const bars = [
  { d: 'Mon', h: 42 },
  { d: 'Tue', h: 64 },
  { d: 'Wed', h: 55 },
  { d: 'Thu', h: 82 },
  { d: 'Fri', h: 70 },
  { d: 'Sat', h: 38 },
]

/** Mock JobDock reports screen — used on the reports/get-paid stage. */
const ReportsScreen = () => {
  return (
    <ScreenShell>
      <div className="flex h-full flex-col px-4 pb-4">
        <div className="flex items-center justify-between py-2">
          <p className="text-[15px] font-extrabold tracking-tight text-slate-900">Reports</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">This week</span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Revenue</p>
          <div className="flex items-end justify-between">
            <p className="text-[22px] font-extrabold tracking-tight text-slate-900">$4,820</p>
            <p className="pb-1 text-[10px] font-bold text-emerald-600">▲ 18%</p>
          </div>

          {/* Bar chart */}
          <div className="mt-3 flex h-24 items-end justify-between gap-2">
            {bars.map((b, i) => (
              <div key={b.d} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-md ${i === 3 ? 'bg-gradient-to-t from-teal-500 to-sky-400' : 'bg-teal-100'}`}
                  style={{ height: `${b.h}%` }}
                />
                <span className="text-[8px] font-semibold text-slate-400">{b.d}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Jobs done</p>
            <p className="text-[16px] font-extrabold text-slate-900">31</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Avg ticket</p>
            <p className="text-[16px] font-extrabold text-slate-900">$155</p>
          </div>
        </div>

        <div className="mt-auto rounded-xl bg-slate-900 py-2.5 text-center text-[11px] font-bold text-white">
          Export CSV
        </div>
      </div>
    </ScreenShell>
  )
}

export default ReportsScreen
