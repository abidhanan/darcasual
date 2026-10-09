// Tarik post terbaru @darcasual.co lewat Instagram API resmi (Instagram Login),
// simpan ke data/instagram-raw.json, lalu jalankan build-products.mjs.
//
// Syarat: akun IG berjenis Business/Creator + access token (long-lived, berlaku 60 hari).
// Pakai:  IG_ACCESS_TOKEN=xxxx node scripts/sync-instagram.mjs
//
// Token JANGAN ditaruh di file website/frontend. Jalankan script ini di komputer admin
// atau sebagai cron job (mis. GitHub Actions) lalu deploy ulang hasilnya.

import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const token = process.env.IG_ACCESS_TOKEN;
const LIMIT = Number(process.env.IG_LIMIT || 30);

if (!token) {
  console.error("IG_ACCESS_TOKEN belum di-set. Lihat README.md bagian 'Sinkronisasi Instagram'.");
  process.exit(1);
}

const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url}";
let url = `https://graph.instagram.com/me/media?fields=${encodeURIComponent(fields)}&limit=25&access_token=${token}`;
const posts = [];

while (url && posts.length < LIMIT) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    console.error("Instagram API error:", json.error?.message || res.status);
    process.exit(1);
  }
  posts.push(...json.data);
  url = json.paging?.next;
}

// Hanya post produk: caption yang memuat baris "Harga :".
const isProduct = (p) => /harga\s*:/i.test(p.caption || "");

const pickImage = (p) => {
  if (p.media_type === "CAROUSEL_ALBUM") {
    const first = p.children?.data?.find((c) => c.media_type === "IMAGE") || p.children?.data?.[0];
    return first?.media_url || p.media_url;
  }
  return p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url;
};

const raw = posts
  .filter(isProduct)
  .slice(0, LIMIT)
  .map((p) => ({
    id: p.permalink.match(/\/(?:p|reel)\/([^/]+)/)?.[1] || p.id,
    date: p.timestamp.slice(0, 10),
    caption: p.caption,
    img: pickImage(p),
  }));

await writeFile(join(root, "data", "instagram-raw.json"), JSON.stringify(raw, null, 2) + "\n");
console.log(`✓ ${raw.length} post produk disimpan ke data/instagram-raw.json`);

const build = spawnSync(process.execPath, [join(root, "scripts", "build-products.mjs")], { stdio: "inherit" });
process.exit(build.status ?? 0);
