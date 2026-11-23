export const BASE_PATH = "/stellensuche";
export const withBasePath = (path: string) => path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)
  ? path
  : `${BASE_PATH}${path}`;
