/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "./",
  roots: ["<rootDir>/src", "<rootDir>/test"],
  moduleFileExtensions: ["js", "json", "ts"],
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.test.ts",
    "<rootDir>/src/**/*.test.ts",
    "<rootDir>/test/**/*.e2e-spec.ts",
  ],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.json",
      },
    ],
  },
  // Workspace packages live as `@lolos/*` aliases backed by their `main`
  // (`src/index.ts`). ts-jest follows them via `paths` already, but for
  // packages without `paths` we pin them explicitly.
  moduleNameMapper: {
    "^@lolos/database$": "<rootDir>/../../packages/database/src/index.ts",
    "^@lolos/validators$": "<rootDir>/../../packages/validators/src/index.ts",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.module.ts",
    "!src/main.ts",
  ],
  coverageDirectory: "coverage",
};
