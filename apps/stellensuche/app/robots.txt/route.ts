import { HTTP_STATUS } from "@/lib/http/status";


export async function GET() {
  const robotsTxt = `
  User-agent: *
  Disallow: /
  `.trim();

  return new Response(robotsTxt, {
    status: HTTP_STATUS.OK,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export const dynamic = "force-static";
