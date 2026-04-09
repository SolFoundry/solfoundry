module.exports = {
  testEnvironment: 'jsdom',
  globals: { TextEncoder: require('util').TextEncoder, TextDecoder: require('util').TextDecoder },
  transformIgnorePatterns: ["/node_modules/(?!@babel)"],
  setupFilesAfterEnv: ['./setupTests.js'],
  extensionsToTreatAsEsm: ['.jsx'],
  transform: {
    "node_modules/?(?!@babel)": "babel-jest",
    '^.+\.(js|jsx)$': 'babel-jest',
  },
};