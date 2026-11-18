export function normalizeJobUrl(value: string): string | null;

export function parseSearchPage(html: string, expectedPage: number): {
  urls: string[];
  totalPages: number;
  total: number;
};
