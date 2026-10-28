const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'against',
  'from', 'into', 'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out',
  'off', 'over', 'under', 'again', 'further', 'once', 'here', 'there', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
  'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should',
  'now', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'it', 'its', 'they', 'them', 'their', 'this', 'that', 'these', 'those', 'am', 'have',
  'has', 'had', 'do', 'does', 'did', 'please', 'also', 'been', 'would', 'could',
]);

export function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

export function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

/**
 * Scores a candidate grievance against a new one using lexical overlap of
 * subject+description, boosted when they share a category and transport mode.
 */
export function duplicateScore(source, candidate) {
  const sourceTokens = tokenize(`${source.subject} ${source.description}`);
  const candidateTokens = tokenize(`${candidate.subject} ${candidate.description}`);
  let score = jaccard(sourceTokens, candidateTokens);
  if (candidate.category && source.category && candidate.category === source.category) score += 0.15;
  if (candidate.pnr && source.pnr && candidate.pnr === source.pnr) score += 0.2;
  if (candidate.trainNumber && source.trainNumber && candidate.trainNumber === source.trainNumber)
    score += 0.1;
  if (candidate.coach && source.coach && candidate.coach === source.coach) score += 0.05;
  return Math.min(1, Number(score.toFixed(4)));
}
