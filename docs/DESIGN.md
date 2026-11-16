# Design

## Inspiration and acknowledgement

Deskmate's interface takes **big inspiration from the Claude app by Anthropic**, including its overall feel, typography, font sizes, spacing, warm neutral palette, and rounded minimal components. We admire how calm and readable it is, and a help desk used all day by office staff benefits from the same qualities.

This is inspiration, not a copy. Deskmate defines its own color values, uses open-source fonts, and has its own logo. It does not use Anthropic's name, logos, illustrations, proprietary fonts, or other brand assets, and it is not affiliated with or endorsed by Anthropic.

## Principles

1. **Calm.** Warm ivory backgrounds, soft borders, one accent color. Color is reserved for meaning: clay for "your turn", red for "needs a person", green for "done".
2. **Readable.** Body text is 15px with a 1.55 line height. Message bodies and reply drafts use a serif at 17px, because they are reading surfaces.
3. **Plain language.** "Needs your review", not "pending_approval". "Questions answered", not "resolved tickets". "Words that usually mean this department", not "keywords".
4. **One clear next step.** Each screen has one primary button.

## Tokens

All tokens live in `apps/web/src/styles.css` as CSS variables, with a dark theme that follows the system setting.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#faf9f5` | `#262624` | Page canvas |
| `--bg-sidebar` | `#f3f1ea` | `#1f1e1d` | Sidebar |
| `--surface` | `#ffffff` | `#30302e` | Cards, inputs |
| `--text` | `#1f1e1c` | `#f4f3ee` | Primary text |
| `--text-2` | `#5f5d57` | `#c3c1b8` | Secondary text |
| `--border` | `#e6e3d9` | `#3d3c38` | Hairlines |
| `--accent` | `#c2603e` | `#d9774f` | Primary actions, focus |

**Type.** Headings use Source Serif 4 at weight 500. UI uses Inter. Both are self-hosted through Fontsource, so no requests go to font CDNs (which matters for school privacy policies).

| Role | Size |
|---|---|
| Display (wizard headings) | 36px serif |
| Page title | 30px serif |
| Section | 24px / 19px serif |
| Message and draft body | 17px serif |
| Body | 15px |
| Labels, buttons | 14px, weight 500 |
| Small, hints | 13px |
| Badges | 12px |

**Spacing.** 4px grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.

**Shape.** Inputs and buttons use a 10px radius, cards 14px, the draft card and drop zone 20px, and badges are pills.

## Components

Buttons (primary, dark, default, ghost), inputs and selects with a soft focus ring, choice cards for templates and models, badges, notices, the drop zone, list rows, segmented tabs, stat cards, and the draft card. All are in `styles.css` and `components/ui.tsx`.
