import * as Excel from 'exceljs';

/**
 * Exporte et télécharge un Workbook ExcelJS dans le navigateur
 */
export async function downloadWorkbook(workbook: Excel.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Charge un fichier Excel sélectionné par un input de type file vers un Workbook ExcelJS
 */
export async function readWorkbookFromFile(file: File): Promise<Excel.Workbook> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new Excel.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  return workbook;
}
