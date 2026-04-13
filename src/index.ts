import { BountyHunter } from './hunter.js';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  repos: [
    'SolFoundry/solfoundry',
    'midnightntwrk/contributor-hub',
    'layer5io/layer5',
  ],
  baseBranch: 'main',
  maxAttempts: 2,
  skipExisting: true,
};

const hunter = new BountyHunter(config);

process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down...');
  process.exit(0);
});

await hunter.hunt();
