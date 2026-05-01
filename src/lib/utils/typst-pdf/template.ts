// Typst document preamble used for every PDF we emit.
// Provides:
//  - page setup (A4, generous margins, no page number)
//  - typography (serif body, mono code, dark-on-white)
//  - helper functions for callouts, wikilinks, task list checkboxes
//  - syntax-highlighting theme for code blocks
export const PREAMBLE = `
#set document(author: "yeetbin", title: "yeetbin")
#set page(
  paper: "a4",
  margin: (x: 2cm, y: 2cm),
  numbering: "1 / 1",
)
#set par(justify: false, leading: 0.7em, first-line-indent: 0pt)
// Body uses Inter, then falls through to Noto Sans Symbols 2 (☑ ☐ ☒ etc.) and
// Noto Color Emoji (📝 🔥 ⚠️ etc.) for glyphs Inter doesn't include.
#set text(
  font: ("Inter", "Noto Sans Symbols 2", "Noto Color Emoji"),
  size: 11pt,
  lang: "en",
)
#show math.equation: set text(font: "New Computer Modern Math")

// Headings: tighter spacing, semibold
#show heading.where(level: 1): it => block(above: 1.4em, below: 0.7em)[
  #set text(weight: 700, size: 1.6em)
  #it.body
]
#show heading.where(level: 2): it => block(above: 1.2em, below: 0.6em)[
  #set text(weight: 600, size: 1.3em)
  #it.body
]
#show heading.where(level: 3): it => block(above: 1.0em, below: 0.5em)[
  #set text(weight: 600, size: 1.1em)
  #it.body
]
#show heading.where(level: 4): it => block(above: 0.9em, below: 0.4em)[
  #set text(weight: 600)
  #it.body
]

// Links: blue, no underline (matches reader view)
#show link: it => text(fill: rgb("#2563eb"), it)

// All raw uses JetBrains Mono with the same symbol/emoji fallback chain.
#show raw: set text(font: ("JetBrains Mono", "Noto Sans Symbols 2", "Noto Color Emoji"))

// Inline raw: light gray bg, mono
#show raw.where(block: false): it => box(
  fill: rgb("#f3f4f6"),
  outset: (y: 2pt),
  inset: (x: 3pt),
  radius: 2pt,
  text(size: 0.9em, it),
)

// Block raw: dark code blocks, syntect highlighting
#show raw.where(block: true): it => block(
  fill: rgb("#1e1e1e"),
  inset: 12pt,
  radius: 6pt,
  width: 100%,
  text(size: 0.9em, fill: rgb("#d4d4d4"), it),
)

// Blockquote
#let yb-blockquote(body) = block(
  stroke: (left: 3pt + rgb("#d1d5db")),
  inset: (left: 14pt, y: 4pt),
  width: 100%,
  text(fill: rgb("#6b7280"), style: "italic", body),
)

// Callout (Obsidian-style): label + content with a colored left border.
// Each kind has an icon emoji that pairs with the title, matching the screen
// renderer (src/lib/plugins/callout.ts).
#let yb-callout(kind: "note", title: none, body) = {
  let palette = (
    note:      ("#3b82f6", "#eff6ff", "✏️"),
    info:      ("#3b82f6", "#eff6ff", "ℹ️"),
    tip:       ("#06b6d4", "#ecfeff", "🔥"),
    warning:   ("#f59e0b", "#fffbeb", "⚠️"),
    danger:    ("#ef4444", "#fef2f2", "⚡"),
    bug:       ("#ef4444", "#fef2f2", "🐛"),
    example:   ("#8b5cf6", "#f5f3ff", "📋"),
    quote:     ("#6b7280", "#f9fafb", "❝"),
    abstract:  ("#06b6d4", "#ecfeff", "📋"),
    todo:      ("#3b82f6", "#eff6ff", "✅"),
    success:   ("#22c55e", "#f0fdf4", "✔️"),
    question:  ("#f59e0b", "#fffbeb", "❓"),
    failure:   ("#ef4444", "#fef2f2", "❌"),
    important: ("#06b6d4", "#ecfeff", "❗"),
    caution:   ("#f59e0b", "#fffbeb", "⚠️"),
  )
  let entry = palette.at(kind, default: palette.note)
  let stroke-color = rgb(entry.at(0))
  let bg = rgb(entry.at(1))
  let icon = entry.at(2)
  // Default title is the kind, capitalized.
  let header-title = if title != none { title } else {
    upper(kind.slice(0, 1)) + kind.slice(1)
  }
  block(
    fill: bg,
    stroke: (left: 4pt + stroke-color),
    radius: 4pt,
    inset: 10pt,
    width: 100%,
    {
      // Icon + title, on one line, in the kind's color
      text(weight: 600, fill: stroke-color, [#icon  #header-title])
      v(4pt)
      body
    },
  )
}

// Wikilink: distinct purple pill
#let yb-wikilink(target) = box(
  fill: rgb("#ede9fe"),
  outset: (y: 2pt),
  inset: (x: 4pt),
  radius: 3pt,
  text(fill: rgb("#7c3aed"), size: 0.95em, target),
)

// Highlight (==text==)
#let yb-highlight(body) = box(
  fill: rgb("#fef08a"),
  outset: (y: 2pt),
  inset: (x: 2pt),
  radius: 2pt,
  body,
)

// Task list checkboxes — drawn as Typst primitives so they always render
// regardless of font glyph coverage. Three states match the screen renderer:
// unchecked (gray outline), checked (green fill + ✓), cancelled (gray with ✗).
#let yb-task(state) = {
  let size = 0.9em
  let chk = if state == "checked" {
    box(
      width: size, height: size, radius: 2pt,
      fill: rgb("#22c55e"), stroke: 1pt + rgb("#22c55e"),
      align(center + horizon, text(white, weight: 700, size: 0.7em, "✓")),
    )
  } else if state == "cancelled" {
    box(
      width: size, height: size, radius: 2pt,
      stroke: 1pt + rgb("#9ca3af"),
      align(center + horizon, text(rgb("#9ca3af"), weight: 700, size: 0.7em, "✗")),
    )
  } else {
    box(width: size, height: size, radius: 2pt, stroke: 1pt + rgb("#9ca3af"))
  }
  chk
  h(0.4em)
}

// Horizontal rule
#let yb-hr() = align(center, line(length: 100%, stroke: 0.5pt + rgb("#e5e7eb")))

// Table cell helper: pad cells slightly
#show table.cell: it => pad(x: 4pt, y: 3pt, it)

`;
