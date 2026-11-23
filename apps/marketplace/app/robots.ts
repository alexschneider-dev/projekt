import type { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  // Crawling zulassen, damit Suchmaschinen noindex in HTML und HTTP-Headern lesen können.
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
  };
}
