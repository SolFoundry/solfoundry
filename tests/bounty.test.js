const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

// Load the configuration file
const configPath = path.resolve(__dirname, '../config/bountyConfig.yaml');

describe('YAML Configuration Tests', () => {
  let config;
  
  beforeAll(() => {
    const file = fs.readFileSync(configPath, 'utf8');
    config = YAML.parse(file);
  });
  
  test('should load configurations', () => {
    expect(config).toBeDefined();
  });
  
  test('should have reward tiers defined', () => {
    expect(config.rewardTiers).toBeDefined();
  });
  
  test('should have label detection settings', () => {
    expect(config.labelDetection).toBeDefined();
  });
});
