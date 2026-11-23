"""Devanagari -> Latin letters, the way Nepali names are usually typed (written by hand).

Why: many people type Nepali words with English letters ("pashupati mandir", "phewa tal"), and
some type a place in Devanagari that we only know in English. Search turns Nepali names and
Nepali queries into Latin letters with this function and compares those too.

How:
1. Split each word into syllables. A consonant carries the inherent vowel "a" (क = "ka"); a vowel
   sign replaces it (कि = "ki"); the virama ् removes it, joining the consonant to the next one
   (क्त = "kt"); an independent vowel stands alone (आ = "a").
2. Schwa deletion: Nepali does not say every inherent "a", so some are dropped:
   - at the end of a word (नगरकोट -> "nagarkot"), except after a consonant cluster
     (क्षेत्र -> "kshetra", अन्नपूर्ण -> "annapurna") and in one-syllable words;
   - inside a word, in the pattern vowel + C(a) + C + vowel, scanning from the right
     (दरबार -> "darbar", तेङबोचे -> "tengboche", सगरमाथा -> "sagarmatha").
   This is the usual Hindi/Nepali rule of thumb. It is wrong for some compound words
   (पशुपति -> "pashupti"), which is fine here: search compares with Levenshtein distance,
   which forgives a letter or two, and the English name is always searched as well.
3. Anusvara ं and chandrabindu ँ give "n", visarga ः "h", Devanagari digits 0-9.

Spelling is kept simple on purpose (no accents; long and short vowels are the same letter).
Text that is not Devanagari passes through unchanged (only lower-cased).
"""

import re
from dataclasses import dataclass

CONSONANTS = {
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "ng",
    "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "ny",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
    "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
    "य": "y", "र": "r", "ल": "l", "व": "w",
    "श": "sh", "ष": "sh", "स": "s", "ह": "h",
}  # fmt: skip
# Before another consonant, ङ and ञ are just the nasal: ढुङ्गा -> "dhunga", पञ्च -> "panch".
CLUSTER_NASALS = {"ङ": "n", "ञ": "n"}
INDEPENDENT_VOWELS = {
    "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "ri",
    "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
}  # fmt: skip
VOWEL_SIGNS = {
    "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri",
    "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
}  # fmt: skip
VIRAMA = "्"
NUKTA = "़"
ENDINGS = {"ं": "n", "ँ": "n", "ः": "h"}  # added to the syllable before them
OTHER = {"ॐ": "om", "।": ".", "॥": "."} | {chr(0x0966 + i): str(i) for i in range(10)}
SPECIAL = {"ज्ञ": "gy"}  # ज्ञान -> "gyan"
DEVANAGARI_RUN = re.compile(r"[ऀ-ॿ]+")


@dataclass
class Syllable:
    consonant: str = ""  # Latin letters of the consonant ("" for an independent vowel)
    vowel: str = ""  # "" = no vowel (virama, or a deleted schwa)
    inherent: bool = False  # the vowel is the inherent "a" (so it may be deleted)
    end: str = ""  # anusvara / chandrabindu / visarga

    def text(self) -> str:
        return self.consonant + self.vowel + self.end


def is_devanagari(text: str) -> bool:
    return DEVANAGARI_RUN.search(text) is not None


def _syllables(word: str) -> list[Syllable]:
    out: list[Syllable] = []
    i = 0
    while i < len(word):
        ch = word[i]
        special = next((k for k in SPECIAL if word.startswith(k, i)), None)
        if special:
            out.append(Syllable(SPECIAL[special], "a", inherent=True))
            i += len(special)
            continue
        if ch in CONSONANTS:
            joined = word[i + 1 : i + 2] == VIRAMA and word[i + 2 : i + 3] in CONSONANTS
            letters = CLUSTER_NASALS.get(ch, CONSONANTS[ch]) if joined else CONSONANTS[ch]
            out.append(Syllable(letters, "a", inherent=True))
        elif ch in VOWEL_SIGNS and out and out[-1].consonant:
            out[-1].vowel, out[-1].inherent = VOWEL_SIGNS[ch], False
        elif ch == VIRAMA and out:
            out[-1].vowel, out[-1].inherent = "", False
        elif ch in INDEPENDENT_VOWELS:
            out.append(Syllable("", INDEPENDENT_VOWELS[ch]))
        elif ch in ENDINGS and out:
            out[-1].end += ENDINGS[ch]
        elif ch in OTHER:
            out.append(Syllable(OTHER[ch]))
        elif ch != NUKTA:
            out.append(Syllable(ch))
        i += 1
    return out


def _delete_schwas(s: list[Syllable]) -> None:
    n = len(s)
    if n < 2:
        return
    last = s[-1]
    after_cluster = s[-2].consonant and not s[-2].vowel  # क्षेत्र, अन्नपूर्ण
    after_i = last.consonant == "y" and s[-2].vowel == "i"  # राष्ट्रिय
    if last.inherent and not last.end and not after_cluster and not after_i:
        last.vowel, last.inherent = "", False
    # vowel + C(a) + C + vowel  ->  delete that "a"; right to left; never the first syllable
    for k in range(n - 2, 0, -1):
        cur, prev, nxt = s[k], s[k - 1], s[k + 1]
        if (
            cur.inherent
            and not cur.end
            and prev.vowel
            and nxt.consonant
            and nxt.vowel
            and cur.consonant
        ):
            cur.vowel, cur.inherent = "", False


def _word(word: str) -> str:
    syllables = _syllables(word)
    _delete_schwas(syllables)
    return "".join(s.text() for s in syllables)


def to_latin(text: str) -> str:
    """'पशुपतिनाथ मन्दिर' -> 'pashuptinath mandir'. Latin text is only lower-cased."""
    return DEVANAGARI_RUN.sub(lambda m: _word(m.group()), text).lower()
