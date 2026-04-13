# Audio Fixtures

Place audio sample files here for playground upload tests.

## Expected file

- **`sample.mp3`** — used by `TC_USE_04` (Playground upload + transcription test)

## Requirements

- Format: `.mp3`, `.wav`, `.m4a`, `.flac`, or `.ogg`
- Duration: short (5–15 seconds recommended) to keep test runtime low
- Content: any spoken English audio — the test verifies transcription output appears, not specific text

## Used by

- [tests/usage.spec.ts](../../tests/usage.spec.ts) → `TC_USE_04`
- [pages/UsagePage.ts](../../pages/UsagePage.ts) → `runCustomerSupportAnalysis()`
