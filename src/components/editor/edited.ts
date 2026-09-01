/**
 * Which keys sit somewhere other than where the baseline put them.
 *
 * Generic over any plain record, and the caller hands in the keys to weigh —
 * so the same one answer can drive the reset beside a control, the dot on a
 * folded section, and the header's edited chip. One comparison, so the three
 * can never disagree with each other.
 */
export function editedKeys<T extends object>(
  params: T,
  baseline: T,
  keys: readonly (keyof T)[],
): (keyof T)[] {
  return keys.filter((key) => params[key] !== baseline[key]);
}
