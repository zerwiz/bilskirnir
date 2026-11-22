# 2026-11-22 — Nanna knows her own computer, and the viewer has Mute

The Allfather, on a call from her computer view: *"Nanna doesn't know her own computer, and I need a mute button in the computer view."* Measured in the voice log: asked *"can you see your computer? you have your own computer"*, she answered that she could not, while her `send_task` worked a minute later.

- **The call's instructions** (`server/src/voice.ts`) gain *Your computer*: she has her own desktop and browser on the shared computer, he may be watching it live and seeing her mouse, she never says she has none; work on the screen goes through `send_task` (her hands do it there), and *what is on your screen* is answered with `peek_activity`.
- **Mute** in the viewer's voice controls, beside Pause and Stop: his microphone off and on (she keeps speaking and working); the state reads *you are muted*. Pause still silences both sides.

Typecheck passes.
