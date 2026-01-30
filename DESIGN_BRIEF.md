# al-ice.ai — Design Refresh Brief (PR-only)

## Goal
Make the site look **premium and attractive**, while staying **fast**, **readable**, and **credible** for an AI+security audience.

Success looks like:
- Clear, confident hero message + primary CTA
- Posts and categories feel like an editorial product (not a raw feed)
- Mobile-first polish (spacing, type, tap targets)
- No layout clutter; consistent hierarchy

## Scope (v1)
Pages:
- Home (`/`)
- Posts index + pagination (`/posts/`, `/posts/page/<n>/`)
- Category pages (`/categories/<slug>/`)

Components:
- Header/nav
- Hero section
- Post cards + badges
- Pill filters (categories)
- Pagination
- Footer

## Constraints
- Static HTML/CSS-first; avoid heavy JS.
- Keep existing URLs and content structure.
- Keep load time fast (optimize fonts/images).

## Style direction
“Modern editorial security/AI”:
- Strong typography
- Subtle depth (shadows/borders) and spacing
- Minimal, confident color palette
- Optional: light pattern/gradient only if tasteful

## Deliverables
1) **Figma**
   - Desktop + mobile designs
   - Style tokens (type scale, colors, spacing)
   - Components library
2) **Code via PRs**
   - PR1: shared CSS + base components
   - PR2: home
   - PR3: posts + categories polish

## PR-only workflow (non-negotiable)
- Work in a **fork** or non-protected branch.
- Open PRs against `main`.
- No direct pushes to `main`.

## Review checklist
- Looks great on mobile
- Hero communicates value in 5 seconds
- Posts index is scannable (title/date/category clear)
- Consistent spacing and headings
- No broken links
- Keeps performance strong
