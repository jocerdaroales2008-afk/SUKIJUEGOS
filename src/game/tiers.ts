export interface Tier {
  radius: number;
  color: string;
  shade: string;
  glow: string;
  points: number;
  label: string;
}

// 11 tiers, smallest to largest. Colors flow red -> orange -> yellow -> green -> teal -> blue.
export const TIERS: Tier[] = [
  { radius: 16, color: '#ff6b6b', shade: '#e03838', glow: '#ff9e9e', points: 1, label: 'Cherry' },
  { radius: 22, color: '#ff924c', shade: '#e0641a', glow: '#ffb37a', points: 3, label: 'Strawberry' },
  { radius: 30, color: '#ffc94c', shade: '#e09b1a', glow: '#ffe08a', points: 6, label: 'Grape' },
  { radius: 38, color: '#ffe066', shade: '#e0c01a', glow: '#fff0a8', points: 10, label: 'Lemon' },
  { radius: 48, color: '#b8e055', shade: '#7fae2a', glow: '#d6f08a', points: 15, label: 'Lime' },
  { radius: 58, color: '#5fd07a', shade: '#2f9e4a', glow: '#9ce8b0', points: 21, label: 'Apple' },
  { radius: 70, color: '#34d0c0', shade: '#159e92', glow: '#7be6dc', points: 28, label: 'Melon' },
  { radius: 82, color: '#3bb0e8', shade: '#1a7fb8', glow: '#86d3f4', points: 36, label: 'Mango' },
  { radius: 96, color: '#4f7cf5', shade: '#2a52c0', glow: '#92aaf9', points: 45, label: 'Peach' },
  { radius: 110, color: '#7b5cf5', shade: '#5230c0', glow: '#a992f9', points: 55, label: 'Pineapple' },
  { radius: 128, color: '#f5a3d0', shade: '#c060a0', glow: '#f9c5e3', points: 66, label: 'Watermelon' },
];

export const MAX_TIER = TIERS.length - 1;
export const SPAWNABLE_TIERS = 5; // tiers 0..4 can spawn randomly
