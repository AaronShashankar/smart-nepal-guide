"""Levenshtein edit distance, used to rank fuzzy search results (algorithm.md, Smart features).

Dynamic programming over two rows: O(len(a) * len(b)) time, O(len(b)) memory.
"""


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if len(a) < len(b):
        a, b = b, a  # keep the inner row short
    if not b:
        return len(a)
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        current = [i]
        for j, cb in enumerate(b, start=1):
            insert = current[j - 1] + 1
            delete = previous[j] + 1
            substitute = previous[j - 1] + (ca != cb)
            current.append(min(insert, delete, substitute))
        previous = current
    return previous[-1]


def normalise(text: str) -> str:
    """Lower-case and drop spaces/punctuation, so "Poon Hill" ~ "poonhill"."""
    return "".join(ch for ch in text.casefold() if ch.isalnum() or "ऀ" <= ch <= "ॿ")


WORD_MATCH_WEIGHT = 0.95  # a word-by-word match counts a little less than a whole-phrase match


def _ratio(a: str, b: str) -> float:
    return 1 - levenshtein(a, b) / max(len(a), len(b)) if a and b else 0.0


def word_similarity(query: str, candidate: str) -> float:
    """Word by word: each query word is compared with its best word in the candidate, and the
    scores are averaged (weighted by word length). Handles a skipped word:
    "chitwan nikunja" ~ "chitwan rashtriya nikunja"."""
    q_words = [w for w in (normalise(x) for x in query.split()) if w]
    c_words = [w for w in (normalise(x) for x in candidate.split()) if w]
    if not q_words or not c_words:
        return 0.0
    total = sum(len(w) for w in q_words)
    return sum(len(w) * max(_ratio(w, c) for c in c_words) for w in q_words) / total


def similarity(query: str, candidate: str) -> float:
    """1.0 = identical, 0.0 = nothing in common.

    The query is also compared with every run of words in the candidate of
    roughly the same length, so "anapurna" matches "Annapurna Base Camp" well.
    A query of two or more words is also matched word by word (word_similarity).
    """
    q = normalise(query)
    if not q:
        return 0.0
    words = candidate.split()
    pieces = {normalise(candidate)}
    for start in range(len(words)):
        for end in range(start + 1, len(words) + 1):
            pieces.add(normalise(" ".join(words[start:end])))
    best = 0.0
    for piece in pieces:
        if not piece:
            continue
        score = 1 - levenshtein(q, piece) / max(len(q), len(piece))
        best = max(best, score)
    if len(query.split()) > 1:
        best = max(best, WORD_MATCH_WEIGHT * word_similarity(query, candidate))
    return best
