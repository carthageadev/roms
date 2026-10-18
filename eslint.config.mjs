import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Keep the starter on the flat config export that actually runs under the pinned ESLint/Next toolchain.
  ...nextCoreWebVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".cartridge-logic/**",
    ".kilo/**",
    "artifacts/**",
    // Three.js scene code mutates objects inside the R3F frame loop by design,
    // and the React Compiler rules do not model that. The Panoply modules are
    // copied verbatim, and the Draco decoder is third-party.
    "src/three/**",
    "src/lib/carouselPrefs.js",
    "public/draco/**",
  ]),
]);
