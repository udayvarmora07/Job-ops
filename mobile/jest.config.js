module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/__tests__/**/*.test.tsx"],
  // The first test in each suite pays the cold-start cost of transforming the
  // full RN + Expo module graph inside render(), which can exceed the 5s default.
  testTimeout: 20000,
};
