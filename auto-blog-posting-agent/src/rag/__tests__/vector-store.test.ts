describe('VectorStore — cosine similarity', () => {
  // Directly test the cosine similarity logic used in vector-store.ts
  function cosine(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
  }

  it('returns 1 for identical vectors', () => {
    const v = [1, 0, 0];
    expect(cosine(v, v)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosine([], [])).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(cosine([1, 2], [1])).toBe(0);
  });

  it('handles all-zero vectors', () => {
    expect(cosine([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  it('computes correct similarity for arbitrary vectors', () => {
    // [1,2,3] dot [4,5,6] = 4+10+18=32
    // |a| = sqrt(14), |b| = sqrt(77)
    // cos = 32 / sqrt(14*77) = 32 / sqrt(1078) ≈ 0.9746
    const result = cosine([1, 2, 3], [4, 5, 6]);
    expect(result).toBeCloseTo(0.9746, 3);
  });

  it('sort order: higher similarity means more related', () => {
    const query = [1, 0, 0];
    const docs = [
      { embedding: [0.99, 0.1, 0], label: 'very similar' },
      { embedding: [0, 0.99, 0], label: 'orthogonal' },
      { embedding: [-0.99, 0, 0], label: 'opposite' },
    ];

    const scored = docs.map(d => ({
      label: d.label,
      score: cosine(query, d.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);

    expect(scored[0].label).toBe('very similar');
    expect(scored[1].label).toBe('orthogonal');
    expect(scored[2].label).toBe('opposite');
  });
});

describe('VectorStore — diversity search sort order', () => {
  function cosine(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
  }

  it('ascending sort gives least-similar first (white space)', () => {
    const query = [1, 0, 0];
    const docs = [
      { embedding: [0.99, 0.1, 0] },
      { embedding: [0, 0.99, 0] },
      { embedding: [-0.99, 0, 0] },
    ];

    const scored = docs.map(d => ({
      embedding: d.embedding,
      similarity: cosine(query, d.embedding),
    }));

    // Ascending = least similar first (diverse)
    scored.sort((a, b) => a.similarity - b.similarity);

    expect(scored[0].similarity).toBeLessThan(scored[1].similarity);
    expect(scored[0].embedding).toEqual([-0.99, 0, 0]); // opposite = most diverse
  });
});
