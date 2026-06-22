import ScreenShell from './ScreenShell'

/** Mock JobDock online-booking request — used on the booking stage. */
const BookingScreen = () => {
  return (
    <ScreenShell>
      <div className="flex h-full flex-col px-4 pb-4">
        <div className="flex items-center justify-between py-2">
          <p className="text-[15px] font-extrabold tracking-tight text-slate-900">Booking request</p>
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-teal-500" />
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-sm font-extrabold text-white">
              J
            </span>
            <div>
              <p className="text-[12px] font-bold text-slate-800">Jordan Lee</p>
              <p className="text-[9px] text-slate-400">Requested 24/7 via your link</p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Service</span>
              <span className="font-bold text-slate-700">Deep clean · 2bd / 1ba</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Preferred</span>
              <span className="font-bold text-slate-700">Thu, Jun 26 · AM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Address</span>
              <span className="font-bold text-slate-700">88 Cedar Ave</span>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-[9px] font-semibold text-teal-700 ring-1 ring-teal-100">
          Fits your Thursday route — no conflicts.
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
          <div className="rounded-xl border border-slate-200 bg-white py-2.5 text-center text-[11px] font-bold text-slate-500">
            Adjust
          </div>
          <div className="rounded-xl bg-teal-500 py-2.5 text-center text-[11px] font-bold text-white shadow-sm shadow-teal-500/30">
            Approve
          </div>
        </div>
      </div>
    </ScreenShell>
  )
}

export default BookingScreen
