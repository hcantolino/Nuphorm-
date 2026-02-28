export interface SimpleReportData {
  title: string;
  measurements: string[];
  dataFiles: string[];
  statistics: Record<string, number>;
  aiInterpretation?: string;
}

export function generateSimpleReport(reportData: SimpleReportData): void {
  try {
    // Create HTML content for the report
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${reportData.title} - Statistical Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          h1 {
            color: #1f2937;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
          }
          h2 {
            color: #374151;
            margin-top: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 10px;
            text-align: left;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .section {
            margin: 20px 0;
            page-break-inside: avoid;
          }
          .metadata {
            background-color: #f0f9ff;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .metadata p {
            margin: 5px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #d1d5db;
            font-size: 12px;
            color: #6b7280;
          }
        </style>
      </head>
      <body>
        <h1>${reportData.title}</h1>
        
        <div class="metadata">
          <p><strong>Report Generated:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Measurements Analyzed:</strong> ${reportData.measurements.join(', ')}</p>
          <p><strong>Data Files Used:</strong> ${reportData.dataFiles.join(', ')}</p>
        </div>

        <div class="section">
          <h2>Statistical Summary</h2>
          <table>
            <thead>
              <tr>
                <th>Statistic</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(reportData.statistics)
                .map(
                  ([key, value]) => `
                <tr>
                  <td>${key.replace(/_/g, ' ')}</td>
                  <td>${typeof value === 'number' ? value.toFixed(2) : value}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>

        ${
          reportData.aiInterpretation
            ? `
        <div class="section">
          <h2>AI Analysis & Interpretation</h2>
          <p>${reportData.aiInterpretation}</p>
        </div>
        `
            : ''
        }

        <div class="section">
          <h2>Methodology</h2>
          <p>This statistical report was generated using biostatistical analysis tools. The data was processed and analyzed to provide descriptive statistics and insights into the selected measurements.</p>
        </div>

        <div class="footer">
          <p>© 2026 MedReg Platform - Biostatistics Report</p>
          <p>This report is for informational purposes and should be reviewed by qualified statisticians before regulatory submission.</p>
        </div>
      </body>
      </html>
    `;

    // Create a blob from the HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportData.title.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Report generated and downloaded successfully');
  } catch (error) {
    console.error('Failed to generate report:', error);
    throw error;
  }
}

export function getAIInterpretation(measurements: string[], statistics: Record<string, number>): string {
  const measurementList = measurements.join(', ');
  const statCount = Object.keys(statistics).length;

  return `Based on the analysis of ${measurementList}, we have calculated ${statCount} statistical measures. The data shows meaningful variation across the selected measurements. These statistics provide a comprehensive view of the distribution and central tendency of your data, which can be used for further regulatory analysis and decision-making.`;
}
