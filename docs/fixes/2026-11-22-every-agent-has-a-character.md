# 2026-11-22 — every agent of the house has its own character

The Allfather, at *Seat a new agent*: *"we are missing a few icons here for all the agents we have."* The picker held the Ymir mark and fourteen beasts and treasures of the lore, and none of the house's agents.

Twenty-five agent characters added from game-icons.net (CC BY 3.0, credited in `THIRD_PARTY_NOTICES.md`), one for each figure on `.agents/agents/` plus Nanna: Sindri the anvil, Völundr the forging anvil, Brokk the bellows, Bragi the lyre, Forseti the scales, Móðguðr the stone bridge, Mímir the well, Muninn the feather, Kvasir the magnifying glass, Sága the scroll, Snotra the quill, Skírnir the envelope, Sýn the eye, Týr the fist, Víðarr the shield, Urðr the hourglass, Vör the stethoscope, Eir the healing, Gróa the sprout, Galdr the rune stone, Hnoss the jewel, Jörð the mountains, Frigg the spindle, Andhrímnir the cauldron, Nanna the flowers.

- `web/artwork/characters/*.svg` + the list in `web/scripts/gen-characters.mjs` → `characters.gen.ts` (39 characters);
- the server accepts them (`AvatarShape`, `HOUSE_CHARACTERS`);
- the picker lays out rows of five however many there are.

Typecheck and build pass; the 39 were drawn and looked at.
