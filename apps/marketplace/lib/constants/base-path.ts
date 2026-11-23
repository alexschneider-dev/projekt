export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "/marketplace";
export const withBasePath = (path: string) => `${BASE_PATH}${path}`;
