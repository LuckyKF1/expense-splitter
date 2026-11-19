// How a person is drawn: a coloured circle with one letter. Pure functions,
// so they are unit-tested in Node.

/** Number of avatar colours (style.css defines .tone-0 ... .tone-7). */
export const AVATAR_TONES = 8;

// Lao (U+0EC0-0EC4) and Thai (U+0E40-0E44) vowels written before the
// consonant they follow in speech: ແສງ is read from ສ.
const LEADING_VOWEL = /^[ເ-ໄเ-ไ]$/u;
const MARK = /\p{M}/gu;
const LETTER_OR_SYMBOL = /[\p{L}\p{N}\p{So}]/u;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** The one character shown in someone's circle. */
export function initial(name) {
  for (const { segment } of segmenter.segment(String(name))) {
    if (LEADING_VOWEL.test(segment)) continue;
    if (!LETTER_OR_SYMBOL.test(segment)) continue; // spaces, quotes, brackets
    if (/\p{So}/u.test(segment)) return segment; // emoji, kept whole
    return segment.replace(MARK, "").toLocaleUpperCase() || segment;
  }
  return "?";
}

/**
 * Colour index for a member. Member ids in a group are consecutive, so
 * id modulo the palette gives everyone in a group of up to 8 their own
 * colour, and a person keeps theirs on every screen and device.
 */
export function avatarTone(memberId) {
  return ((memberId % AVATAR_TONES) + AVATAR_TONES) % AVATAR_TONES;
}
