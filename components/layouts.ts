
// Real Manhwa Layouts based on "Datos-Manwha" dataset analysis.
// 0 = Empty/Spacer (if needed)
// Numbers indicate SubPanel IDs.

export const layouts: Record<string, number[][]> = {
  // Standard Vertical Panel (The default unit for Webtoon)
  '1': [[1]], 
  
  // Ultra Tall (Scrolling shots, towers, falls)
  '1-ultra-tall': [[1], [1], [1]], // 1:3 ratio
  
  // Splits
  '2v': [[1], [2]], // Standard vertical split (Dialogue ping-pong)
  '2v-action': [[1], [1], [2]], // Top heavy (Establishment -> Reaction)
  '2v-reaction': [[1], [2], [2]], // Bottom heavy (Action -> Consequence)
  
  // Horizontal / Wide (Desktop view / Splash)
  '2h': [[1, 2]], 
  
  // Dynamic / Action (Datos-Manwha Specials)
  'slash-diag': [[1, 1, 2], [1, 2, 2]], // Simulated diagonal cut (Speed)
  'action-impact': [[1, 1], [2, 2], [3, 3]], // 3-hit combo sequence
  'reaction-inset': [[1, 1], [1, 2]], // 2 is an inset reaction over 1 (Picture-in-Picture)
  'establish-split': [[1], [1], [2, 3]], // Establishing shot -> detail split
  'complex-5': [[1, 1], [2, 3], [4, 5]], // Chaotic scene / Montage
  'chaos-grid': [[1, 2], [3, 4]], // 2x2 fast paced (Panic/Confusion)
  '3v': [[1], [2], [3]], // Simple 3 vertical sequence
};
