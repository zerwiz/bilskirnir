import type { AvatarColor, AvatarShape } from '@shared/types';
import { BotAvatar, PICKER_CHARACTERS } from './BotAvatar';

/** The house's characters, in rows of five (plan 275, 2026-11-13; the agents added 2026-11-22). Its colour shows as the ring. */
export function CharacterPicker({ shape, color, onShape, size = 40 }: { shape: AvatarShape; color: AvatarColor; onShape: (s: AvatarShape) => void; size?: number }) {
  // rows of five, however many characters the house has (the agents joined the beasts, 2026-11-22)
  const rows = Array.from({ length: Math.ceil(PICKER_CHARACTERS.length / 5) }, (_, i) => PICKER_CHARACTERS.slice(i * 5, i * 5 + 5));
  return (
    <div className="shape-grid" role="radiogroup" aria-label="The agent's character">
      {rows.map((row, i) => (
        <div key={i} className="shape-grid__row">
          {row.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={shape === c.id} aria-label={c.name} title={c.name}
              className="shape-cell" onClick={() => onShape(c.id)}>
              <BotAvatar shape={c.id} color={color} size={size} ring={shape === c.id} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
