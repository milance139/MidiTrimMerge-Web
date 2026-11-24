# MIDI Trim & Merge — Web

The browser version of the **MIDI Trim & Merge** desktop tool. Trim, merge, and preview MIDI / karaoke files right in the browser, in English or Serbian (Srpski).

**▶ Open the app: https://milance139.github.io/MidiTrimMerge-Web/**

Nothing is uploaded to a server. Your files are processed on your own computer, inside the browser.

## Features

Everything from the desktop app:

- **Add files** with the button or by drag & drop; reorder by dragging rows or with Move up / Move down.
- **Trim** each song to a start/end time (or use *Start here* / *End here* while it plays).
- **Merge** one after another or layered, with an **overlap** between songs and an optional **smooth fade**.
- **Per-song settings**: transpose, speed, volume, and a different instrument per channel; one-click **auto-trim silence** and **match loudness**.
- **BPM and key** columns (taking speed and transpose into account).
- **Karaoke**: detects lyrics, hides credit lines, edits text with find/replace and code-page choice (Windows-1250/1251/1252, UTF-8), shows a plain-text view, and highlights the **live lyrics** while a song plays.
- **Player** with a seek bar: a built-in General MIDI synthesizer, or **Web MIDI** output to a connected keyboard (Chrome / Edge).
- **Undo / Redo** (Ctrl+Z / Ctrl+Y), adjustable text size, and a light/dark theme that follows the system.
- **Autosave**: the list, including the MIDI files, is kept in the browser and restored the next time you open the page.
- **Playlists (.mtm)** store the MIDI files inside, so a playlist opens on any computer. To open a playlist from the desktop app, select the `.mtm` file together with its MIDI files.

## How it works

Plain HTML, CSS, and JavaScript with no build step, served by GitHub Pages.

| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `css/style.css` | Styles (responsive, light/dark) |
| `js/midi.js` | MIDI read/write, trim, merge/overlap/fade, transpose, speed, key detection, karaoke text. It is a port of `Midi.cs` and gives the same results as the desktop app. |
| `js/player.js` | Playback through WebAudioFont GM sounds or Web MIDI |
| `js/app.js` | The application: list, trim panel, player bar, advanced settings, lyrics, playlists, undo, autosave |
| `js/ui.js` | Windows, message boxes, and tooltips |
| `js/i18n.js` | English / Srpski texts |

The instrument sounds come from [WebAudioFont](https://github.com/surikov/webaudiofont) and are downloaded the first time a song is played.

## Run locally

Open `index.html` in a browser, or serve the folder with any static server:

```
python -m http.server 8000
```
