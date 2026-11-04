export function formatRussianCount(value, forms) {
  const count = Math.max(0, Math.trunc(Number(value) || 0));
  const lastTwo = count % 100;
  const last = count % 10;
  const form = lastTwo >= 11 && lastTwo <= 14 ? forms[2] : last === 1 ? forms[0] : last >= 2 && last <= 4 ? forms[1] : forms[2];
  return `${count} ${form}`;
}
