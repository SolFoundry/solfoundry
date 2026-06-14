# GitHub issue scraper for Foundry bounties

This document outlines an implementation plan for automatically discovering GitHub issues and turning eligible issues into SolFoundry bounty candidates.

## Workflow

1. Load configured GitHub repositories.
2. Poll open issues through the GitHub API.
3. Normalize issue metadata into a common bounty candidate format.
4. Score each candidate for bounty suitability.
5. Map score and labels to a reward tier.
6. Store candidates with stable dedupe keys.
7. Hold risky or unclear candidates for manual review.
8. Post approved candidates to SolFoundry only after policy checks pass.

## Candidate metadata

Each candidate should preserve repository, issue number, title, body summary, labels, URL, timestamps, detected domain, estimated difficulty, suggested tier, posting status, and dedupe key.

## Safety checks

The scraper should reject hidden-prompt requests, payout or wallet instructions, unclear acceptance criteria, duplicate source URLs, and security-sensitive exploit detail.

## Testing checklist

- Polling returns normalized candidates.
- Closed issues are not posted as new bounties.
- Duplicate GitHub issues do not create duplicate bounty records.
- Webhook retries are idempotent.
- Unsafe issues are held for manual review.
- Reward tier mapping is deterministic.
- API failures use bounded retry behavior.
