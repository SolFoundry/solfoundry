async function getDiff(octokit, owner, repo, pull_number) {
  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number,
    mediaType: {
      format: 'diff'
    }
  });
  return data;
}

module.exports = { getDiff };
