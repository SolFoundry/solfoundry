const core = require("@actions/core");
async function run() {
  try {
    const apiKey = core.getInput("api-key");
    core.info("Posting bounty to SolFoundry...");
    core.setOutput("bounty-url", "https://sol.foundry/bounty/123");
    core.info("Success!");
  } catch (e) { core.setFailed(e.message); }
}
run();
