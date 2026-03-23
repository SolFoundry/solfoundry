import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'SolFoundry SDK',
  description: 'TypeScript SDK for the SolFoundry bounty marketplace on Solana',
  lang: 'en-US',
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.svg' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'SolFoundry SDK Docs' }],
    ['meta', { property: 'og:description', content: 'TypeScript SDK & CLI for SolFoundry — the Solana-native developer bounty marketplace' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'SolFoundry SDK',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Examples', link: '/examples/' },
      { text: 'API Reference', link: '/api/' },
      { text: 'CLI', link: '/guide/cli' },
      {
        text: 'v1.0.0',
        items: [
          { text: 'Changelog', link: '/guide/changelog' },
          { text: 'GitHub', link: 'https://github.com/SolFoundry/solfoundry/tree/main/sdk' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Authentication', link: '/guide/authentication' },
            { text: 'Error Handling', link: '/guide/error-handling' },
          ],
        },
        {
          text: 'CLI Tool',
          items: [
            { text: 'Overview', link: '/guide/cli' },
            { text: 'Commands', link: '/guide/cli-commands' },
          ],
        },
        {
          text: 'Other',
          items: [
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
            { text: 'Changelog', link: '/guide/changelog' },
          ],
        },
      ],
      '/examples/': [
        {
          text: 'Examples',
          items: [
            { text: 'Overview', link: '/examples/' },
            { text: '01 — List Open Bounties', link: '/examples/01-list-bounties' },
            { text: '02 — Check Contributor Stats', link: '/examples/02-contributor-stats' },
            { text: '03 — Subscribe to Events', link: '/examples/03-realtime-events' },
            { text: '04 — Verify On-Chain Completion', link: '/examples/04-verify-onchain' },
            { text: '05 — Query Leaderboard', link: '/examples/05-leaderboard' },
            { text: '06 — Submit a Solution', link: '/examples/06-submit-solution' },
            { text: '07 — Manage Escrow', link: '/examples/07-escrow' },
            { text: '08 — Search Bounties', link: '/examples/08-search-bounties' },
            { text: '09 — GitHub Integration', link: '/examples/09-github-integration' },
            { text: '10 — Solana Helpers', link: '/examples/10-solana-helpers' },
            { text: '11 — Error Handling', link: '/examples/11-error-handling' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'SolFoundry', link: '/api/solfoundry' },
            { text: 'BountyClient', link: '/api/bounty-client' },
            { text: 'EscrowClient', link: '/api/escrow-client' },
            { text: 'ContributorClient', link: '/api/contributor-client' },
            { text: 'EventSubscriber', link: '/api/event-subscriber' },
            { text: 'GitHubClient', link: '/api/github-client' },
            { text: 'Solana Helpers', link: '/api/solana-helpers' },
            { text: 'Errors', link: '/api/errors' },
            { text: 'Types', link: '/api/types' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/SolFoundry/solfoundry' },
      { icon: 'twitter', link: 'https://twitter.com/solfoundry' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 SolFoundry',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern: 'https://github.com/SolFoundry/solfoundry/edit/main/sdk/docs-site/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
