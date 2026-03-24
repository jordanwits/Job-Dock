/** Grey X for public quote/invoice decline confirmation (non-emoji). */
export function DeclineSuccessIcon() {
  return (
    <div className="mb-4 flex justify-center" role="img" aria-label="Declined">
      <svg
        className="h-14 w-14 shrink-0 text-primary-light/40 sm:h-16 sm:w-16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </div>
  )
}
