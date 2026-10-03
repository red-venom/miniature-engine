// NodeView.tsx — React back-end for the render tree.
// With `itemId`, the top-level group gets `data-id` and a transparent copy of its line paths with a 12 px stroke,
// so that the editor finds hits with the DOM (section 12). With `line`, every stroke is that many screen px
// (library thumbnails). Neither reaches an export: the SVG file and the PNG read the tree directly.

import { memo } from 'react'
import { FONT, SCRIPT, runShifts, type Node } from '../kernel/nodes'

export const HIT_STROKE = 12

function matrix(n: Node): string | undefined {
  return n.t === 'g' && n.m ? `matrix(${n.m.join(' ')})` : undefined
}

/** Transparent copies of every stroked path, in the same transforms, for pointer hits near a line. */
function HitView({ n }: { n: Node }) {
  if (n.t === 'g') {
    return (
      <g transform={matrix(n)}>
        {n.kids.map((k, i) => (
          <HitView key={k.t === 'g' && k.key ? k.key : i} n={k} />
        ))}
      </g>
    )
  }
  if (n.t === 'path' && n.stroke) {
    return (
      <path
        d={n.d}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
      />
    )
  }
  return null
}

interface Props {
  n: Node
  /** The item this top-level group draws. */
  itemId?: string
  /** Force every line to this width in screen px, whatever the scale. */
  line?: number
}

function NodeViewPlain({ n, itemId, line }: Props) {
  if (n.t === 'g') {
    return (
      <g transform={matrix(n)} data-id={itemId}>
        {n.kids.map((k, i) => (
          <NodeView key={k.t === 'g' && k.key ? k.key : i} n={k} line={line} />
        ))}
        {itemId && n.kids.map((k, i) => <HitView key={`hit${k.t === 'g' && k.key ? k.key : i}`} n={k} />)}
      </g>
    )
  }
  if (n.t === 'path') {
    return (
      <path
        d={n.d}
        fill={n.fill ?? 'none'}
        stroke={n.stroke}
        strokeWidth={n.stroke ? (line ?? n.sw ?? 1) : undefined}
        strokeDasharray={n.dash?.join(' ')}
        strokeLinecap={n.cap ?? 'round'}
        strokeLinejoin={n.join ?? 'round'}
        vectorEffect={line && n.stroke ? 'non-scaling-stroke' : undefined}
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

/** Memoised on the node object: an unchanged item is not rebuilt (the drag budget in section 6). */
export const NodeView = memo(NodeViewPlain)
