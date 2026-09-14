export function BootSplash() {
  return (
    <div className="boot-splash" role="status" aria-live="polite" aria-busy="true">
      <div className="boot-splash-inner">
        <div className="boot-splash-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <path fill="currentColor" d="M15 6h2v8h8v2h-8v10h-2V16H7v-2h8z" />
          </svg>
        </div>
        <div className="boot-splash-name">Setflow</div>
        <div className="boot-splash-tag">Worship setlist builder</div>
        <div className="boot-splash-eq" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="sr-only">Loading Setflow</span>
      </div>
    </div>
  )
}
