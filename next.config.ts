import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La base local (PGlite) y el driver de Postgres se cargan tal cual, sin empaquetar.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
