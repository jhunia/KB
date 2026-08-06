import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, '..');

// Load environment variables from .env
dotenv.config({ path: path.join(appDir, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generate() {
  console.log('Fetching products from Supabase...');
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('in_stock', true); // Only generating pages for active products

  if (error) {
    console.error('Error fetching products:', error);
    process.exit(1);
  }

  console.log(`Found ${products.length} products. Generating static HTML files...`);

  // Read base product.html
  const baseHtmlPath = path.join(appDir, 'product.html');
  const baseHtml = fs.readFileSync(baseHtmlPath, 'utf-8');

  // Ensure output directory exists
  const outDir = path.join(appDir, 'public', 'p');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const product of products) {
    const title = `${product.name} | KB.ENT`;
    const desc = product.description ? product.description.substring(0, 160).replace(/"/g, '&quot;') : `Buy ${product.name} at KB.ENT`;
    const image = product.images && product.images.length > 0 ? product.images[0] : '';
    const url = `https://kb.ent/p/${product.id}.html`;

    const jsonLd = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": product.name,
      "image": image,
      "description": desc,
      "offers": {
        "@type": "Offer",
        "url": url,
        "priceCurrency": "GHS",
        "price": product.price,
        "availability": product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
      }
    };

    const injectedHead = `
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="product" />
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
  <script>window.PRODUCT_ID = "${product.id}";</script>
`;

    // Replace the default title with our SEO rich head
    let newHtml = baseHtml.replace('<title>KB — Product Detail</title>', injectedHead);

    fs.writeFileSync(path.join(outDir, `${product.id}.html`), newHtml);
  }

  console.log(`Successfully generated ${products.length} static product pages in public/p/`);
}

generate();
