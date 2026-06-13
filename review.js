const axios = require('axios');
const { getDiff } = require('./diff');

async function reviewPR(octokit, owner, repo, pull_number, strictness, commentStyle) {
  const diff = await getDiff(octokit, owner, repo, pull_number);
  
  const prompts = {
    claude: `Review the following code diff for security issues, performance problems, and best practices. Strictness: ${strictness}. Provide comments with line numbers.\n\n${diff}`,
    codex: `Review the following code diff for security issues, performance problems, and best practices. Strictness: ${strictness}. Provide comments with line numbers.\n\n${diff}`,
    gemini: `Review the following code diff for security issues, performance problems, and best practices. Strictness: ${strictness}. Provide comments with line numbers.\n\n${diff}`
  };
  
  const reviews = await Promise.all([
    callLLM('claude', prompts.claude, process.env.CLAUDE_API_KEY),
    callLLM('codex', prompts.codex, process.env.CODEX_API_KEY),
    callLLM('gemini', prompts.gemini, process.env.GEMINI_API_KEY)
  ]);
  
  return reviews.map((review, index) => formatReview(review, ['Claude', 'Codex', 'Gemini'][index], commentStyle));
}

async function callLLM(model, prompt, apiKey) {
  const urls = {
    claude: 'https://api.anthropic.com/v1/messages',
    codex: 'https://api.openai.com/v1/chat/completions',
    gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
  };
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  let data;
  if (model === 'claude') {
    headers['anthropic-version'] = '2023-06-01';
    data = {
      model: 'claude-3-opus-20240229',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    };
  } else if (model === 'codex') {
    data = {
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096
    };
  } else if (model === 'gemini') {
    delete headers.Authorization;
    headers['x-goog-api-key'] = apiKey;
    data = {
      contents: [{ parts: [{ text: prompt }] }]
    };
  }
  
  try {
    const response = await axios.post(urls[model], data, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error calling ${model}:`, error.message);
    return null;
  }
}

function formatReview(response, model, commentStyle) {
  let body = '';
  if (response) {
    if (model === 'Claude') {
      body = response.content[0].text;
    } else if (model === 'Codex') {
      body = response.choices[0].message.content;
    } else if (model === 'Gemini') {
      body = response.candidates[0].content.parts[0].text;
    }
  } else {
    body = 'No review provided due to API error.';
  }
  return {
    event: 'COMMENT',
    body: `### Review by ${model}\n\n${body}`
  };
}

module.exports = { reviewPR };
