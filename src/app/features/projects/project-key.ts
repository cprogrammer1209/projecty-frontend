/** Same rule as the Work service (PRJ-BR-01): 2 to 10 capital letters or digits. */
export const KEY_PATTERN = /^[A-Z0-9]{2,10}$/;
export const KEY_CHECK_DELAY_MS = 350;

/** "Website Redesign" gives WR, "Mobile" gives MOBI; empty when too short to be a key. */
export function suggestKey(name: string): string {
  const words = name.match(/[A-Za-z0-9]+/g) ?? [];
  const key = (words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 5) : (words[0] ?? '').slice(0, 4)).toUpperCase();
  return key.length >= 2 ? key : '';
}
