---
layout: home

hero:
  name: "SolFoundry SDK"
  text: "Build on the Solana bounty marketplace"
  tagline: TypeScript-first SDK with full type safety, real-time events, on-chain helpers, and a ready-to-use CLI.
  image:
    src: /logo.svg
    alt: SolFoundry
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View Examples
      link: /examples/
    - theme: alt
      text: API Reference
      link: /api/

features:
  - icon: ⚡
    title: Zero config setup
    details: Install and make your first API call in under 5 minutes. No boilerplate, full TypeScript inference.
  - icon: 🛡️
    title: Type-safe by default
    details: All API responses are fully typed against the backend Pydantic models. No runtime surprises.
  - icon: 🔄
    title: Real-time events
    details: WebSocket subscriptions with automatic reconnection, topic filtering, and typed event payloads.
  - icon: ⛓️
    title: On-chain helpers
    details: Solana PDA derivation, SPL token balance queries, transaction building — no solana-py needed.
  - icon: 🤖
    title: CLI included
    details: Ship with `npx @solfoundry/cli` — list bounties, check status, view profiles, verify completions.
  - icon: 🔁
    title: Retry & rate limiting
    details: Exponential backoff retries and token-bucket rate limiting built-in to every request.
---
