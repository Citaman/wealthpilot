import type { NextConfig } from "next";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json") as { version?: string };

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version ?? "0.11.0",
  },
};

export default nextConfig;
