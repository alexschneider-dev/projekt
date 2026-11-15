export function setOrDelete(params: URLSearchParams, key: string, value?: string) {
  params.delete(key);
  if (value) params.set(key, value);
}

export function createPageQueryString(current: string, page: number) {
  const params = new URLSearchParams(current);
  setOrDelete(params, "page", page > 1 ? String(page) : undefined);
  return params.toString();
}

export function createQueryHref(pathname: string, query: string) {
  return query ? `${pathname}?${query}` : pathname;
}

export function createJobsQueryString(current: string, page: number, isMarkiert?: boolean) {
  const params = new URLSearchParams(createPageQueryString(current, page));
  setOrDelete(params, "isMarkiert", isMarkiert === undefined ? undefined : String(isMarkiert));
  return params.toString();
}
