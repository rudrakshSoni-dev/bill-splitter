// members must already be in the order they joined the home.
// the first (total % n) of them pay one extra cent, so 1000 / 3 -> 334, 333, 333
export function splitCents(total: number, people: number): number[] {
  const base = Math.floor(total / people)
  const extra = total % people
  return Array.from({ length: people }, (_, i) => (i < extra ? base + 1 : base))
}
