import { d1Bars, metricLabel } from './lib.js'

// Horizontal bar chart of D1 single-feature scores, in plain SVG. Coordinates are viewBox units;
// the chart scales to the page width, so 20-unit text is about 20 px on a typical screen.
const W = 1000
const ROW = 42
const BAR = 28
const TOP = 34 // room for the threshold label
const AXIS = 40 // room for the tick labels
const SCORE_W = 70 // room for the score after the longest bar
const MAX_NAME = 30
const TICKS = [0, 0.25, 0.5, 0.75, 1]

const shortName = (name) => (name.length > MAX_NAME ? `${name.slice(0, MAX_NAME - 1)}…` : name)

export default function D1Chart({ d1 }) {
  const bars = d1Bars(d1)
  const metric = metricLabel(d1.metric)
  // Label column wide enough for the longest name in bold (about 13 units per character at 20-unit text)
  const labelW = Math.min(400, Math.max(160, Math.max(...bars.map((b) => shortName(b.name).length)) * 13))
  const x0 = labelW + 16
  const plotW = W - x0 - SCORE_W
  const x = (v) => x0 + v * plotW
  const plotBottom = TOP + bars.length * ROW
  const height = plotBottom + AXIS
  const hasThreshold = typeof d1.threshold === 'number'
  const flagged = bars.filter((b) => b.flagged).length

  return (
    <figure className="chart">
      <figcaption>
        <h2>D1 · How well each column alone predicts the target ({metric})</h2>
        <div className="legend">
          <span><i className="swatch swatch-flagged" /> flagged ({flagged})</span>
          <span><i className="swatch swatch-ok" /> not flagged ({bars.length - flagged})</span>
          {hasThreshold && <span><i className="swatch swatch-threshold" /> threshold {d1.threshold}</span>}
        </div>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${height}`} role="img"
           aria-label={`D1 ${metric} per column: ${bars.map((b) => `${b.name} ${b.score}`).join(', ')}`}>
        {TICKS.map((t) => (
          <g key={t}>
            <line className="grid" x1={x(t)} x2={x(t)} y1={TOP - 6} y2={plotBottom} />
            <text className="tick" x={x(t)} y={plotBottom + 28} textAnchor="middle">{t}</text>
          </g>
        ))}

        {bars.map((b, i) => {
          const y = TOP + i * ROW + (ROW - BAR) / 2
          return (
            <g key={b.name}>
              <title>{`${b.name}: ${metric} ${b.score}${b.flagged ? ' (flagged)' : ''}`}</title>
              <text className={b.flagged ? 'name flagged' : 'name'} x={labelW} y={y + BAR / 2} textAnchor="end"
                    dominantBaseline="central">{shortName(b.name)}</text>
              <rect className={b.flagged ? 'bar flagged' : 'bar'} x={x0} y={y} width={b.width * plotW} height={BAR} rx="3" />
            </g>
          )
        })}

        {/* Drawn over the bars but under the scores; the scores have a dark outline so they stay readable */}
        {hasThreshold && (
          <line className="threshold" x1={x(d1.threshold)} x2={x(d1.threshold)} y1={TOP - 8} y2={plotBottom} />
        )}
        {bars.map((b, i) => (
          <text key={b.name} className={b.flagged ? 'score flagged' : 'score'} x={x(b.width) + 8}
                y={TOP + i * ROW + ROW / 2} dominantBaseline="central">{b.score}</text>
        ))}

        <line className="axis" x1={x0} x2={x0} y1={TOP - 6} y2={plotBottom} />
        {hasThreshold && (
          <text className="threshold-label" x={x(d1.threshold)} y={TOP - 14} textAnchor="middle">
            threshold {d1.threshold}
          </text>
        )}
      </svg>
    </figure>
  )
}
