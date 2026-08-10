const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '..', 'paint_shop_products.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// Match rows: ('SKU', 'Name', price, wholesale, special, stock, min_stock, 'Category')
const regex = /\(\s*'([^']*)'\s*,\s*'((?:[^']|'')*)'\s*,\s*([0-9.]+)::numeric\s*,\s*([0-9.]+)::numeric\s*,\s*([0-9.]+)::numeric\s*,\s*([0-9]+)::integer\s*,\s*([0-9]+)::integer\s*,\s*'([^']*)'\s*\)/g;

const products = [];
let match;
let count = 0;

while ((match = regex.exec(sql)) !== null) {
  count++;
  const sku = match[1].trim();
  const name = match[2].replace(/''/g, "'").trim();
  const price = parseFloat(match[3]) || 0;
  const wholesale_price = parseFloat(match[4]) || 0;
  const special_price = parseFloat(match[5]) || 0;
  const stock = parseInt(match[6]) || 0;
  const min_stock = parseInt(match[7]) || 5;
  const category = match[8].trim();

  products.push({
    id: `PROD-${1000 + count}`,
    sku: sku || `SKU-${1000 + count}`,
    name,
    category,
    price,
    wholesale_price: wholesale_price || null,
    special_price: special_price || null,
    stock,
    min_stock,
    show_to_employee: true
  });
}

console.log('Extracted pristine products count:', products.length);
if (products.length > 0) {
  console.log('Sample 1:', products[0]);
  console.log('Sample 20:', products[19]);
  const outPath = path.join(__dirname, '..', 'src', 'data', 'defaultCatalog.json');
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2), 'utf8');
  console.log('Successfully saved to src/data/defaultCatalog.json!');
}
