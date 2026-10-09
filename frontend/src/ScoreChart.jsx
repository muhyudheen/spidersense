import { pct } from './redteam.js'

// Grouped bars per config: attack success rate (red) and normal-task completion (green), plain SVG.
// In assist mode the attack bar is solid up to the best case and hatched up to the worst case.
const W = 380
const H = 220
const TOP = 26
const BOTTOM = 40
const LEFT = 50
const SHORT = { no_guard: 'No guard', allowlist_only: 'Allowlist', allowlist_plus_dataflow: '+ Guard' }

export default function ScoreChart({ cards }) {
  const plotH = H - TOP - BOTTOM
  const y = (v) => TOP + (1 - v) * plotH
  const group = (W - LEFT - 10) / cards.length
  const bar = Math.min(54, group / 3)
  return (
    <figure className="score-chart">
      <figcaption>
        <span><i className="swatch swatch-attack" /> attacks that got through</span>
        <span><i className="swatch swatch-benign" /> normal tasks done</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
           aria-label={cards.map((c) => `${c.label}: attacks ${c.asrText}, normal tasks ${pct(c.benignCompletion)}`).join('; ')}>
        <defs>
          <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="rgba(226,59,59,0.18)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="#e23b3b" strokeWidth="3" />
          </pattern>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line className="grid" x1={LEFT} x2={W - 6} y1={y(t)} y2={y(t)} />
            <text className="tick" x={LEFT - 8} y={y(t)} textAnchor="end" dominantBaseline="central">{pct(t)}</text>
          </g>
        ))}
        {cards.map((c, i) => {
          const gx = LEFT + i * group + (group - bar * 2 - 8) / 2
          const best = c.asrBest
          const worst = c.asrWorst
          return (
            <g key={c.config}>
              <title>{`${c.label}: attacks ${c.asrText}, normal tasks ${pct(c.benignCompletion)}`}</title>
              {worst > best && <rect fill="url(#hatch)" x={gx} y={y(worst)} width={bar} height={y(best) - y(worst)} />}
              <rect className="bar-attack" x={gx} y={y(best)} width={bar} height={Math.max(0, y(0) - y(best))} />
              <text className="bar-value attack" x={gx + bar / 2} y={y(worst) - 6} textAnchor="middle">{c.asrText}</text>
              <rect className="bar-benign" x={gx + bar + 8} y={y(c.benignCompletion)} width={bar}
                    height={Math.max(0, y(0) - y(c.benignCompletion))} />
              <text className="bar-value benign" x={gx + bar * 1.5 + 8} y={y(c.benignCompletion) - 6}
                    textAnchor="middle">{pct(c.benignCompletion)}</text>
              <text className="bar-label" x={LEFT + i * group + group / 2} y={H - BOTTOM + 24} textAnchor="middle">
                {SHORT[c.config]}
              </text>
            </g>
          )
        })}
        <line className="axis" x1={LEFT} x2={W - 6} y1={y(0)} y2={y(0)} />
      </svg>
    </figure>
  )
}
