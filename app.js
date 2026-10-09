(() => {
  // ---------- Konfigurasi ----------
  // Nomor dari bio IG (wa.me/62085741841695). Angka 0 setelah kode negara dibuang,
  // karena wa.me menolak format 620…
  const WA_NUMBER = "6285741841695";
  const WA_DISPLAY = "+62 857-4184-1695";
  // Jumlah kartu per "muat" mengikuti jumlah kolom grid supaya baris terakhir selalu penuh:
  // 2 kolom → 8, 3 → 12, 4 → 12, 5 → 15
  const pageSize = () => {
    const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 3;
    return cols * (cols >= 4 ? 3 : 4);
  };
  const NEW_COUNT = 8; // = jumlah produk di section Koleksi Baru
  const IMG = "assets/products/";
  const GALLERY = "assets/gallery/";

  const CATEGORY_LABEL = {
    tracktop: "Tracktop",
    trackpant: "Trackpant",
    jaket: "Jaket",
    hoodie: "Hoodie & Crewneck",
    polo: "Polo",
    tshirt: "T-Shirt",
    sepatu: "Sepatu",
    celana: "Celana",
    aksesoris: "Aksesoris",
    lainnya: "Lainnya",
  };
  const STATUS_LABEL = { ready: "Ready", booked: "Booked (DP)", sold: "Sold out" };

  document.documentElement.classList.remove("no-js");

  const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;
  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const norm = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const permalink = (p) => `https://www.instagram.com/p/${p.id}/`;

  // ---------- Data ----------
  const statusRank = { ready: 0, booked: 1, sold: 2 };
  const raw = Array.isArray(window.DC_PRODUCTS) ? window.DC_PRODUCTS : [];
  // Ready dulu, lalu Booked, lalu Sold out. Di dalam tiap grup: urutan feed IG (terbaru dulu).
  const products = raw
    .map((p, i) => ({
      colour: "", size: "", condition: "", price: "", brand: "", extras: [], ...p,
      _i: i,
      _q: norm([p.name, p.brand, p.colour, p.size, CATEGORY_LABEL[p.category]].join(" ")),
    }))
    .sort((a, b) => statusRank[a.status] - statusRank[b.status] || a._i - b._i);
  const byId = new Map(products.map((p) => [p.id, p]));
  const newIds = new Set(raw.filter((p) => p.status === "ready").slice(0, NEW_COUNT).map((p) => p.id));

  // ---------- Gambar responsif ----------
  // 480w selalu ada; 720w hanya untuk produk yang masih tersedia (lihat build script).
  function picture(p, sizes, { eager = false } = {}) {
    const widths = [480, 720, 1080].filter((w) => w <= (p.w || 480));
    const srcset = widths.map((w) => `${IMG}${p.id}-${w}.webp ${w}w`).join(", ");
    const alt = `${p.name}${p.colour ? ", warna " + p.colour : ""}`;
    return `<picture>
        <source type="image/webp" srcset="${srcset}" sizes="${sizes}" />
        <img src="${IMG}${p.id}-480.webp" alt="${esc(alt)}" width="480" height="600"
             ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />
      </picture>`;
  }
  const CARD_SIZES = "(min-width: 1600px) 340px, (min-width: 1024px) 33vw, 50vw";
  const MODAL_SIZES = "(min-width: 768px) 520px, 100vw";

  // ---------- Pesan WhatsApp ----------
  // Semua template chat memakai format yang sama: salam, blok *Produk*, lalu penutup
  const productBlock = (p, extra = []) =>
    "*Produk*\n" +
    [["Nama", p.name], ["Warna", p.colour], ["Size", p.size], ...extra]
      .map(([k, v]) => `• ${k}: ${v || "-"}`)
      .join("\n");
  const msg = {
    booked: (p) =>
      `Halo Dar Casual, saya mau antre produk ini\n\n${productBlock(p, [["Status", "Booked"]])}\n\nKalau booking-nya batal, tolong kabari saya`,
    similar: (p) =>
      `Halo Dar Casual, saya cari produk yang mirip\n\n${productBlock(p, [["Status", "Sold Out"]])}\n\nTolong info kalau ada stok yang mirip`,
  };

  const priceLabel = (p) =>
    p.status === "sold" ? "Sold Out" : p.status === "booked" ? "Booked" : p.price || "Tanya harga";

  function actionsFor(p) {
    if (p.status === "sold") return { primary: ["Cari yang Mirip", msg.similar(p)], secondary: null };
    if (p.status === "booked") return { primary: ["Antre via Admin", msg.booked(p)], secondary: null };
    return { primary: ["Beli Sekarang", ""], secondary: null };
  }

  function badgeFor(p) {
    if (p.status === "sold") return `<span class="badge badge-dark">Sold Out${p.soldCity ? " · " + esc(p.soldCity) : ""}</span>`;
    if (p.status === "booked") return `<span class="badge badge-dark">Booked</span>`;
    if (newIds.has(p.id)) return `<span class="badge">Baru</span>`;
    return "";
  }

  // ---------- Kartu produk ----------
  function cardHTML(p) {
    const a = actionsFor(p);
    const meta = [p.colour, p.size.replace(/\s*\(.*\)/, "")].filter(Boolean).join(" · ");
    return `
      <article class="card reveal${p.status === "sold" ? " is-sold" : ""}" data-id="${esc(p.id)}">
        <div class="card-media">
          ${picture(p, CARD_SIZES)}
          ${badgeFor(p)}
          <div class="card-overlay">
            <p class="ov-name">${esc(p.name)}</p>
            ${meta ? `<p class="ov-meta">${esc(meta)}</p>` : ""}
            <div class="ov-actions">
              ${p.status === "ready"
                ? `<button class="btn btn-ghost-white" type="button" data-buy="${esc(p.id)}">${a.primary[0]}</button>`
                : `<a class="btn btn-ghost-white" href="${waLink(a.primary[1])}" target="_blank" rel="noopener">${a.primary[0]}</a>`}
            </div>
          </div>
        </div>
        <div class="card-info">
          <div>
            <p class="ci-name">${esc(p.name)}</p>
            ${p.colour ? `<p class="ci-meta">${esc(p.colour)}</p>` : ""}
          </div>
          <p class="ci-price">${esc(priceLabel(p))}</p>
        </div>
      </article>`;
  }

  // ---------- Filter ----------
  const grid = document.getElementById("product-grid");
  const loadMoreBtn = document.getElementById("load-more");
  const filtersEl = document.getElementById("filters");
  const countEl = document.getElementById("filter-count");
  const searchEl = document.getElementById("search");
  const brandEl = document.getElementById("brand-filter");
  const statusEl = document.getElementById("status-filter");

  const state = { category: "all", brand: "", status: "all", q: "" };
  let list = [];
  let shown = 0;

  const countBy = (key) =>
    products.reduce((acc, p) => ((acc[p[key]] = (acc[p[key]] || 0) + 1), acc), {});

  // Chip kategori, urut dari yang terbanyak
  const catCounts = countBy("category");
  Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.filter = cat;
      b.setAttribute("aria-pressed", "false");
      b.textContent = CATEGORY_LABEL[cat] || cat;
      filtersEl.appendChild(b);
    });

  // Pilihan merk, urut dari yang terbanyak
  Object.entries(countBy("brand"))
    .filter(([b]) => b)
    .sort((a, b) => b[1] - a[1])
    .forEach(([brand]) => brandEl.add(new Option(brand, brand)));

  function matches(p) {
    if (state.category !== "all" && p.category !== state.category) return false;
    if (state.brand && p.brand !== state.brand) return false;
    if (state.status !== "all" && p.status !== state.status) return false;
    if (state.q && !state.q.split(/\s+/).every((w) => p._q.includes(w))) return false;
    return true;
  }

  function updateCount() {
    if (!products.length) return (countEl.textContent = "");
    countEl.textContent = list.length
      ? `Menampilkan ${Math.min(shown, list.length)} dari ${list.length} produk`
      : "";
  }

  function apply() {
    list = products.filter(matches);
    shown = 0;
    grid.innerHTML = "";
    if (!products.length) {
      grid.innerHTML = `
        <div class="empty">
          <p>Koleksi kami sedang bersiap tampil. Sementara itu, intip langsung di Instagram @darcasual.co.</p>
          <a class="btn btn-primary" href="https://www.instagram.com/darcasual.co/" target="_blank" rel="noopener">Kunjungi Instagram</a>
        </div>`;
    } else if (!list.length) {
      grid.innerHTML = `
        <div class="empty">
          <p>Belum ada produk yang cocok. Coba kata kunci lain, atau tanya admin. Stok baru masuk hampir setiap hari.</p>
          <button class="btn btn-outline" type="button" data-reset>Reset filter</button>
        </div>`;
    }
    more();
  }

  // Tambah kartu tanpa me-render ulang yang sudah tampil
  function more() {
    const next = list.slice(shown, shown + pageSize());
    if (next.length) {
      grid.insertAdjacentHTML("beforeend", next.map(cardHTML).join(""));
      shown += next.length;
      observeReveals(grid);
    }
    loadMoreBtn.hidden = shown >= list.length;
    updateCount();
  }

  filtersEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.category = chip.dataset.filter;
    filtersEl.querySelectorAll(".chip").forEach((c) => {
      const on = c === chip;
      c.classList.toggle("is-active", on);
      c.setAttribute("aria-pressed", on);
    });
    chip.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    apply();
    toCatalogTop();
  });
  brandEl.addEventListener("change", () => { state.brand = brandEl.value; apply(); toCatalogTop(); });
  statusEl.addEventListener("change", () => { state.status = statusEl.value; apply(); toCatalogTop(); });

  // Setelah filter berganti: bila sudah ter-scroll jauh ke bawah, kembali ke produk paling atas
  // (blok filter menempel tepat di bawah navbar, hasil baru langsung terlihat)
  function toCatalogTop() {
    const head = document.querySelector(".site-header").offsetHeight;
    const ctrl = document.getElementById("catalog-controls")?.offsetHeight || 0;
    const target = Math.round(grid.getBoundingClientRect().top + window.scrollY - head - ctrl - 24);
    if (window.scrollY > target + 2) window.scrollTo({ top: target, behavior: "smooth" });
  }

  let searchTimer;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = norm(searchEl.value.trim());
      apply();
      toCatalogTop();
    }, 180);
  });
  // Enter di keyboard HP: tutup keyboard supaya hasil terlihat
  searchEl.closest("form").addEventListener("submit", (e) => {
    e.preventDefault();
    searchEl.blur();
  });

  function resetFilters() {
    Object.assign(state, { category: "all", brand: "", status: "all", q: "" });
    searchEl.value = "";
    brandEl.value = "";
    statusEl.value = "all";
    syncDropdowns();
    filtersEl.querySelector('[data-filter="all"]').click();
  }

  loadMoreBtn.addEventListener("click", more);

  // ---------- Dropdown custom (menggantikan tampilan <select> bawaan) ----------
  // <select> asli tetap ada (tersembunyi) sebagai sumber nilai, jadi filter lama tetap bekerja.
  // Panah berputar saat dibuka; bisa dipakai dengan mouse, sentuhan, dan keyboard.
  const CHEV = '<svg class="dd-chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5 6 6.5 11 1.5"/></svg>';
  let dropdowns = [];
  function makeDropdown(select) {
    dropdowns = dropdowns.filter((d) => d.wrap.isConnected); // buang dropdown form lama yang sudah ditutup
    const wrap = document.createElement("div");
    wrap.className = "dd";
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.tabIndex = -1;
    const labelText = document.querySelector(`label[for="${select.id}"]`)?.textContent || "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dd-btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<span class="dd-label"></span>${CHEV}`;
    const list = document.createElement("ul");
    list.className = "dd-list";
    list.setAttribute("role", "listbox");
    list.id = `${select.id}-list`;
    list.setAttribute("aria-label", labelText);
    btn.setAttribute("aria-controls", list.id);
    wrap.append(btn, list);
    let focusIdx = -1;

    const opts = () => [...list.children];
    const render = () => {
      list.innerHTML = [...select.options]
        .map((o, i) => (o.hidden ? "" : `<li class="dd-opt" role="option" data-i="${i}" aria-selected="${o.selected}">${esc(o.text)}</li>`))
        .join("");
    };
    const sync = () => {
      btn.querySelector(".dd-label").textContent = select.options[select.selectedIndex]?.text || "";
      btn.setAttribute("aria-label", `${labelText}: ${select.options[select.selectedIndex]?.text || ""}`);
      btn.classList.toggle("is-placeholder", !!select.options[select.selectedIndex]?.hidden);
      opts().forEach((li) => li.setAttribute("aria-selected", +li.dataset.i === select.selectedIndex));
    };
    const setFocus = (i, scroll = true) => {
      const all = opts();
      focusIdx = Math.max(0, Math.min(all.length - 1, i));
      all.forEach((li, k) => li.classList.toggle("is-focus", k === focusIdx));
      if (scroll) all[focusIdx]?.scrollIntoView({ block: "nearest" });
    };
    const open = () => {
      dropdowns.forEach((d) => d !== api && d.close());
      wrap.classList.add("is-open");
      btn.setAttribute("aria-expanded", "true");
      // buka ke atas bila ruang di bawah (dalam area scroll form / layar) tidak cukup
      const limit = wrap.closest(".f-scroll")?.getBoundingClientRect().bottom ?? window.innerHeight;
      wrap.classList.toggle("dd-up", limit - btn.getBoundingClientRect().bottom < Math.min(list.scrollHeight, 288) + 12);
      setFocus(Math.max(0, opts().findIndex((li) => +li.dataset.i === select.selectedIndex)));
    };
    const close = () => {
      wrap.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    };
    const choose = (i) => {
      if (select.selectedIndex !== i) {
        select.selectedIndex = i;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      sync();
      close();
      btn.focus({ preventScroll: true });
    };
    btn.addEventListener("click", () => (wrap.classList.contains("is-open") ? close() : open()));
    list.addEventListener("click", (e) => {
      const li = e.target.closest(".dd-opt");
      if (li) choose(+li.dataset.i);
    });
    list.addEventListener("pointerover", (e) => {
      const li = e.target.closest(".dd-opt");
      if (li) setFocus(opts().indexOf(li), false);
    });
    btn.addEventListener("keydown", (e) => {
      const isOpen = wrap.classList.contains("is-open");
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        if (!isOpen) return open();
        setFocus(focusIdx + (e.key === "ArrowDown" ? 1 : -1));
      } else if (e.key === "Home" && isOpen) { e.preventDefault(); setFocus(0); }
      else if (e.key === "End" && isOpen) { e.preventDefault(); setFocus(opts().length - 1); }
      else if ((e.key === "Enter" || e.key === " ") && isOpen) { e.preventDefault(); choose(+opts()[focusIdx].dataset.i); }
      else if (e.key === "Escape" && isOpen) { e.preventDefault(); close(); }
      else if (e.key === "Tab") close();
    });
    render();
    sync();
    const api = { wrap, close, sync };
    dropdowns.push(api);
    return api;
  }
  [brandEl, statusEl].forEach(makeDropdown);
  function syncDropdowns() { dropdowns.forEach((d) => d.sync()); }
  document.addEventListener("click", (e) => {
    dropdowns.forEach((d) => { if (!d.wrap.contains(e.target)) d.close(); });
  });

  // ---------- Kunci scroll (aman untuk iOS Safari: body tidak ikut tergulir di balik modal) ----------
  let lockY = 0;
  let locks = 0;
  function lockScroll() {
    if (locks++) return;
    lockY = window.scrollY;
    document.body.style.top = `-${lockY}px`;
    document.body.classList.add("is-locked");
  }
  function unlockScroll() {
    if (!locks || --locks) return;
    document.body.classList.remove("is-locked");
    document.body.style.top = "";
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, lockY);
    html.style.scrollBehavior = prev;
  }

  // ---------- Modal detail ----------
  const modal = document.getElementById("product-modal");
  const modalBody = modal.querySelector(".modal-body");
  const backdrop = document.querySelector(".modal-backdrop-fallback");
  const nativeDialog = typeof modal.showModal === "function";
  if (!nativeDialog) modal.classList.add("is-fallback");
  let lastFocus = null;

  function showModal() {
    lastFocus = document.activeElement;
    lockScroll();
    if (nativeDialog) modal.showModal();
    else {
      modal.classList.add("is-open");
      modal.setAttribute("open", "");
      backdrop.hidden = false;
    }
    modal.scrollTop = 0;
    modal.querySelector(".modal-close").focus({ preventScroll: true });
  }
  function closeModal() {
    if (nativeDialog) { if (modal.open) modal.close(); }
    else onClosed();
  }
  function onClosed() {
    if (!nativeDialog) {
      modal.classList.remove("is-open");
      modal.removeAttribute("open");
      backdrop.hidden = true;
    }
    unlockScroll();
    lastFocus?.focus?.({ preventScroll: true });
  }
  modal.addEventListener("close", onClosed);

  // ---------- Detail produk: 3 tampilan di panel info (detail → form pemesanan → konfirmasi) ----------
  const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.5-.3Z"/></svg>';
  const PAY_METHODS = ["BCA", "Dana", "ShopeePay"];
  let modalProduct = null;

  function detailHTML(p) {
    const specs = [
      ["Kondisi", p.condition],
      ["Warna", p.colour],
      ["Ukuran", p.size],
      ["Bonus", p.extras.join(", ")],
      ["Ongkir", p.freeShipping && p.status === "ready" ? "Free" : ""],
      ["Status", STATUS_LABEL[p.status] + (p.status === "sold" && p.soldCity ? ` · ${p.soldCity}` : "")],
    ].filter(([, v]) => v);
    const a = actionsFor(p);
    // Produk Ready → buka form pemesanan; Booked/Sold → langsung chat admin
    const action = p.status === "ready"
      ? `<button class="btn btn-primary" type="button" data-action="order">${a.primary[0]}</button>`
      : `<a class="btn btn-primary" href="${waLink(a.primary[1])}" target="_blank" rel="noopener">${a.primary[0]}</a>`;
    return `
      <p class="eyebrow">${esc([p.brand, CATEGORY_LABEL[p.category]].filter(Boolean).join(" · "))}</p>
      <h2 id="modal-title">${esc(p.name)}</h2>
      <p class="m-price">${esc(priceLabel(p))}</p>
      <dl class="m-specs">${specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      <div class="m-cta">
        <div class="m-actions">${action}</div>
        <p class="m-note">No refund, no return</p>
      </div>`;
  }

  function orderFormHTML(p) {
    const select = (name, label, placeholder, options) => `
        <div class="f-field" data-field="${name}">
          <label for="f-${name}">${label}</label>
          <select id="f-${name}" name="${name}" required>
            <option value="" hidden selected>${placeholder}</option>
            ${options.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}
          </select>
        </div>`;
    return `
      <form class="order-form" novalidate>
        <div class="f-head">
          <p class="eyebrow">Format Pemesanan</p>
          <h2 id="modal-title">${esc(p.name)}</h2>
          <p class="m-price">${esc(priceLabel(p))}${p.size ? ` · Size ${esc(p.size.replace(/\s*\(.*\)/, ""))}` : ""}</p>
        </div>
        <div class="f-scroll">
          <div class="f-field" data-field="nama">
            <label for="f-nama">Nama penerima</label>
            <input id="f-nama" name="nama" type="text" autocomplete="name" placeholder="Nama lengkap" required />
          </div>
          <div class="f-field" data-field="hp">
            <label for="f-hp">Nomor HP / WhatsApp</label>
            <input id="f-hp" name="hp" type="tel" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx" required />
          </div>
          <div class="f-field" data-field="alamat">
            <label for="f-alamat">Alamat lengkap</label>
            <textarea id="f-alamat" name="alamat" rows="2" autocomplete="street-address" placeholder="Jalan, no. rumah, RT/RW, kelurahan, kecamatan" required></textarea>
          </div>
          <div class="f-row">
            <div class="f-field" data-field="kota">
              <label for="f-kota">Kota / Kabupaten</label>
              <input id="f-kota" name="kota" type="text" autocomplete="address-level2" required />
            </div>
            <div class="f-field" data-field="kodepos">
              <label for="f-kodepos">Kode pos</label>
              <input id="f-kodepos" name="kodepos" type="text" inputmode="numeric" autocomplete="postal-code" maxlength="5" required />
            </div>
          </div>
          ${select("metode", "Metode Pembayaran", "Pilih metode pembayaran", PAY_METHODS.map((m) => [m, m]))}
          ${select("opsi", "Opsi Pembayaran", "Pilih opsi pembayaran", [["Bayar Lunas", "Bayar Lunas"], ["DP 100k", "DP 100k (booking 7–10 hari)"]])}
          <div class="f-field" data-field="catatan">
            <label for="f-catatan">Catatan (opsional)</label>
            <textarea id="f-catatan" name="catatan" rows="2" placeholder="Contoh: patokan rumah, jam terima paket"></textarea>
          </div>
        </div>
        <div class="m-cta">
          <div class="m-actions"><button class="btn btn-primary" type="submit">Beli Sekarang</button></div>
          <p class="m-note">No refund, no return</p>
        </div>
      </form>`;
  }

  function successHTML(url) {
    return `
      <div class="m-success">
        <span class="m-success-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
        <h2 id="modal-title">Tinggal tekan kirim</h2>
        <p>Chat WhatsApp berisi data pesananmu sudah dibuka. Tekan kirim di WhatsApp, lalu admin akan mengonfirmasi ketersediaan dan total pembayaran.</p>
        <a class="btn btn-primary btn-icon" href="${url}" target="_blank" rel="noopener">${WA_ICON}<span>Buka WhatsApp Lagi</span></a>
      </div>`;
  }

  // Validasi form (pesan dalam Bahasa Indonesia), lalu susun template chat WhatsApp
  const FIELD_RULES = {
    nama: (v) => (v.trim().length >= 2 ? "" : "Nama penerima wajib diisi."),
    hp: (v) => (/^(\+?62|0)8\d{7,12}$/.test(v.replace(/[\s-]/g, "")) ? "" : "Nomor HP belum valid, contoh: 081234567890."),
    alamat: (v) => (v.trim().length >= 10 ? "" : "Tulis alamat lengkap (jalan, RT/RW, kelurahan, kecamatan)."),
    kota: (v) => (v.trim().length >= 3 ? "" : "Kota / kabupaten wajib diisi."),
    kodepos: (v) => (/^\d{5}$/.test(v.trim()) ? "" : "Kode pos terdiri dari 5 angka."),
    metode: (v) => (v ? "" : "Pilih metode pembayaran."),
    opsi: (v) => (v ? "" : "Pilih opsi pembayaran."),
  };
  function validateField(form, name) {
    const field = form.querySelector(`[data-field="${name}"]`);
    const value = new FormData(form).get(name) || "";
    const msg = FIELD_RULES[name](String(value));
    field.classList.toggle("is-invalid", !!msg);
    field.querySelector(".f-error")?.remove();
    if (msg) field.insertAdjacentHTML("beforeend", `<p class="f-error" role="alert">${msg}</p>`);
    return !msg;
  }
  // Format chat sesuai permintaan admin Dar Casual
  function orderMessage(p, d) {
    const line = (k, v) => `• ${k}: ${v || "-"}`;
    return [
      "Halo Dar Casual, saya mau order",
      "",
      "*Produk*",
      line("Nama", p.name),
      line("Warna", p.colour),
      line("Size", p.size),
      line("Harga", p.price || "Tanya harga"),
      line("Ongkir", p.freeShipping ? "Free" : "Konfirmasi admin"),
      "",
      "*Data Penerima*",
      line("Nama", d.nama.trim()),
      line("No. HP", d.hp.replace(/[\s-]/g, "")),
      line("Alamat", d.alamat.trim().replace(/\s*\n\s*/g, ", ")),
      line("Kota/Kab", d.kota.trim()),
      line("Kode Pos", d.kodepos.trim()),
      "",
      "*Pembayaran*",
      line("Metode Pembayaran", d.metode),
      line("Opsi Pembayaran", d.opsi === "DP 100k" ? "DP 100k (booking 7–10 hari)" : "Bayar Lunas"),
      "",
      `*Catatan:* ${(d.catatan || "").trim() || "-"}`,
      "",
      "Tolong segera diproses",
    ].join("\n");
  }

  function setView(view, extra) {
    const p = modalProduct;
    const info = modalBody.querySelector(".m-info");
    info.classList.toggle("is-form", view === "order");
    modalBody.classList.toggle("is-ordering", view === "order");
    info.innerHTML = view === "order" ? orderFormHTML(p) : view === "success" ? successHTML(extra) : detailHTML(p);
    info.scrollTop = 0;
    modal.scrollTop = 0;
    if (view === "order") {
      const form = info.querySelector(".order-form");
      form.querySelectorAll("select").forEach(makeDropdown);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const bad = Object.keys(FIELD_RULES).filter((n) => !validateField(form, n));
        if (bad.length) {
          const f = form.querySelector(`[data-field="${bad[0]}"]`);
          f.scrollIntoView({ block: "nearest" });
          f.querySelector("input, textarea, .dd-btn")?.focus({ preventScroll: true });
          return;
        }
        const d = Object.fromEntries(new FormData(form));
        const url = waLink(orderMessage(p, d));
        const win = window.open(url, "_blank", "noopener");
        if (!win) window.location.href = url; // popup diblokir → buka di tab yang sama
        setView("success", url);
      });
      // Pesan error hilang begitu kolom diperbaiki
      const revalidate = (e) => {
        const f = e.target.closest("[data-field]");
        if (f?.classList.contains("is-invalid")) validateField(form, f.dataset.field);
      };
      form.addEventListener("input", revalidate);
      form.addEventListener("change", revalidate);
    }
  }

  function openModal(id, view = "detail") {
    const p = byId.get(id);
    if (!p) return;
    modalProduct = p;
    modalBody.innerHTML = `${galleryHTML(p)}<div class="m-info"></div>`;
    setView(p.status === "ready" ? view : "detail");
    showModal();
    initGallery();
  }

  modalBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "order") setView("order");
  });

  // ---------- Galeri detail produk (geser kanan-kiri seperti carousel Instagram) ----------
  const ARROW = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  function galleryHTML(p) {
    const n = p.g || 1;
    const alt = (i) => `${p.name}${p.colour ? ", warna " + p.colour : ""} — foto ${i + 1} dari ${n}`;
    const slides = [`<div class="m-slide">${picture(p, MODAL_SIZES, { eager: true })}</div>`];
    for (let i = 1; i < n; i++) {
      slides.push(`<div class="m-slide"><img src="${GALLERY}${p.id}-${i}.webp" alt="${esc(alt(i))}" width="720" height="900" loading="${i === 1 ? "eager" : "lazy"}" decoding="async" /></div>`);
    }
    if (n === 1) return `<div class="m-gallery"><div class="m-track">${slides[0]}</div></div>`;
    return `
      <div class="m-gallery" role="region" aria-roledescription="carousel" aria-label="Foto produk">
        <div class="m-track" tabindex="0">${slides.join("")}</div>
        <span class="m-count" aria-live="polite">1 / ${n}</span>
        <button class="m-nav m-prev" type="button" aria-label="Foto sebelumnya" disabled>${ARROW("M15 5l-7 7 7 7")}</button>
        <button class="m-nav m-next" type="button" aria-label="Foto berikutnya">${ARROW("M9 5l7 7-7 7")}</button>
        <div class="m-dots" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<span${i ? "" : ' class="is-active"'}></span>`).join("")}</div>
      </div>`;
  }
  function initGallery() {
    const track = modalBody.querySelector(".m-track");
    const prev = modalBody.querySelector(".m-prev");
    if (!track || !prev) return;
    const next = modalBody.querySelector(".m-next");
    const dots = [...modalBody.querySelectorAll(".m-dots span")];
    const count = modalBody.querySelector(".m-count");
    const n = dots.length;
    let current = 0;
    const update = () => {
      const i = Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / track.clientWidth)));
      if (i === current) return;
      current = i;
      dots.forEach((d, k) => d.classList.toggle("is-active", k === current));
      count.textContent = `${current + 1} / ${n}`;
      prev.disabled = current === 0;
      next.disabled = current === n - 1;
    };
    track.scrollLeft = 0;
    track.addEventListener("scroll", update, { passive: true });
    const go = (dir) => track.scrollBy({ left: dir * track.clientWidth, behavior: "smooth" });
    prev.addEventListener("click", () => go(-1));
    next.addEventListener("click", () => go(1));
    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });
  }

  const onCardClick = (e) => {
    if (e.target.closest("[data-reset]")) return resetFilters();
    const buy = e.target.closest("[data-buy]");
    if (buy) return openModal(buy.dataset.buy, "order");
    const opener = e.target.closest("[data-open]");
    if (opener) return openModal(opener.dataset.open);
    if (e.target.closest("a, button")) return; // tombol WA jalan seperti biasa
    const card = e.target.closest(".card");
    if (card) openModal(card.dataset.id);
  };
  grid.addEventListener("click", onCardClick);

  // ---------- Koleksi Baru: produk Ready paling baru (urutan feed IG) ----------
  const newGrid = document.getElementById("new-grid");
  if (newGrid) {
    const fresh = [...newIds].map((id) => byId.get(id));
    if (fresh.length) {
      newGrid.innerHTML = fresh.map(cardHTML).join("");
      newGrid.addEventListener("click", onCardClick);
    } else {
      newGrid.closest("section").hidden = true;
    }
  }

  modal.querySelector(".modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); }); // klik backdrop
  backdrop.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !nativeDialog && modal.classList.contains("is-open")) closeModal();
  });

  // ---------- Link WA statis ----------
  document.querySelectorAll(".js-wa").forEach((el) => {
    el.href = waLink(el.dataset.waText || "Halo Dar Casual");
  });
  document.querySelectorAll(".js-wa-display").forEach((el) => (el.textContent = WA_DISPLAY));

  // ---------- Header, menu mobile, tombol WA melayang ----------
  const header = document.querySelector(".site-header");
  const waFloat = document.querySelector(".wa-float");
  const hero = document.querySelector(".hero");
  // Setiap section punya data-theme (hero / dark / light). Navbar memakai tema section yang tepat
  // berada di bawah garis navbar; tombol WA memakai tema section di pojok kanan bawah.
  const themed = [...document.querySelectorAll("main [data-theme], body > footer[data-theme]")];
  const sectionAt = (y) => {
    for (const el of themed) {
      const r = el.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) return el;
    }
    return null;
  };
  const themeAt = (y) => sectionAt(y)?.dataset.theme || "light";
  // Section tanpa id (strip berjalan) dianggap bagian dari Beranda
  const navLinksAll = [...document.querySelectorAll(".nav-links a, .mm-links a")];
  const controls = document.getElementById("catalog-controls");
  const footer = document.getElementById("kontak");
  const catalog = document.getElementById("katalog");
  let activeId = null;
  const onScroll = () => {
    if (document.body.classList.contains("is-locked")) return;
    // Sampel tepat di bawah navbar (bukan di tengahnya): saat menu diklik, section berhenti tepat
    // di bawah navbar, jadi titik tengah navbar masih berada di section sebelumnya.
    // Bila halaman sudah mentok bawah (footer lebih pendek dari layar), pakai tema footer.
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    const current = atBottom ? themed[themed.length - 1] : sectionAt(header.offsetHeight + 1);
    header.dataset.theme = current?.dataset.theme || "light";
    // Penanda halaman realtime: menu yang sesuai section saat ini diberi garis bawah
    const id = !current || !current.id || current.classList.contains("hero") ? "top" : current.id;
    if (id !== activeId) {
      activeId = id;
      navLinksAll.forEach((a) => {
        const on = a.getAttribute("href") === `#${id}`;
        a.classList.toggle("is-active", on);
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }
    // Blok filter katalog diberi bayangan saat sedang menempel di bawah navbar
    if (controls) controls.classList.toggle("is-stuck", controls.getBoundingClientRect().top <= header.offsetHeight + 2 && catalog.getBoundingClientRect().bottom > header.offsetHeight + controls.offsetHeight);
    waFloat.dataset.theme = themeAt(window.innerHeight - 48);
    // Tombol WA disembunyikan di section Kontak (footer sudah punya tombol chat sendiri)
    const footerInView = footer.getBoundingClientRect().top < window.innerHeight - 24;
    waFloat.classList.toggle("is-visible", window.scrollY > hero.offsetHeight * 0.8 && !footerInView);
  };
  window.addEventListener("resize", onScroll);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("mobile-menu");
  const menuBackdrop = document.getElementById("menu-backdrop");
  const isMenuOpen = () => menu.classList.contains("is-open");
  menu.inert = true;
  const setMenu = (open) => {
    if (open === isMenuOpen()) return;
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    menu.classList.toggle("is-open", open);
    menuBackdrop.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", !open);
    menu.inert = !open;
    if (open) {
      // Warna kartu menu mengikuti navbar: navbar hitam → kartu hitam; navbar off-white / hero → kartu off-white
      menu.dataset.tone = ["light", "beige"].includes(header.dataset.theme) ? "dark" : "light";
      lockScroll();
      menu.querySelector(".mm-close").focus({ preventScroll: true });
    } else {
      unlockScroll();
      onScroll();
      toggle.focus({ preventScroll: true });
    }
  };
  toggle.addEventListener("click", () => setMenu(!isMenuOpen()));
  // Tutup tanpa tombol: tap area gelap, tombol Esc, atau geser panel ke atas
  menuBackdrop.addEventListener("click", () => setMenu(false));
  menu.querySelector(".mm-close").addEventListener("click", () => setMenu(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isMenuOpen()) setMenu(false); });
  let swipeY = null;
  menu.addEventListener("touchstart", (e) => { swipeY = e.touches[0].clientY; }, { passive: true });
  menu.addEventListener("touchend", (e) => {
    if (swipeY !== null && swipeY - e.changedTouches[0].clientY > 50) setMenu(false); // geser ke atas
    swipeY = null;
  }, { passive: true });
  // Menu ditutup dulu (kunci scroll dilepas); lompatan ke section ditangani handler anchor di bawah
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  // Tutup menu bila layar diputar / diperlebar ke ukuran desktop
  matchMedia("(min-width: 1024px)").addEventListener?.("change", (e) => e.matches && setMenu(false));

  // ---------- Link antar-section tanpa "#" di URL ----------
  // Scroll halus ke section, alamat tetap bersih: darcasual.vercel.app (bukan …/#tentang)
  const cleanUrl = () => history.replaceState(null, "", location.pathname + location.search);
  const scrollToHash = (hash, smooth = true) => {
    const target = hash === "#top" ? document.body : document.querySelector(hash);
    if (!target) return false;
    if (hash === "#top") window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    else target.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    return true;
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute("href");
    if (hash.length < 2) return;
    if (scrollToHash(hash)) {
      e.preventDefault();
      cleanUrl();
    }
  });
  // Bila halaman dibuka dengan link lama (…/#katalog), tetap lompat ke section lalu bersihkan URL
  if (location.hash.length > 1) {
    const h = location.hash;
    setTimeout(() => { scrollToHash(h, false); cleanUrl(); }, 60);
  }

  // ---------- Marquee keunggulan (kanan → kiri) ----------
  // Isi digandakan sampai satu grup lebih lebar dari layar, lalu grup di-clone sekali.
  // Animasi menggeser -50% (= tepat satu grup), jadi loop selalu mulus di layar selebar apa pun.
  const marquee = document.querySelector(".marquee");
  if (marquee) {
    const track = marquee.querySelector(".marquee-track");
    const base = track.querySelector(".marquee-group");
    const items = [...base.children].map((li) => li.textContent);
    const build = () => {
      track.querySelectorAll(".marquee-group:not(:first-child)").forEach((g) => g.remove());
      base.querySelectorAll("li[aria-hidden]").forEach((li) => li.remove());
      const target = Math.max(window.innerWidth, screen.width || 0) + 200;
      for (let i = 0; base.scrollWidth < target && i < 30; i++) {
        items.forEach((t) => {
          const li = document.createElement("li");
          li.textContent = t;
          li.setAttribute("aria-hidden", "true");
          base.appendChild(li);
        });
      }
      const clone = base.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
      const PX_PER_SEC = window.innerWidth < 768 ? 40 : 60;
      marquee.style.setProperty("--marquee-dur", `${(base.scrollWidth / PX_PER_SEC).toFixed(1)}s`);
      marquee.classList.add("is-ready");
    };
    build();
    let rt;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(build, 250);
    });
  }

  // ---------- Animasi muncul saat scroll ----------
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(
        (entries) =>
          entries.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("is-in");
              io.unobserve(en.target);
            }
          }),
        { threshold: 0.08, rootMargin: "0px 0px -24px 0px" }
      )
    : null;

  function observeReveals(scope = document) {
    scope.querySelectorAll(".reveal:not(.is-in)").forEach((el) => (io ? io.observe(el) : el.classList.add("is-in")));
  }

  apply();
  // Hero langsung tampil saat halaman dibuka (bertahap), tidak menunggu scroll.
  document.querySelectorAll(".hero .reveal").forEach((el, i) => {
    el.style.transitionDelay = `${120 + i * 110}ms`;
    requestAnimationFrame(() => el.classList.add("is-in"));
  });
  observeReveals();
})();
