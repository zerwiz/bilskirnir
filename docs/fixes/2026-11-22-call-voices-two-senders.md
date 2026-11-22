# 2026-11-22 — a call's two voices are two senders in the chat

The Allfather: *"all chat from me and Nanna comes in as Nanna's chat in the chat UI."* Measured in the store: the call's lines are written correctly (his with `role: user`, hers with `role: assistant`, both `from: voice`). The fault was in `Transcript.tsx`: a group's sender key was only `from.kind:from.id`, the same call id for both voices, so every line of a call fell into one group on the side of its first line. The key now includes the role, so his lines stand on his side (*Asked on a voice call*) and hers on hers.

Typecheck passes.
