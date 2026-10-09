// data/instagram-raw.json → unduh foto (data/images-src/) → kompres (assets/products/) → data/products.js
//
// Pakai:  node scripts/build-products.mjs
// Galeri: data/gallery.json (foto carousel IG per produk) → data/gallery-src/ → assets/gallery/
// Opsi:   --force      kompres ulang semua foto
//         --redownload unduh ulang semua foto dari IG
//         --no-images  hanya parse caption (lewati unduh & kompres)

import { readFile, writeFile, mkdir, access, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW = join(root, "data", "instagram-raw.json");
const OUT = join(root, "data", "products.js");
const SRC_DIR = join(root, "data", "images-src");
const GALLERY_JSON = join(root, "data", "gallery.json");      // { id: [url foto carousel ke-1, ke-2, …] }
const GALLERY_SRC = join(root, "data", "gallery-src");
const GALLERY_DIR = join(root, "assets", "gallery");
const IMG_DIR = join(root, "assets", "products");
const force = process.argv.includes("--force");
const redownload = process.argv.includes("--redownload");
const skipImages = process.argv.includes("--no-images");
const CONCURRENCY = 6;

// ---------- Parsing caption ----------
const clean = (s) => s.replace(/[⁠​‍️]/g, "").replace(/\s+/g, " ").trim();
const stripEmoji = (s) => clean(s.replace(/\p{Extended_Pictographic}|\p{Emoji_Modifier}|[\u{1F1E6}-\u{1F1FF}]/gu, ""));
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s/-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

// Urutan penting: yang lebih spesifik dicek dulu ("Tracktop ... CW Dublin" tetap tracktop).
const CATEGORIES = [
  ["tracktop", /track\s*top|track\s*jacket|tracktop/i],
  ["trackpant", /track\s*pa(nt|d)s?|trackpant|track\s*suit\s*pant/i],
  ["sepatu", /gazelle|samba|spezial|handball|\bsl\s*72|stan\s*smith|superstar|campus|busenitz|la\s*trainer|hamburg|city\s*series|\bc\s*85|club\s*c|\bjazz\b|vl\s*court|dragon|adilette|slides?\b|sneakers?|sepatu|shoes?\b|\bforum\b|munchen|\bnizza\b/i],
  ["jaket", /jaket|jacket|outdoor|varsity|windbreaker|anorak|vest|coach|parka|bomber|hyvent|gore-?tex|summit|fleece|puffer|nuptse/i],
  ["hoodie", /hoodie|crewneck|sweater|sweatshirt/i],
  ["polo", /polo|rugby/i],
  ["tshirt", /t-?shirt|\btee\b|jersey|kaos/i],
  ["celana", /short\s*pants?|shortpant|jogger|celana|cargo|\bpants?\b/i],
  ["aksesoris", /\bcap\b|topi|\bhat\b|\bbag\b|\btas\b|sling|bucket|socks|beanie|scarf|syal/i],
];

const BRANDS = [
  "adidas", "nike", "puma", "umbro", "kappa", "fila", "reebok", "ellesse", "lonsdale", "fred perry",
  "carhartt", "saucony", "the north face", "champion", "lacoste", "diadora", "le coq sportif", "asics",
  "new balance", "mizuno", "stussy", "tommy hilfiger", "ralph lauren", "nautica", "columbia", "patagonia",
  "uniqlo", "ben sherman", "sergio tacchini", "lotto", "admiral", "hummel", "starter", "russell", "kangol",
  "jordan", "under armour", "dickies", "levi's", "arcteryx", "salomon", "converse", "vans", "gap",
];
const BRAND_RE = new RegExp(`\\b(${BRANDS.map((b) => b.replace(/[.*+?^${}()|[\]\\']/g, "\\$&")).join("|")})\\b`, "i");
const BRAND_LABEL = { "the north face": "The North Face", "le coq sportif": "Le Coq Sportif", "levi's": "Levi's", arcteryx: "Arc'teryx" };

// "Sold Out <kota>" — kata berikut bukan nama kota
const NOT_CITY = /^(jalur belakang|store|offline|cod|online)$/i;

function parsePrice(line) {
  const v = line.replace(/^harga\s*:?\s*/i, "");
  const jt = v.match(/(\d+(?:[.,]\d+)?)\s*(jt|juta)/i);
  if (jt) return "Rp " + Math.round(parseFloat(jt[1].replace(",", ".")) * 1e6).toLocaleString("id-ID");
  const k = v.match(/^(\d[\d.,x]*)\s*(k|rb|ribu)?(?![\w])/i);
  if (!k) return "";
  const n = k[1].toLowerCase().replace(/[.,]/g, "");
  if (/x/.test(n)) return `Rp ${n}.000`;
  if (k[2] || Number(n) < 10000) return "Rp " + (Number(n) * 1000).toLocaleString("id-ID");
  return "Rp " + Number(n).toLocaleString("id-ID");
}

function parseCaption(caption) {
  const lines = caption.split("\n").map(clean);
  const nonEmpty = lines.filter(Boolean);
  const statusLine = stripEmoji(nonEmpty[0] || "");

  let status = "ready";
  if (/sold|go\s*to/i.test(statusLine)) status = "sold";
  else if (/booked/i.test(statusLine)) status = "booked";

  const cityRaw = stripEmoji(statusLine.match(/(?:sold\s*out|go\s*to)\s+(.+)$/i)?.[1] || "");
  const soldCity = cityRaw && !NOT_CITY.test(cityRaw) ? titleCase(cityRaw) : "";

  // Baris 2 = nama produk (kalau baris 2 ternyata bullet/harga, pakai baris 1)
  let nameLine = nonEmpty[1] || "";
  if (!nameLine || /^[•\-]|^harga/i.test(nameLine)) nameLine = nonEmpty[0] || "";
  const name = stripEmoji(nameLine) || "Produk Dar Casual";

  const bullets = lines.filter((l) => /^[•\-–]/.test(l)).map((l) => clean(l.replace(/^[•\-–]\s*/, "")));
  let condition = "", colour = "", size = "";
  const extras = [];
  for (const b of bullets) {
    if (!colour && /colou?r|warna/i.test(b)) colour = b.replace(/\s*(colou?rs?|warna)\s*:?/i, "").trim();
    else if (!size && /^(size|ukuran)/i.test(b)) size = b.replace(/^(size|ukuran)\s*:?\s*/i, "").trim();
    else if (!condition && /nominus|minus|condition|kondisi|like a new|mulus|vgc/i.test(b)) condition = b;
    else extras.push(b);
  }

  const priceLine = lines.find((l) => /^harga/i.test(l)) || "";
  const price = status === "ready" ? parsePrice(priceLine) : "";
  const freeShipping = /free\s*ongkir/i.test(priceLine);

  const category = CATEGORIES.find(([, re]) => re.test(name))?.[0] || "lainnya";
  const brandRaw = name.match(BRAND_RE)?.[1]?.toLowerCase() || "";
  const brand = BRAND_LABEL[brandRaw] || (brandRaw ? titleCase(brandRaw) : "");

  return {
    name, status, soldCity, category, brand,
    condition: condition.replace(/^nominus$/i, "Nominus (tanpa minus)"),
    colour, size, extras, price, freeShipping,
  };
}

// ---------- Unduh foto ----------
const exists = (p) => access(p).then(() => true, () => false);

async function download(url, dest) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      return true;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

async function downloadQueue(items, label) {
  const queue = [];
  for (const [id, url, dest] of items) {
    if (!url || (!redownload && (await exists(dest)))) continue;
    queue.push([id, url, dest]);
  }
  let ok = 0, fail = 0;
  const failed = [];
  const worker = async () => {
    while (queue.length) {
      const [id, url, dest] = queue.shift();
      try {
        await download(url, dest);
        ok++;
      } catch (e) {
        fail++;
        failed.push(`${id}: ${e.message}`);
      }
      if ((ok + fail) % 50 === 0) console.log(`  … ${ok + fail} diproses`);
    }
  };
  const total = queue.length;
  if (total) console.log(`↓ mengunduh ${total} ${label}…`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (total) console.log(`✓ unduh ${label}: ${ok} berhasil, ${fail} gagal`);
  if (failed.length) console.log("  gagal:\n  " + failed.slice(0, 20).join("\n  "));
}

// ---------- Main ----------
const raw = JSON.parse(await readFile(RAW, "utf8"));
const parsed = raw.map((post) => ({ id: post.id, date: post.date, ...parseCaption(post.caption) }));

// Galeri (carousel IG) hanya untuk produk yang masih bisa dibeli — foto pertama = foto utama yang sudah ada
const gallery = (await exists(GALLERY_JSON)) ? JSON.parse(await readFile(GALLERY_JSON, "utf8")) : {};
const available = new Set(parsed.filter((p) => p.status !== "sold").map((p) => p.id));

if (!skipImages) {
  await mkdir(SRC_DIR, { recursive: true });
  await mkdir(GALLERY_SRC, { recursive: true });
  await downloadQueue(raw.map((p) => [p.id, p.img, join(SRC_DIR, `${p.id}.jpg`)]), "foto utama");
  const galleryItems = [];
  for (const [id, urls] of Object.entries(gallery)) {
    if (!available.has(id)) continue;
    urls.slice(1).forEach((url, i) => galleryItems.push([id, url, join(GALLERY_SRC, `${id}-${i + 1}.jpg`)]));
  }
  await downloadQueue(galleryItems, "foto galeri");
  // Versi 720px hanya untuk produk yang masih bisa dibeli; yang sold cukup 480px (hemat ±90 MB).
  const hires = parsed.filter((p) => p.status !== "sold").map((p) => p.id);
  await writeFile(join(root, "data", "hires-ids.json"), JSON.stringify(hires));
  const py = spawnSync("python", [join(root, "scripts", "optimize-images.py"), ...(force ? ["--force"] : [])], { stdio: "inherit" });
  if (py.status !== 0) console.warn("! optimize-images.py gagal — jalankan manual: python scripts/optimize-images.py");
}

const products = [];
let missing = 0;
for (const p of parsed) {
  if (!(await exists(join(IMG_DIR, `${p.id}-480.webp`)))) {
    missing++;
    continue;
  }
  // w = lebar terbesar yang tersedia → dipakai app.js untuk srcset
  const w = (await exists(join(IMG_DIR, `${p.id}-1080.webp`))) ? 1080
    : (await exists(join(IMG_DIR, `${p.id}-720.webp`))) ? 720 : 480;
  // g = jumlah foto di galeri detail (foto utama + foto carousel yang sudah dikompres)
  let g = 1;
  if (available.has(p.id)) while (await exists(join(GALLERY_DIR, `${p.id}-${g}.webp`))) g++;
  products.push({ ...p, ...(w > 480 ? { w } : {}), ...(g > 1 ? { g } : {}) });
}

// Ringkas: buang field kosong supaya file lebih kecil
const compact = products.map((p) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v !== false && !(Array.isArray(v) && !v.length)))
);

await writeFile(
  OUT,
  "// File ini dibuat otomatis oleh scripts/build-products.mjs — jangan edit manual.\n" +
    `window.DC_PRODUCTS = ${JSON.stringify(compact)};\n`
);
const by = (k) => Object.entries(products.reduce((a, p) => ((a[p[k] || "-"] = (a[p[k] || "-"] || 0) + 1), a), {}));
console.log(`✓ ${products.length} produk → data/products.js (${(await stat(OUT)).size >> 10} KB)` + (missing ? `, ${missing} dilewati (foto tidak ada)` : ""));
console.log("  status  :", by("status").map(([k, v]) => `${k} ${v}`).join(", "));
console.log("  kategori:", by("category").map(([k, v]) => `${k} ${v}`).join(", "));
const withGallery = products.filter((p) => p.g);
console.log(`  galeri  : ${withGallery.length} produk, ${withGallery.reduce((a, p) => a + p.g, 0)} foto`);
