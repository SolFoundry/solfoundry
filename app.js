const { App } = require('@octokit/app');
const { createNodeMiddleware } = require('@octokit/webhooks');
const { reviewPR } = require('./review');

const app = new App({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY,
  webhooks: {
    secret: process.env.WEBHOOK_SECRET
  }
});

app.webhooks.on('pull_request.opened', async ({ octokit, payload }) => {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pull_number = payload.pull_request.number;
  
  const config = await getConfig(octokit, owner, repo);
  const { strictness, commentStyle } = config;
  
  const reviews = await reviewPR(octokit, owner, repo, pull_number, strictness, commentStyle);
  
  for (const review of reviews) {
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number,
      ...review
    });
  }
});

app.webhooks.on('pull_request.synchronize', async ({ octokit, payload }) => {
  // Same as opened
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const pull_number = payload.pull_request.number;
  
  const config = await getConfig(octokit, owner, repo);
  const { strictness, commentStyle } = config;
  
  const reviews = await reviewPR(octokit, owner, repo, pull_number, strictness, commentStyle);
  
  for (const review of reviews) {
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number,
      ...review
    });
  }
});

async function getConfig(octokit, owner, repo) {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: '.github/ai-code-review.yml'
    });
    const content = Buffer.from(data.content, 'base64').toString();
    const yaml = require('js-yaml');
    return yaml.load(content);
  } catch (e) {
    return { strictness: 'medium', commentStyle: 'separate' };
  }
}

module.exports = app;
