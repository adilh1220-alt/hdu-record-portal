
/**
 * Sanitizes a string for CSV format by handling quotes and commas.
 */
const clean = (val: any) => `"${String(val || '').replace(/"/g, '""')}"`;

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
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename.replace(/\s+/g, '_').toLowerCase()}_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
