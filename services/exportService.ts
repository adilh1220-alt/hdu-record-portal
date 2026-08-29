
/**
 * Sanitizes a string for CSV format by handling quotes and commas.
 */
const clean = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

/**
 * Dispatches a global toast event to notify the user of a completed export/download.
 */
const triggerExportToast = (message: string) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('app:toast', {
        detail: {
          message,
          type: 'success',
          title: 'Export Complete',
          duration: 4000
        }
      })
    );
  }
};

/**
 * Generates and triggers a download for a CSV file.
 * @param filename Name of the file (without extension)
 * @param headers Array of column headers
 * @param rows 2D array of data rows
 */
export const downloadCSV = (filename: string, headers: string[], rows: any[][]) => {
  const csvContent = [
    headers.join(","),
    ...rows.map(row => row.map(clean).join(","))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = `${filename.replace(/\s+/g, '_').toLowerCase()}_${timestamp}.csv`;
  link.setAttribute("href", url);
  link.setAttribute("download", finalFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  triggerExportToast(`CSV file "${finalFilename}" successfully exported and downloaded.`);
};

/**
 * Generates and triggers a download for an Excel spreadsheet (.xls file with HTML table markup).
 * @param filename Name of the file (without extension)
 * @param headers Array of column headers
 * @param rows 2D array of data rows
 */
export const downloadExcel = (filename: string, headers: string[], rows: any[][]) => {
  const escapeXml = (str: any) => String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const headerRow = headers.map(h => `<th style="background-color:#0f172a;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #cbd5e1;text-align:left;">${escapeXml(h)}</th>`).join('');
  const bodyRows = rows.map(row => 
    '<tr>' + row.map(cell => `<td style="padding:6px;border:1px solid #cbd5e1;text-align:left;">${escapeXml(cell)}</td>`).join('') + '</tr>'
  ).join('');

  const excelContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8"/>
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>Clinical Report</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
    </head>
    <body>
      <table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:12px;">
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = `${filename.replace(/\s+/g, '_').toLowerCase()}_${timestamp}.xls`;
  link.setAttribute("href", url);
  link.setAttribute("download", finalFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  triggerExportToast(`Excel spreadsheet "${finalFilename}" successfully exported and downloaded.`);
};

