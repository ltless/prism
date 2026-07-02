export function cosineSimilarity(vecA: ArrayLike<number>, vecB: ArrayLike<number>): number {
 let dot = 0, mA = 0, mB = 0;
 for (let i = 0; i < vecA.length; i++) {
 dot += vecA[i] * vecB[i];
 mA += vecA[i] * vecA[i];
 mB += vecB[i] * vecB[i];
 }
 mA = Math.sqrt(mA);
 mB = Math.sqrt(mB);
 return mA === 0 || mB === 0 ? 0 : dot / (mA * mB);
}
