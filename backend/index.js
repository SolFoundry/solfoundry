const express = require('express');
const bodyParser = require('body-parser');
const bountyRoutes = require('./routes/bounties');

const app = express();

// Middleware
app.use(bodyParser.json());
// Set up routes
app.use('/api', bountyRoutes);

// Start the server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} else {
  console.log('App is running in test mode.');
}

module.exports = app;