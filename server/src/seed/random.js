/**
 * A small seeded random generator (mulberry32), so every `npm run seed`
 * produces the same people, numbers and bookings.
 */
export function createRandom(seed = 20_261_104) {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const pick = (items) => items[Math.floor(next() * items.length)];
  const chance = (probability) => next() < probability;

  /** `weights` like `{ portal: 35, website: 15 }`. */
  const weighted = (weights) => {
    const entries = Object.entries(weights);
    let roll = next() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return entries.at(-1)[0];
  };

  return { next, int, pick, chance, weighted };
}
