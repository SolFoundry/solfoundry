const express = require('express');
const router = express.Router();
// Simulated database for bounties
const bountiesDB = [];

// Endpoint to create a bounty
router.post('/bounties', (req, res) => {
  const { title, reward, labels } = req.body;

  // Validate input
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  if (!reward) {
    return res.status(400).json({ error: 'Reward amount is required' });
  }

  // Simulate the bounty creation
  const bounty = { id: bountiesDB.length + 1, title, reward, labels };
  bountiesDB.push(bounty);
  
  return res.status(201).json(bounty);
});

module.exports = router;
