const request = require('supertest');
const app = require('../../app');

describe('Bounty Creation Endpoint', () => {
  test('should create a bounty successfully', async () => {
    const response = await request(app)
      .post('/api/bounties')
      .send({
        title: 'Example Bounty',
        reward: 50000,
        labels: ['bounty', 'feature']
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
  
  test('should return error for missing title', async () => {
    const response = await request(app)
      .post('/api/bounties')
      .send({
        reward: 50000,
        labels: ['bounty', 'feature']
      });
    
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
  });
});
