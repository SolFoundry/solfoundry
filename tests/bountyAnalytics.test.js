import { expect } from 'chai';
import request from 'supertest';
import app from '../backend/main.py'; // Update with the actual path to your express app

describe('Bounty Analytics Dashboard', () => {
  it('should get time-series data for bounty volume', async () => {
    const res = await request(app).get('/api/bounty/volume');
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
    // Additional checks can be made here for the structure of the data
  });

  it('should get payout distribution data', async () => {
    const res = await request(app).get('/api/bounty/payouts');
    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
    // Include more specific validations here
  });

  it('should get contributor growth metrics', async () => {
    const res = await request(app).get('/api/contributors/growth');
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('growthRate');
  });

  it('should export reports as CSV', async () => {
    const res = await request(app).get('/api/reports/export/csv');
    expect(res.status).to.equal(200);
    expect(res.header['content-type']).to.contain('text/csv');
  });

  it('should export reports as PDF', async () => {
    const res = await request(app).get('/api/reports/export/pdf');
    expect(res.status).to.equal(200);
    expect(res.header['content-type']).to.contain('application/pdf');
  });
});
