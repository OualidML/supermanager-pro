const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', 'paint_shop_products.csv');
const csv = fs.readFileSync(csvPath, 'utf8');
const lines = csv.split(/\r?\n/).filter(l => l.trim().length > 0);

const products = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  // Simple CSV parser supporting quotes
  const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
  const sku = (matches[0] || '').replace(/"/g, '').trim();
  const name = (matches[1] || '').replace(/"/g, '').trim();
  const category = (matches[2] || 'General').replace(/"/g, '').trim();
  const price = parseFloat((matches[3] || '0').replace(/"/g, '')) || 0;
  const cost = parseFloat((matches[4] || '0').replace(/"/g, '')) || 0;
  const stock = parseInt((matches[5] || '0').replace(/"/g, '')) || 0;
  const min_stock = parseInt((matches[6] || '5').replace(/"/g, '')) || 5;

  if (name) {
    products.push({
      id: `PROD-${1000 + i}`,
      sku: sku || `SKU-${1000 + i}`,
      name,
      category,
      price,
      cost_price: cost,
      stock,
      min_stock,
      show_to_employee: true
    });
  }
}

const dataDir = path.join(__dirname, '..', 'src', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

fs.writeFileSync(path.join(dataDir, 'defaultCatalog.json'), JSON.stringify(products, null, 2));
console.log('Successfully generated defaultCatalog.json with', products.length, 'products!');
