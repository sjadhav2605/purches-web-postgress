import xlsx from 'xlsx';
import path from 'path';

const excelPath = path.resolve('../DDPL_Vendor_Register_Cleaned.xlsx');
const workbook = xlsx.readFile(excelPath);

const vendorImportSheet = workbook.Sheets['Vendor_Import'];
const vendorRows = xlsx.utils.sheet_to_json(vendorImportSheet);

const bankSheet = workbook.Sheets['Bank & KYC'];
const bankRows = xlsx.utils.sheet_to_json(bankSheet);

console.log('Vendor_Import count:', vendorRows.length);
console.log('Sample Vendor_Import row:\n', JSON.stringify(vendorRows[0], null, 2));

console.log('\nBank & KYC count:', bankRows.length);
console.log('Sample Bank & KYC row:\n', JSON.stringify(bankRows[0], null, 2));

console.log('\nAll Vendor Names in Vendor_Import:');
console.log(vendorRows.map((v, i) => `${i + 1}. [${v['Import to portal']}] ${v['Vendor name']} | GST: ${v['GSTIN']} | PAN: ${v['PAN']} | Mob: ${v['Mobile']} | Email: ${v['Email']}`));
