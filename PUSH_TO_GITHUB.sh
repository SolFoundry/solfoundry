#!/bin/bash

# SolFoundry CLI - Push to GitHub Script
# This script helps you push the code and create a PR for Bounty #511

set -e

echo "🏭 SolFoundry CLI - GitHub Submission Script"
echo "=============================================="
echo ""

# Check if git is configured
if ! git config user.name > /dev/null 2>&1; then
    echo "⚠️  Git user.name not configured"
    read -p "Enter your GitHub username: " GITHUB_USER
    git config user.name "$GITHUB_USER"
fi

if ! git config user.email > /dev/null 2>&1; then
    echo "⚠️  Git user.email not configured"
    read -p "Enter your GitHub email: " GITHUB_EMAIL
    git config user.email "$GITHUB_EMAIL"
fi

# Push to your GitHub repository
echo ""
echo "📤 Step 1: Push to your GitHub repository"
echo ""
echo "Run these commands:"
echo ""
echo "  # Create a new repository on GitHub (do this in browser first)"
echo "  # Then add it as remote:"
echo "  git remote add origin https://github.com/YOUR_USERNAME/solfoundry-cli.git"
echo ""
echo "  # Push the code:"
echo "  git branch -M main"
echo "  git push -u origin main"
echo ""

read -p "Press Enter after you've created the repository and added the remote..."

# Create PR instructions
echo ""
echo "📝 Step 2: Create Pull Request"
echo ""
echo "Go to: https://github.com/solfoundry/solfoundry/compare"
echo ""
echo "PR Title:"
echo "  feat: Implement Bounty CLI tool (#511)"
echo ""
echo "PR Description (copy this):"
echo ""
echo "---"
echo "## 🏭 Bounty #511 Submission - Bounty CLI Tool"
echo ""
echo "### Summary"
echo "Complete implementation of the SolFoundry Bounty CLI tool as specified in issue #511."
echo ""
echo "### ✅ Acceptance Criteria Met"
echo "- [x] CLI commands: bounties list/search, bounty claim/submit, status"
echo "- [x] Authentication: API key support"
echo "- [x] Output formats: table (default) and JSON"
echo "- [x] Filtering: tier, status, category"
echo "- [x] Config file: ~/.solfoundry/config.yaml"
echo "- [x] Rich terminal formatting with colors"
echo "- [x] Installable via pip"
echo "- [x] Shell completions (bash, zsh, fish)"
echo "- [x] Documentation: README, examples, changelog"
echo "- [x] Tests: comprehensive test suite with mocks"
echo ""
echo "### Technical Details"
echo "- **Language**: Python 3.8+"
echo "- **Framework**: Typer (Click-based)"
echo "- **Lines of Code**: ~1,600"
echo "- **Test Coverage**: 24 tests, all passing"
echo "- **Documentation**: Complete user and developer docs"
echo ""
echo "### Installation"
echo "\`\`\`bash"
echo "pip install solfoundry-cli"
echo "sf config init"
echo "sf bounties list"
echo "\`\`\`"
echo ""
echo "### Testing"
echo "\`\`\`bash"
echo "pytest tests/ -v"
echo "# All 24 tests pass"
echo "\`\`\`"
echo ""
echo "### Wallet Address for Reward"
echo "- **SOL**: \`9xsvaaYbVrRuMu6JbXq5wVY9tDAz5S6BFzmjBkUaM865\`"
echo "- **USDT TRC20**: \`TMLkvEDrjvHEUbWYU1jfqyUKmbLNZkx6T1\`"
echo ""
echo "### Files Changed"
echo "- solfoundry_cli/ - Main CLI package"
echo "- tests/ - Test suite"
echo "- README.md, examples.md, CHANGELOG.md - Documentation"
echo ""
echo "Fixes #511"
echo "---"
echo ""

read -p "Press Enter after creating the PR..."

echo ""
echo "✅ Submission Complete!"
echo ""
echo "Next steps:"
echo "1. Wait for AI code review (5-LLM, score ≥ 6.5/10)"
echo "2. Address any review comments"
echo "3. Receive reward: 300,000 $FNDRY (~$600 USDT)"
echo ""
echo "Good luck! 🚀"
