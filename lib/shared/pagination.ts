export function paginationPages(current: number, total: number): Array<number | "ellipsis"> {
  const visible = [...new Set([
    1,
    current - 1,
    current,
    current + 1,
    total,
  ])].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const page of visible) {
    if (page - previous > 1) result.push("ellipsis");
    result.push(page);
    previous = page;
  }
  return result;
}
