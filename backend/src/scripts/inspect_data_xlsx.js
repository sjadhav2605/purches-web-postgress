import xlsx from 'xlsx';
import path from 'path';

const file = path.resolve('../appscript/DDPL Procurement Portal — Data.xlsx');
const wb = xlsx.readFile(file);
console.log('ALL Sheet Names in Data.xlsx:');
console.log(wb.SheetNames);

for (const s of wb.SheetNames) {
  if (s.toLowerCase().includes('item') || s.toLowerCase().includes('mat') || s.toLowerCase().includes('cat') || s.toLowerCase().includes('pr') || s.toLowerCase().includes('master')) {
    const rows = xlsx.utils.sheet_to_json(wb.Sheets[s], { header: 1 });
    console.log(`\n=== SHEET: ${s} (rows: ${rows.length}) ===`);
    console.log('Headers:', rows[0]);
    if (rows.length > 1) {
      console.log('Row 1:', rows[1]);
      console.log('Row 2:', rows[2]);
      console.log('Row 3:', rows[3]);
    }
  }
}
