## Summary
- Create reusable MarkdownRenderer component at `frontend/src/components/common/MarkdownRenderer.tsx`
- Syntax highlighting for code blocks using react-syntax-highlighter (VS Code dark theme)
- XSS-safe through react-markdown sanitization
- Links open in new tab with security attributes
- Dark theme styling matching existing site design
- Support for headings, lists, tables, blockquotes, inline code
- Unit tests for all major features

## Acceptance Criteria Met
- [x] Component at `frontend/src/components/common/MarkdownRenderer.tsx`
- [x] Props: `content: string`, `className?: string`
- [x] Renders standard Markdown: headings, bold, italic, code blocks, inline code, lists, links, blockquotes, tables
- [x] Code blocks have syntax highlighting (react-syntax-highlighter with vscDarkPlus theme)
- [x] Links open in new tab with proper security attributes
- [x] XSS-safe - react-markdown with default sanitization
- [x] Dark theme styling matching existing site
- [x] Unit tests: renders headings, code blocks, links, handles empty/null content gracefully
- [x] Dependencies: react-markdown, react-syntax-highlighter

## Test Plan
- Navigate to any bounty detail page
- Verify markdown content renders correctly
- Test code blocks with various languages
- Verify links open in new tab
- Test empty/null content handling

Closes #345

**Wallet address for bounty:** Amu1YJjcKWKL6xuMTo2dx511kfzXAxgpetJrZp7N71o7