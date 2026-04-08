module.exports = {
  preset: "ts-jest", // Use ts-jest preset for TypeScript
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "js", "json", "node"], // Resolve relevant file types
  testPathIgnorePatterns: ["/node_modules/", "/dist/"], // Ignore test files in node_modules
};
