# Tempo

A simple phone app to track the hours you spend on each project: a quick daily log with notes, and totals per week, month and year.

It works offline and keeps everything on your phone. Nothing is sent anywhere, and there's no account.

## How it works
- **Day:** the day's entries and its total. Use the arrows to go to other days, and tap the date to come back to today.
- **Add entry:** type a project (it suggests the ones you've used, so "Website" and "website" stay one project), the hours (1.5, 1,5 or 1:30), and an optional note. The quick buttons fill in ½, 1, 2, 4 or 8 hours. Save is at the top.
- **Edit or delete:** tap an entry.
- **Totals:** hours per project for a week, a month or a year, with a bar and a percentage each. Tap a project to see all its days and notes.
- **Projects:** rename one, change its colour or archive it from its page (Menu → Projects lists them all). Archived projects stay in the totals but leave the suggestions.
- **Language:** English or Italian, in the menu.

## Install on your phone
1. Open the app's address in Chrome on Android (or Safari on iPhone).
2. Android: ⋮ menu → **Install app**. iPhone: Share → **Add to Home Screen**.

## Backup
Everything lives only in this phone's browser storage. Use **Menu → Export backup** to save a file, and **Import backup** to restore it, for example on a new phone. Importing replaces what's in the app.

## Files
| File | What it does |
|---|---|
| `index.html` | The page |
| `styles.css` | The look: clean light grey and slate blue; always light |
| `lang.js` | All the text, in English and Italian |
| `app.js` | Projects, entries, totals, backup |
| `sw.js` | Lets the app work offline. Bump `VERSION` whenever a file changes |
| `manifest.webmanifest`, `icons/` | Name, icon and app ID (`/tempo/`) for the home screen |

made by gionzana · [☕ buy me a coffee](https://buymeacoffee.com/gionzana)

find more apps by me on [github](https://github.com/rb-gith?tab=repositories)
