// NodeView.tsx — React back-end for the render tree.

import { FONT, SCRIPT, runShifts, type Node } from '../kernel/nodes'

export function NodeView({ n }: { n: Node }) {
  if (n.t === 'g') {
    return (
      <g transform={n.m ? `matrix(${n.m.join(' ')})` : undefined}>
        {n.kids.map((k, i) => (
          <NodeView key={k.t === 'g' && k.key ? k.key : i} n={k} />
        ))}
      </g>
    )
  }
  if (n.t === 'path') {
    return (
      <path
        d={n.d}
        fill={n.fill ?? 'none'}
        stroke={n.stroke}
        strokeWidth={n.stroke ? (n.sw ?? 1) : undefined}
        strokeDasharray={n.dash?.join(' ')}
        strokeLinecap={n.cap ?? 'round'}
        strokeLinejoin={n.join ?? 'round'}
      />
    )
  }
  const shifts = runShifts(n.runs, n.size)
  return (
    <text x={n.x} y={n.y} fontFamily={FONT} fontSize={n.size} textAnchor={n.anchor} fill={n.fill}>
      {n.runs.map((r, i) => (
        <tspan key={i} dy={shifts[i] || undefined} fontSize={r.script === 'normal' ? undefined : n.size * SCRIPT.scale}>
          {r.text}
        </tspan>
      ))}
    </text>
  )
}
