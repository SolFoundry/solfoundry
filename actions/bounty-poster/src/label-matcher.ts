/**
 * Label Matcher - Matches issue labels against trigger labels.
 *
 * Supports:
 * - Exact matching (case-insensitive)
 * - Prefix matching (e.g., 'bounty-*' matches 'bounty-rust')
 * - Wildcard matching (e.g., '*-integration' matches 'discord-integration')
 */

export class LabelMatcher {
  /**
   * Match issue labels against trigger labels.
   *
   * @param triggerLabels - Labels that should trigger bounty posting
   * @param issueLabels - Labels on the GitHub issue
   * @returns Array of matched labels
   */
  static match(triggerLabels: string[], issueLabels: string[]): string[] {
    const matched: string[] = [];

    for (const trigger of triggerLabels) {
      const normalizedTrigger = trigger.toLowerCase().trim();

      if (!normalizedTrigger) continue;

      for (const issueLabel of issueLabels) {
        const normalizedLabel = issueLabel.toLowerCase().trim();

        if (this.patternMatch(normalizedTrigger, normalizedLabel)) {
          if (!matched.includes(normalizedLabel)) {
            matched.push(normalizedLabel);
          }
        }
      }
    }

    return matched;
  }

  /**
   * Check if a label matches a pattern.
   * Supports '*' as wildcard.
   */
  private static patternMatch(pattern: string, label: string): boolean {
    // Exact match
    if (pattern === label) return true;

    // Wildcard matching
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars except *
        .replace(/\*/g, '.*'); // Convert * to regex .*
      const regex = new RegExp(`^${regexPattern}$`, 'i');
      return regex.test(label);
    }

    // Prefix match (e.g., 'bounty' matches 'bounty-rust')
    if (label.startsWith(pattern + '-')) return true;

    return false;
  }

  /**
   * Check if any trigger label matches.
   */
  static hasMatch(triggerLabels: string[], issueLabels: string[]): boolean {
    return this.match(triggerLabels, issueLabels).length > 0;
  }

  /**
   * Extract bounty-specific labels from issue labels.
   * Returns labels that start with 'bounty-' or contain 'bounty'.
   */
  static extractBountyLabels(issueLabels: string[]): string[] {
    return issueLabels.filter(
      label => label.includes('bounty') || label.startsWith('bounty-')
    );
  }
}
