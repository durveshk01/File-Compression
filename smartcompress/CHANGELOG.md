# Changes

## 1.1.2

- Apply modern Android system-bar insets at the activity root so the WebView stays fully within the usable screen.

## 1.1.1

- Restore UTF-8 punctuation and action labels damaged during publication.
- Add a rendered-text regression check for the encoding issue.
- Keep Android page content clear of status/navigation bars and use readable system icons.

## 1.1.0

- Reject timed-out archives instead of returning partial contents; preserve EPUB
  and OpenDocument mimetype requirements, member bytes and archive comments.
- Enforce image and animation limits, retain multipage TIFFs, report exact targets
  honestly and keep originals when re-encoding would produce a larger file.
- Preserve per-file settings and handle cancellation, retries and duplicate names.
- Add automatic sizing, batch presets, savings summaries and CSV reports.
- Protect active jobs during cleanup; make completed results independent of uploads.
- Validate entire ZIP batches and give duplicate output filenames distinct names.
- Drain and stop FFmpeg processes safely on timeout or cancellation.
- Make API documentation assets usable without relaxing the main app's policy.
- Add a Windows launcher, locked browser dependencies and a verified Gradle wrapper.
- Add Android document-picker downloads for authenticated files, ZIP batches and CSV.
- Add Android launcher artwork and explicit backup/transfer exclusions.

The Android release artifact is a debug-signed preview APK, matching the existing
project's distribution format. It uses the configured HTTPS backend and does not
perform offline compression. Temporary server files can expire on free-instance
sleep or restart; download completed results promptly.
