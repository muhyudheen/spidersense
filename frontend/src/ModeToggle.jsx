const MODES = ['strict', 'assist']
const TITLES = {
  strict: 'Strict: the Data-Flow Guard blocks a risky call',
  assist: 'Assist: the Data-Flow Guard holds a risky call for a human to approve or reject',
}

// The Data-Flow Guard's mode. One global value: the navbar and the Red-Team control bar share it.
export default function ModeToggle({ mode, setMode, big = false }) {
  return (
    <div className={big ? 'mode-toggle big' : 'mode-toggle'} role="group" aria-label="Data-Flow Guard mode">
      {MODES.map((m) => (
        <button key={m} className={mode === m ? `mode-opt active mode-${m}` : 'mode-opt'}
                aria-pressed={mode === m} title={TITLES[m]} onClick={() => setMode(m)}>
          {m.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
