import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // eslint-plugin-react's version "detect" calls context.getFilename(),
  // removed in ESLint 10 → every react/* rule crashed. Pinning the version
  // skips detection entirely; bump alongside React majors.
  { settings: { react: { version: "19.2" } } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build output (vinext) + vendored stubs — not our source to lint.
    "dist/**",
    "vite-stubs/**",
    // Generated bundles + oracle dumps + one-off research spikes — artifacts,
    // not source. (engine/golden holds superdough-oracle harnesses whose
    // bundled dumps run to tens of thousands of lines.)
    "engine/golden/**",
    "lib/vendor/**",
  ]),
  // The React-compiler-era hook rules (refs/purity/set-state-in-effect/
  // immutability) flag ~70 sites that are DELIBERATE here: this app hosts a
  // real-time audio engine in the browser, and the imperative ref/effect work
  // those rules dislike is how the music stays glitch-free. They stay visible
  // as warnings — genuine mistakes still surface — but they don't fail the
  // build. rules-of-hooks (real bugs) remains an error.
  {
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      // an `_`-prefixed parameter is a deliberate "this arg exists for the
      // signature, not for me" — the TS convention the default rule ignores
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
