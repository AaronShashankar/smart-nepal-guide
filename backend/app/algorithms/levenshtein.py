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


def similarity(query: str, candidate: str) -> float:
    """1.0 = identical, 0.0 = nothing in common.

    The query is also compared with every run of words in the candidate of
    roughly the same length, so "anapurna" matches "Annapurna Base Camp" well.
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
    return best
