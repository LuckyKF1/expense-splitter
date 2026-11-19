import { test } from "node:test";
import assert from "node:assert/strict";

import { AVATAR_TONES, avatarTone, initial } from "../../frontend/js/people.js";

test("initial is the first letter, upper-cased for Latin names", () => {
  assert.equal(initial("luck"), "L");
  assert.equal(initial("Fy"), "F");
  assert.equal(initial("  saeng "), "S");
});

test("Lao initial skips a leading vowel and drops tone marks", () => {
  // ແສງ is written vowel-first but read from the consonant ສ.
  assert.equal(initial("ແສງ"), "ສ");
  assert.equal(initial("ໄຊ"), "ຊ");
  assert.equal(initial("ໂນ"), "ນ");
  // ນ້ອຍ: the circle shows ນ, not ນ with a floating tone mark.
  assert.equal(initial("ນ້ອຍ"), "ນ");
  assert.equal(initial("ບຸນມີ"), "ບ");
});

test("Thai names get the same treatment", () => {
  assert.equal(initial("เก่ง"), "ก");
  assert.equal(initial("น้อย"), "น");
});

test("an emoji or symbol at the start is used as is", () => {
  assert.equal(initial("🍜 Noy"), "🍜");
  assert.equal(initial("👨‍👩‍👧 family"), "👨‍👩‍👧");
});

test("punctuation and quotes are skipped", () => {
  assert.equal(initial('"Kham"'), "K");
  assert.equal(initial("(ລາ)"), "ລ");
});

test("a name with nothing usable falls back to a question mark", () => {
  assert.equal(initial(""), "?");
  assert.equal(initial("..."), "?");
});

test("avatar tones are stable and the first members of a group all differ", () => {
  assert.equal(avatarTone(13), avatarTone(13));
  const tones = new Set([101, 102, 103, 104, 105, 106, 107, 108].map(avatarTone));
  assert.equal(tones.size, AVATAR_TONES);
  for (const id of [1, 7, 8, 9999]) {
    const tone = avatarTone(id);
    assert.ok(Number.isInteger(tone) && tone >= 0 && tone < AVATAR_TONES, String(tone));
  }
});
