// Preserve the established cloud layout, but never reuse a position when a
// category grows: coincident terms would shrink the entire cloud to 10%.
export const cloudPosition = (index, total, categoryId) => {
  let x, y;
  if (total > 11) {
    const rows = Math.ceil(total / 3);
    x = [22, 53, 80][index % 3];
    y = 15 + Math.floor(index / 3) * 70 / (rows - 1);
  } else {
    const spots = categoryId === "fundamentals"
      ? [[18,17],[53,15],[84,18],[18,43],[53,40],[84,44],[18,69],[53,67],[84,70],[36,89],[69,89]]
      : [[22,17],[53,15],[80,18],[22,43],[53,40],[80,44],[22,69],[53,67],[80,70],[36,89],[69,89]];
    [x, y] = spots[index];
  }
  return { x: `${x.toFixed(2)}%`, y: `${y.toFixed(2)}%` };
};
