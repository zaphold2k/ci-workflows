export function greet(name) {
  // eslint-disable-next-line no-console -- deliberate fixture suppression, exercised by the ratchet's suppression count
  console.log(`Hello, ${name}!`);
  return `Hello, ${name}!`;
}

export function add(a, b) {
  return a + b;
}
