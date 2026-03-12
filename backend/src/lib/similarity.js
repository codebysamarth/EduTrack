/**
 * TF-IDF + Cosine Similarity for project uniqueness checking.
 * Compares a new project's text (title + abstract + domain) against all existing projects.
 */

// ─── Tokenize & normalize ─────────────────────────────
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'some', 'them',
  'than', 'its', 'over', 'such', 'that', 'this', 'with', 'will', 'each',
  'from', 'they', 'were', 'which', 'their', 'said', 'what', 'about',
  'would', 'make', 'like', 'into', 'could', 'time', 'very', 'when',
  'come', 'made', 'find', 'more', 'also', 'then', 'just', 'only',
  'using', 'based', 'system', 'project', 'use', 'used', 'application',
]);

// ─── Term Frequency (TF) ──────────────────────────────
function computeTF(tokens) {
  const freq = {};
  for (const t of tokens) {
    freq[t] = (freq[t] || 0) + 1;
  }
  const max = Math.max(...Object.values(freq), 1);
  const tf = {};
  for (const [term, count] of Object.entries(freq)) {
    tf[term] = count / max; // normalized TF
  }
  return tf;
}

// ─── Inverse Document Frequency (IDF) ──────────────────
function computeIDF(allDocs) {
  const N = allDocs.length;
  const docFreq = {};
  for (const doc of allDocs) {
    const seen = new Set(doc);
    for (const term of seen) {
      docFreq[term] = (docFreq[term] || 0) + 1;
    }
  }
  const idf = {};
  for (const [term, df] of Object.entries(docFreq)) {
    idf[term] = Math.log((N + 1) / (df + 1)) + 1; // smoothed IDF
  }
  return idf;
}

// ─── TF-IDF Vector ─────────────────────────────────────
function computeTFIDF(tf, idf) {
  const vec = {};
  for (const [term, tfVal] of Object.entries(tf)) {
    vec[term] = tfVal * (idf[term] || 1);
  }
  return vec;
}

// ─── Cosine Similarity ─────────────────────────────────
function cosineSimilarity(vecA, vecB) {
  const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (const term of allTerms) {
    const a = vecA[term] || 0;
    const b = vecB[term] || 0;
    dotProduct += a * b;
    magA += a * a;
    magB += b * b;
  }

  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ─── Main: check uniqueness ────────────────────────────
/**
 * Compare a new project against all existing projects.
 * @param {Object} newProject - { title, abstract, domain }
 * @param {Array} existingProjects - [{ id, title, abstract, domain, groupName }]
 * @param {number} threshold - similarity threshold (0-1), default 0.55
 * @returns {{ isUnique: boolean, similarProjects: Array }}
 */
function checkProjectUniqueness(newProject, existingProjects, threshold = 0.55) {
  if (existingProjects.length === 0) return { isUnique: true, similarProjects: [] };

  const newText = [newProject.title, newProject.abstract || '', newProject.domain || ''].join(' ');
  const newTokens = tokenize(newText);

  if (newTokens.length === 0) return { isUnique: true, similarProjects: [] };

  // Separate tokenization for per-field similarity
  const newTitleTokens = tokenize(newProject.title || '');
  const newAbstractTokens = tokenize(newProject.abstract || '');

  // Tokenize all existing projects
  const existingTexts = existingProjects.map((p) => ({
    ...p,
    tokens: tokenize([p.title, p.abstract || '', p.domain || ''].join(' ')),
    titleTokens: tokenize(p.title || ''),
    abstractTokens: tokenize(p.abstract || ''),
  }));

  // Build IDF from all documents (including the new one)
  const allDocs = [newTokens, ...existingTexts.map((e) => e.tokens)];
  const idf = computeIDF(allDocs);

  // Compute TF-IDF for new project (overall)
  const newTF = computeTF(newTokens);
  const newVec = computeTFIDF(newTF, idf);

  // Compare against each existing project
  const similarProjects = [];
  for (const existing of existingTexts) {
    if (existing.tokens.length === 0) continue;
    const existTF = computeTF(existing.tokens);
    const existVec = computeTFIDF(existTF, idf);
    const similarity = cosineSimilarity(newVec, existVec);

    if (similarity >= threshold) {
      // Per-field similarity breakdown
      let titleSimilarity = 0;
      if (newTitleTokens.length > 0 && existing.titleTokens.length > 0) {
        const tIdf = computeIDF([newTitleTokens, existing.titleTokens]);
        titleSimilarity = cosineSimilarity(
          computeTFIDF(computeTF(newTitleTokens), tIdf),
          computeTFIDF(computeTF(existing.titleTokens), tIdf)
        );
      }

      let abstractSimilarity = 0;
      if (newAbstractTokens.length > 0 && existing.abstractTokens.length > 0) {
        const aIdf = computeIDF([newAbstractTokens, existing.abstractTokens]);
        abstractSimilarity = cosineSimilarity(
          computeTFIDF(computeTF(newAbstractTokens), aIdf),
          computeTFIDF(computeTF(existing.abstractTokens), aIdf)
        );
      }

      // Find common important terms (top TF-IDF terms shared between both)
      const commonTerms = [];
      for (const term of Object.keys(newVec)) {
        if (existVec[term] && newVec[term] > 0.1) {
          commonTerms.push(term);
        }
      }
      commonTerms.sort((a, b) => (newVec[b] + (existVec[b] || 0)) - (newVec[a] + (existVec[a] || 0)));

      similarProjects.push({
        id: existing.id,
        title: existing.title,
        abstract: existing.abstract || '',
        domain: existing.domain,
        groupName: existing.groupName,
        similarity: Math.round(similarity * 100),
        titleSimilarity: Math.round(titleSimilarity * 100),
        abstractSimilarity: Math.round(abstractSimilarity * 100),
        commonTerms: commonTerms.slice(0, 8),
      });
    }
  }

  // Sort by similarity descending
  similarProjects.sort((a, b) => b.similarity - a.similarity);

  return {
    isUnique: similarProjects.length === 0,
    similarProjects: similarProjects.slice(0, 5), // top 5 similar
  };
}

module.exports = { checkProjectUniqueness };
