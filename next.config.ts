import type { NextConfig } from "next"


const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_TEST_BUILD === "true" ? ".next-test" : ".next",
}

export default nextConfig