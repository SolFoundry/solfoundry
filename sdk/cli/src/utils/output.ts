/**
 * Terminal output helpers: colours, tables, and structured error output.
 */

import chalk from 'chalk';
import Table from 'cli-table3';

// ---------------------------------------------------------------------------
// Colour shortcuts
// ---------------------------------------------------------------------------

export const c = {
  success: (s: string) => chalk.green(s),
  error: (s: string) => chalk.red(s),
  warn: (s: string) => chalk.yellow(s),
  info: (s: string) => chalk.cyan(s),
  dim: (s: string) => chalk.dim(s),
  bold: (s: string) => chalk.bold(s),
  header: (s: string) => chalk.bold.underline(s),
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, (s: string) => string> = {
  open: chalk.green,
  in_progress: chalk.yellow,
  completed: chalk.blue,
  paid: chalk.magenta,
  cancelled: chalk.red,
  disputed: chalk.red,
  draft: chalk.dim,
  under_review: chalk.cyan,
};

export function statusBadge(status: string): string {
  const colour = STATUS_COLORS[status.toLowerCase()] ?? chalk.white;
  return colour(`[${status.toUpperCase()}]`);
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export interface BountyRow {
  id: string;
  title: string;
  tier: number | string;
  reward: number | string;
  status: string;
  deadline?: string | null;
}

export function printBountiesTable(rows: BountyRow[]): void {
  const table = new Table({
    head: [
      c.bold('ID'),
      c.bold('Title'),
      c.bold('Tier'),
      c.bold('Reward ($FNDRY)'),
      c.bold('Status'),
      c.bold('Deadline'),
    ],
    colWidths: [10, 40, 6, 16, 16, 22],
    wordWrap: true,
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push([
      c.dim(row.id.slice(0, 8)),
      row.title,
      `T${row.tier}`,
      String(row.reward),
      statusBadge(row.status),
      row.deadline ? new Date(row.deadline).toLocaleDateString() : c.dim('—'),
    ]);
  }

  console.log(table.toString());
}

// ---------------------------------------------------------------------------
// Key-value detail block
// ---------------------------------------------------------------------------

export function printKeyValue(pairs: [string, string][]): void {
  const maxKeyLen = Math.max(...pairs.map(([k]) => k.length));
  for (const [key, value] of pairs) {
    const padded = key.padEnd(maxKeyLen);
    console.log(`  ${c.dim(padded)}  ${value}`);
  }
}

// ---------------------------------------------------------------------------
// Error output
// ---------------------------------------------------------------------------

export function printError(message: string, hint?: string): void {
  console.error(`\n${c.error('✖')}  ${message}`);
  if (hint) {
    console.error(`   ${c.dim(hint)}`);
  }
  console.error('');
}

export function printSuccess(message: string): void {
  console.log(`\n${c.success('✔')}  ${message}\n`);
}

export function printSection(title: string): void {
  console.log(`\n${c.header(title)}`);
}
