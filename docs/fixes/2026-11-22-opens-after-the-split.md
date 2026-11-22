# 2026-11-22 — Bilskirnir opens again after the split

Opening Bilskirnir on the desk failed three ways, all from the split (the app now lives in `~/.local/share/ymir-apps/bilskirnir/` with a `current` link to a release):

1. **No window: *"no electron binary"*.** `resolve_electron` took the Ymir tree as two levels above the app, which was true inside Ymir and is false now. It now asks `YMIR_RUNTIME_DIR`, then `~/ymir-runtime`, then the old guess.
2. **Its own server called a STRANGER.** The app path is the `current` link; the running server's working directory is the real release path, so `is_ours` never matched. It now compares the real path too, and an earlier release of the same install is ours.
3. **An old gateway called a STRANGER.** A sibling tree is now recognised under `ymir-apps/bilskirnir/` as well as the old `apps/bilskirnir/`.

Measured on the desk: the resolver returns the runtime's Electron; the window opened.
