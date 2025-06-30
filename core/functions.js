export const functions = {
  log: (msg) => console.log("[JS]", msg),
  sum: (a, b) => Number(a) + Number(b),
  now: () => Date.now(),
};