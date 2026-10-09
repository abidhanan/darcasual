# Dar Casual — Website Katalog

Website katalog satu halaman untuk [@darcasual.co](https://www.instagram.com/darcasual.co/).
HTML/CSS/JS murni, tanpa framework dan tanpa build tool.

## Struktur

```
index.html                 Halaman (header, hero, katalog, tentang, cara order, footer)
styles.css                 Design system + layout responsif
app.js                     Render katalog, filter, modal detail, link WhatsApp
data/instagram-raw.json    Data mentah 1.157 post produk IG (caption + URL gambar)
data/products.js           Data produk hasil parsing (dibuat otomatis, jangan edit manual)
data/images-src/           Foto asli unduhan IG (±170 MB) — JANGAN ikut di-deploy
assets/hero/               Foto hero full cover: hero-wide-*.webp (3 foto berjajar, layar landscape)
                           dan hero-tall-*.webp (1 foto, HP/tablet portrait)
assets/og.jpg              Gambar pratinjau link (logo), 1200×630
assets/brand/              Logo (navbar 160px, footer 320px), favicon, ikon iOS/Android
assets/gallery/            Foto carousel IG ke-2 dst. untuk galeri detail produk (<id>-<n>.webp, 720px)
data/gallery.json          URL foto carousel per produk (Ready/Booked) — sumber assets/gallery/
assets/products/           Foto siap web: <id>-480.webp (semua), <id>-720.webp (Ready/Booked),
                           <id>-1080.webp (hanya foto hero & Tentang Kami)
scripts/build-products.mjs raw.json → unduh foto → kompres → parse caption → products.js
scripts/optimize-images.py Kompres foto (Pillow), dipanggil otomatis oleh build-products
scripts/sync-instagram.mjs Tarik post terbaru via Instagram API resmi, lalu build
```

Yang perlu di-upload ke hosting: `index.html`, `styles.css`, `app.js`, `data/products.js`,
dan folder `assets/` (±85 MB, di bawah batas upload 100 MB Vercel Hobby). Folder `data/images-src/` dan `scripts/` tidak perlu.

## Menjalankan secara lokal

```bash
python -m http.server 5173
```

Lalu buka http://localhost:5173. Membuka `index.html` langsung juga bisa.

## Deploy (Vercel)

Live: https://darcasual.vercel.app (proyek `darcasual` di akun Vercel `abidhanan`, paket Hobby).

```bash
npx vercel@latest deploy --prod
```

`.vercelignore` memastikan hanya file website yang di-upload (foto asli, script, dan data
mentah tidak ikut). Ukuran saat ini ±163 MB (±2.300 file). Batas upload 100 MB untuk CLI sudah dihapus Vercel
(changelog Juni 2026) dan deploy 163 MB sudah terbukti berhasil. Paket Hobby tetap membatasi
±5.000 upload file per hari — biasanya aman karena Vercel hanya meng-upload file yang berubah.

## Memperbarui katalog

**Opsi A — otomatis via Instagram API (disarankan)**

1. Pastikan @darcasual.co berjenis akun **Business/Creator**.
2. Buat app di [Meta for Developers](https://developers.facebook.com/), tambahkan produk
   *Instagram API with Instagram Login*, lalu buat **long-lived access token** (berlaku 60 hari).
3. Jalankan:
   ```bash
   IG_ACCESS_TOKEN=token_anda node scripts/sync-instagram.mjs
   ```
4. Deploy ulang folder ini.

Hanya post yang captionnya memuat baris `Harga :` yang masuk katalog, jadi post testimoni
atau giveaway otomatis tidak ikut.

**Opsi B — manual**: edit `data/instagram-raw.json`, lalu jalankan `node scripts/build-products.mjs`.

Opsi build: `--force` (kompres ulang semua foto), `--redownload` (unduh ulang dari IG),
`--no-images` (hanya parse caption). Butuh Node 18+ dan Python + Pillow (`pip install pillow`).

Kategori ditebak dari nama produk (Tracktop, Trackpant, Sepatu, T-Shirt, Hoodie & Crewneck,
Jaket, Polo, Celana, Aksesoris) dan merk dari daftar `BRANDS` di `build-products.mjs`.
Tambahkan kata kunci/merk baru di sana bila ada produk yang masuk kategori yang salah.

## Format caption yang dibaca parser

Ikuti format caption yang sudah dipakai di IG:

```
Bismillah @darcasual.co Ready        ← baris 1: status (Ready / SOLD OUT <kota> / BOOKED)
                                     
Trackpant Adidas Firebird            ← baris 2: NAMA PRODUK
• Nominus                            ← kondisi
• Dark Navy-White Colour             ← warna (kata "Colour")
• Size Fit L (LP 88-110, ...)        ← ukuran (diawali "Size")
• Free Stickers                      ← bonus
Harga : 380k Saja (FREE ONGKIR)      ← harga + free ongkir
```

Saat produk terjual, cukup ubah baris 1 caption menjadi `SOLD OUT ...` lalu sinkronkan ulang.
Kartu produk otomatis berubah abu-abu dengan tombol "Cari yang Mirip".

## Galeri detail produk

Detail produk bisa digeser kanan-kiri berisi semua foto carousel Instagram — untuk produk
Ready/Booked (228 produk, 1.141 foto). Produk Sold Out tetap 1 foto agar ukuran tetap wajar.
Data galeri diambil dari halaman embed publik IG (`/p/<id>/embed/captioned/`, tanpa login).

## Catatan tampilan

- Hero full cover dengan isi rata tengah. Warna navbar dan tombol WhatsApp mengikuti section
  di belakangnya (atribut `data-theme` di setiap section: hero / dark / light / beige).
- Link menu tidak menambahkan `#` ke URL (scroll halus via JS). Di layar landscape dipakai 3 foto model berjajar (`assets/hero/hero-wide-*`)
  supaya tetap tajam di monitor lebar, karena satu foto IG (maks 1080px) akan buram bila dibentangkan.
- Lebar konten: 1440px (laptop/desktop), 1600px (≥1600), 1760px (≥1920). Grid katalog
  2 / 3 / 4 / 5 kolom sesuai lebar layar. Jumlah kartu per "muat" mengikuti jumlah kolom.
- Strip keunggulan berjalan kanan → kiri (pause saat di-hover). Isinya digandakan otomatis
  sesuai lebar layar. Untuk pengguna dengan pengaturan "kurangi gerakan", strip berhenti.
- Setiap kali mengubah `styles.css` / `app.js` / `data/products.js`, naikkan nomor `?v=` di
  `index.html` supaya pengunjung tidak mendapat file lama dari cache.

## Dukungan perangkat

Diuji di 24 ukuran layar: Galaxy Z Fold (280/344 tertutup, 884 terbuka), iPhone SE (320/375),
Galaxy S/A (360), iPhone 15/16 (393/440), Pixel & Galaxy S Ultra (412), HP landscape,
iPad mini/Air/Pro (portrait & landscape), laptop 1366, Full HD, dan QHD.

- Area aman notch/Dynamic Island iPhone dan gesture bar Android (`viewport-fit=cover`).
- Tinggi layar memakai `svh`, jadi address bar Safari/Chrome yang naik-turun tidak membuat layout loncat.
- Dark mode paksa (Samsung Internet, MIUI, Chrome) dicegah dengan `color-scheme: light`.
- Kolom cari berukuran 16px agar iPhone tidak zoom otomatis.
- Overlay hover hanya untuk mouse. Di layar sentuh, tap kartu membuka detail (bottom sheet).
- Fallback untuk Safari/Samsung Internet lama: `<dialog>`, `aspect-ratio`, dan `backdrop-filter`.
  Foto berformat WebP (didukung sejak iOS 14 / Safari 14, 2020).

## Konfigurasi

- Nomor WhatsApp: `WA_NUMBER` di `app.js` (saat ini `6285741841695`, dari bio IG).
- Jumlah produk per halaman: `PAGE_SIZE` di `app.js`.
