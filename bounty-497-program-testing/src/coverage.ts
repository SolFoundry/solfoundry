/**
 * SolFoundry Program Testing Framework - Coverage Tracking
 * 
 * 代码覆盖率追踪和报告生成
 */

import { CoverageInfo } from './types';
import * as fs from 'fs';
import * as path from 'path';

export class CoverageTracker {
  private coverage: Map<string, FileCoverage> = new Map();
  private enabled: boolean = true;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  registerFile(filePath: string, source: string): void {
    if (!this.enabled) return;

    const lines = source.split('\n');
    const coverage = new FileCoverage(filePath, lines.length);
    this.coverage.set(filePath, coverage);
  }

  recordLine(filePath: string, lineNumber: number): void {
    if (!this.enabled) return;

    const fileCoverage = this.coverage.get(filePath);
    if (fileCoverage) {
      fileCoverage.hitLine(lineNumber);
    }
  }

  recordBranch(filePath: string, lineNumber: number, branchIndex: number, taken: boolean): void {
    if (!this.enabled) return;

    const fileCoverage = this.coverage.get(filePath);
    if (fileCoverage) {
      fileCoverage.hitBranch(lineNumber, branchIndex, taken);
    }
  }

  getReport(): CoverageReport {
    const files: CoverageInfo[] = [];
    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;

    for (const [filePath, fileCoverage] of this.coverage.entries()) {
      const info = fileCoverage.getInfo();
      files.push(info);

      totalLines += info.lines.total;
      coveredLines += info.lines.covered;
      totalFunctions += info.functions.total;
      coveredFunctions += info.functions.covered;
      totalBranches += info.branches.total;
      coveredBranches += info.branches.covered;
    }

    return {
      files,
      summary: {
        lines: {
          total: totalLines,
          covered: coveredLines,
          percentage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
        },
        functions: {
          total: totalFunctions,
          covered: coveredFunctions,
          percentage: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
        },
        branches: {
          total: totalBranches,
          covered: coveredBranches,
          percentage: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
        },
      },
    };
  }

  generateLcovReport(outputDir: string): string {
    const report = this.getReport();
    let lcov = '';

    for (const file of report.files) {
      lcov += `SF:${file.file}\n`;

      // 行覆盖率
      for (let i = 0; i < file.lines.total; i++) {
        if (!file.lines.uncovered.includes(i + 1)) {
          lcov += `DA:${i + 1},1\n`;
        }
      }

      lcov += `end_of_record\n`;
    }

    const outputPath = path.join(outputDir, 'coverage.lcov');
    fs.writeFileSync(outputPath, lcov);
    return outputPath;
  }

  generateHtmlReport(outputDir: string): string {
    const report = this.getReport();
    const html = this.generateHtml(report);

    const outputPath = path.join(outputDir, 'index.html');
    fs.writeFileSync(outputPath, html);
    return outputPath;
  }

  private generateHtml(report: CoverageReport): string {
    const { summary, files } = report;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Coverage Report - SolFoundry Testing Framework</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
    .card .value { font-size: 32px; font-weight: bold; color: #333; }
    .card .percentage { font-size: 18px; }
    .percentage.good { color: #22c55e; }
    .percentage.medium { color: #f59e0b; }
    .percentage.bad { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f9fafb; font-weight: 600; color: #666; }
    tr:hover { background: #f9fafb; }
    .file-name { font-family: monospace; color: #333; }
    .progress-bar { width: 100%; height: 8px; background: #eee; border-radius: 4px; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 4px; }
    .progress-fill.good { background: #22c55e; }
    .progress-fill.medium { background: #f59e0b; }
    .progress-fill.bad { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Coverage Report</h1>
    
    <div class="summary">
      <div class="card">
        <h3>Lines</h3>
        <div class="value">${summary.lines.covered}/${summary.lines.total}</div>
        <div class="percentage ${this.getClass(summary.lines.percentage)}">${summary.lines.percentage.toFixed(1)}%</div>
      </div>
      <div class="card">
        <h3>Functions</h3>
        <div class="value">${summary.functions.covered}/${summary.functions.total}</div>
        <div class="percentage ${this.getClass(summary.functions.percentage)}">${summary.functions.percentage.toFixed(1)}%</div>
      </div>
      <div class="card">
        <h3>Branches</h3>
        <div class="value">${summary.branches.covered}/${summary.branches.total}</div>
        <div class="percentage ${this.getClass(summary.branches.percentage)}">${summary.branches.percentage.toFixed(1)}%</div>
      </div>
    </div>

    <h2>Files</h2>
    <table>
      <thead>
        <tr>
          <th>File</th>
          <th>Lines</th>
          <th>Coverage</th>
        </tr>
      </thead>
      <tbody>
        ${files.map(file => `
          <tr>
            <td class="file-name">${file.file}</td>
            <td>${file.lines.covered}/${file.lines.total}</td>
            <td>
              <div class="progress-bar">
                <div class="progress-fill ${this.getClass(file.percentage)}" style="width: ${file.percentage}%"></div>
              </div>
              ${file.percentage.toFixed(1)}%
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
    `.trim();
  }

  private getClass(percentage: number): string {
    if (percentage >= 80) return 'good';
    if (percentage >= 50) return 'medium';
    return 'bad';
  }
}

class FileCoverage {
  private filePath: string;
  private totalLines: number;
  private coveredLines: Set<number> = new Set();
  private branches: Map<number, { total: number; covered: number }> = new Map();

  constructor(filePath: string, totalLines: number) {
    this.filePath = filePath;
    this.totalLines = totalLines;
  }

  hitLine(lineNumber: number): void {
    this.coveredLines.add(lineNumber);
  }

  hitBranch(lineNumber: number, branchIndex: number, taken: boolean): void {
    if (!this.branches.has(lineNumber)) {
      this.branches.set(lineNumber, { total: 0, covered: 0 });
    }
    const branch = this.branches.get(lineNumber)!;
    branch.total++;
    if (taken) branch.covered++;
  }

  getInfo(): CoverageInfo {
    const uncovered: number[] = [];
    for (let i = 1; i <= this.totalLines; i++) {
      if (!this.coveredLines.has(i)) {
        uncovered.push(i);
      }
    }

    let totalBranches = 0;
    let coveredBranches = 0;
    for (const branch of this.branches.values()) {
      totalBranches += branch.total;
      coveredBranches += branch.covered;
    }

    const coveredCount = this.coveredLines.size;
    const percentage = this.totalLines > 0 ? (coveredCount / this.totalLines) * 100 : 0;

    return {
      file: this.filePath,
      lines: {
        total: this.totalLines,
        covered: coveredCount,
        uncovered,
      },
      functions: {
        total: 0,
        covered: 0,
      },
      branches: {
        total: totalBranches,
        covered: coveredBranches,
      },
      percentage,
    };
  }
}

export interface CoverageReport {
  files: CoverageInfo[];
  summary: {
    lines: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
  };
}

// 全局覆盖率实例
let globalTracker: CoverageTracker | null = null;

export function getCoverageTracker(): CoverageTracker {
  if (!globalTracker) {
    globalTracker = new CoverageTracker();
  }
  return globalTracker;
}

export function enableCoverage(): void {
  globalTracker = new CoverageTracker(true);
}

export function disableCoverage(): void {
  globalTracker = new CoverageTracker(false);
}
