import ScreenShell from './ScreenShell'

/** Mock JobDock invoice screen showing a paid invoice — reinforces "get paid fast". */
const InvoicePaidScreen = () => {
  return (
    <ScreenShell>
      <div className="flex h-full flex-col px-4 pb-4">
        {/* App header */}
        <div className="flex items-center justify-between py-2">
          <span className="text-[15px] font-extrabold tracking-tight text-slate-900">Invoice</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            #1043
          </span>
        </div>

        {/* Invoice card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">Billed to</p>
              <p className="text-[12px] font-bold text-slate-800">Marla Hayes</p>
              <p className="text-[9px] text-slate-400">128 Oakwood Dr</p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-teal-400 to-sky-500" />
          </div>

          <div className="mt-3 space-y-1.5 text-[10px]">
            <div className="flex justify-between text-slate-600">
              <span>Deep clean · 3bd / 2ba</span>
              <span className="font-semibold text-slate-800">$240</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Inside fridge</span>
              <span className="font-semibold text-slate-800">$35</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Interior windows</span>
              <span className="font-semibold text-slate-800">$45</span>
            </div>
            <div className="my-1.5 border-t border-dashed border-slate-200" />
            <div className="flex justify-between text-[12px] font-extrabold text-slate-900">
              <span>Total</span>
              <span>$341.25</span>
            </div>
          </div>
        </div>

        {/* Paid badge */}
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-[12px] font-extrabold text-emerald-700">Paid</p>
            <p className="text-[9px] text-emerald-600/80">Card · Jun 18, 9:02 AM</p>
          </div>
          <span className="ml-auto text-[12px] font-extrabold text-emerald-700">$341.25</span>
        </div>

        <div className="mt-auto space-y-2 pt-3">
          <div className="rounded-xl bg-teal-500 py-2.5 text-center text-[11px] font-bold text-white shadow-sm shadow-teal-500/30">
            View receipt
          </div>
          <div className="rounded-xl border border-slate-200 bg-white py-2.5 text-center text-[11px] font-bold text-slate-600">
            Send thank-you
          </div>
        </div>
      </div>
    </ScreenShell>
  )
}

export default InvoicePaidScreen
