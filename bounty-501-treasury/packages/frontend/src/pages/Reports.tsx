import React from 'react';
import { Download, FileText } from 'lucide-react';

const Reports: React.FC = () => {
  const reports = [
    { id: 'rpt_001', name: 'Q1 2026 Summary Report', type: 'summary', generated: '2026-03-23', format: 'PDF' },
    { id: 'rpt_002', name: 'March 2026 Monthly Report', type: 'monthly', generated: '2026-03-23', format: 'PDF' },
    { id: 'rpt_003', name: 'Treasury Transactions Export', type: 'transactions', generated: '2026-03-23', format: 'CSV' },
    { id: 'rpt_004', name: 'Budget Utilization Report', type: 'budgets', generated: '2026-03-23', format: 'PDF' }
  ];

  const handleExport = (format: string) => {
    alert(`Exporting report as ${format}...`);
  };

  return (
    <div className="reports">
      <h2>Reports & Exports</h2>
      
      <div className="card">
        <div className="report-actions">
          <button className="btn btn-primary" onClick={() => handleExport('PDF')}>
            <FileText size={18} />
            Generate Summary Report
          </button>
          <button className="btn btn-secondary" onClick={() => handleExport('CSV')}>
            <Download size={18} />
            Export Transactions (CSV)
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Report Name</th>
              <th>Type</th>
              <th>Generated</th>
              <th>Format</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(report => (
              <tr key={report.id}>
                <td>{report.name}</td>
                <td>{report.type}</td>
                <td>{report.generated}</td>
                <td>{report.format}</td>
                <td>
                  <button className="btn btn-small" onClick={() => handleExport(report.format)}>
                    <Download size={14} />
                    Download
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
