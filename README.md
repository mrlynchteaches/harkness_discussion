# Harkness Discussion Tracker — GitHub Pages Package

This package contains a **teacher-focused static web app** for running a Harkness / Socratic discussion without any backend service.

## What's included

- `index.html` — page shell
- `styles.css` — styling
- `app.js` — all app logic (teacher dashboard + student display)
- `sample-roster.csv` — example roster import file
- `sample-rubric.csv` — example rubric import file
- `sample-session.json` — example full session export/import reference

## Main features

- Teacher-only working view with live scoring
- Projected student display view with:
  - queue
  - discussion questions
  - scoring criteria
  - final radial map after session close
- Import roster from CSV or JSON
- Import rubric from CSV or JSON
- Export students CSV
- Export events CSV
- Export full session JSON
- Print / Save as PDF through the browser print dialog
- Local autosave in browser storage

## How to publish on GitHub Pages

### Option A — simplest
1. Create a new GitHub repository.
2. Upload all files from this package to the root of the repository.
3. In GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and the `/root` folder.
6. Save.
7. Wait for GitHub Pages to publish your site.

### Option B — docs folder
1. Put all files in a `docs/` folder.
2. In **Settings → Pages**, choose the `main` branch and `/docs`.

## Recommended classroom workflow

1. Open the site on your teacher laptop.
2. Import your roster and rubric files.
3. Enter your discussion questions.
4. Use **Teacher view** during the discussion.
5. Switch to **Student display** for projection.
6. Close the session when discussion ends to reveal the final map.
7. Export CSV / JSON and optionally print to PDF.

## Sample CSV formats

### Roster CSV
```csv
displayName,username
Amelia,amelia
Ben,ben
Carter,carter
```

### Rubric CSV
```csv
label,value,color
Use of textual evidence,1,#2563eb
Builds on a peer's idea or connects to peer's ideas,1,#7c3aed
Invites another voice or provides a nuanced counterclaim respectfully,1,#059669
Asks a probing question or clarifying question,1,#d97706
```

## Notes

- This app is designed to work **without a server or database**.
- All live work happens on the teacher's device.
- Data is stored in the browser using local storage until you export or clear it.
- If browser storage is cleared, any unexported session data can be lost.
