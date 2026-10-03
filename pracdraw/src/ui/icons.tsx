// icons.tsx — inline SVG icons, 20 px, 1.75 px line. No icon library.

import type { ReactNode } from 'react'

function icon(children: ReactNode) {
  return (
    <svg
      className="icon"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const icons = {
  select: icon(
    <>
      <path d="M4 3l12 7-5 1.5L8.5 17z" />
    </>,
  ),
  undo: icon(
    <>
      <path d="M7 5L3 9l4 4" />
      <path d="M3 9h9a5 5 0 0 1 0 10h-2" />
    </>,
  ),
  redo: icon(
    <>
      <path d="M13 5l4 4-4 4" />
      <path d="M17 9H8a5 5 0 0 0 0 10h2" />
    </>,
  ),
  zoomIn: icon(
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4M9 6.5v5M6.5 9h5" />
    </>,
  ),
  zoomOut: icon(
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4M6.5 9h5" />
    </>,
  ),
  fit: icon(
    <>
      <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
    </>,
  ),
  copy: icon(
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M13 7V4.5A1.5 1.5 0 0 0 11.5 3h-7A1.5 1.5 0 0 0 3 4.5v7A1.5 1.5 0 0 0 4.5 13H7" />
    </>,
  ),
  menu: icon(
    <>
      <path d="M4 6h12M4 10h12M4 14h12" />
    </>,
  ),
  plus: icon(
    <>
      <path d="M10 4v12M4 10h12" />
    </>,
  ),
  close: icon(
    <>
      <path d="M5 5l10 10M15 5L5 15" />
    </>,
  ),
  search: icon(
    <>
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" />
    </>,
  ),
  rotateLeft: icon(
    <>
      <path d="M6 4L3 7l3 3" />
      <path d="M3 7h8a6 6 0 1 1-6 6" />
    </>,
  ),
  rotateRight: icon(
    <>
      <path d="M14 4l3 3-3 3" />
      <path d="M17 7H9a6 6 0 1 0 6 6" />
    </>,
  ),
  flip: icon(
    <>
      <path d="M10 2v16" strokeDasharray="2 2" />
      <path d="M7 5L3 10l4 5zM13 5l4 5-4 5z" />
    </>,
  ),
  front: icon(
    <>
      <rect x="3" y="3" width="9" height="9" rx="1" />
      <path d="M8 8h9v9H8z" fill="var(--panel)" />
    </>,
  ),
  back: icon(
    <>
      <rect x="8" y="8" width="9" height="9" rx="1" />
      <path d="M3 3h9v9H3z" fill="var(--panel)" />
    </>,
  ),
  forward: icon(
    <>
      <path d="M10 16V4M5 9l5-5 5 5" />
    </>,
  ),
  backward: icon(
    <>
      <path d="M10 4v12M5 11l5 5 5-5" />
    </>,
  ),
  lock: icon(
    <>
      <rect x="4" y="9" width="12" height="8" rx="1.5" />
      <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
    </>,
  ),
  trash: icon(
    <>
      <path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11" />
    </>,
  ),
  duplicate: icon(
    <>
      <rect x="3" y="3" width="9" height="9" rx="1.5" />
      <path d="M8 8h9v9H8z" fill="var(--panel)" />
      <path d="M12.5 10.5v4M10.5 12.5h4" />
    </>,
  ),
  help: icon(
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.5 8a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7M10 15h.01" />
    </>,
  ),
}
