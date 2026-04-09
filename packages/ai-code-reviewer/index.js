const { Probot } = require('probot');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = (app) => {
  app.on(['pull_request.opened', 'pull_request.synchronize'], async (context) => {
    const { pull_request: pr } = context.payload;
    
    // Get changed files
    const files = await context.octokit.pulls.listFiles({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      pull_number: pr.number
    });
    
    // Review each file
    for (const file of files.data) {
      if (!file.patch || file.status === 'removed') continue;
      
      const review = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{
          role: 'system',
          content: 'You are a code reviewer. Analyze the code changes and provide constructive feedback.'
        }, {
          role: 'user',
          content: `Review this code diff:\n\n${file.patch}`
        }]
      });
      
      // Post review comment
      await context.octokit.pulls.createReviewComment({
        owner: pr.base.repo.owner.login,
        repo: pr.base.repo.name,
        pull_number: pr.number,
        commit_id: pr.head.sha,
        path: file.filename,
        body: `🤖 **AI Review**\n\n${review.choices[0].message.content}\n\n---\n*This is an automated review by SolFoundry AI Code Reviewer*`
      });
    }
    
    // Add summary comment
    await context.octokit.issues.createComment({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      issue_number: pr.number,
      body: `## 🤖 AI Code Review Complete\n\nReviewed ${files.data.length} files. Check inline comments for detailed feedback.`
    });
  });
};
