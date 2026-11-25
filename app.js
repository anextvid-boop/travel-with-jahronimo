// Travel With Jahronimo — Main Application Controller
(function () {
  "use strict";

  const ADMIN_EMAIL = "jahronimo1@hotmail.com";
  const ADMIN_HASH = "a1b537b10d5d1d0fa6643a0ff091d29389ce71538cbfc4a409b1474a0d1fdc14";
  const WA_BASE = "https://wa.me/447538068550";

  let currentLang = "en";
  let mapApi = null;
  let routeData = null;

  // 1. Launch Intro Controller (runs on every launch, skip anytime)
  function initLaunchIntro() {
    const intro = document.getElementById("launchIntro");
    const skipBtn = document.getElementById("skipIntroBtn");
    if (!intro) return;

    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      intro.classList.add("is-done");
      return;
    }

    let closed = false;
    function closeIntro(withSound) {
      if (closed) return;
      closed = true;
      if (withSound) window.SFX?.open?.();
      intro.classList.add("is-done");
      setTimeout(() => {
        intro.style.display = "none";
      }, 480);
    }

    skipBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeIntro(true);
    });
    intro.addEventListener("click", () => closeIntro(true));
    setTimeout(() => closeIntro(false), 2100);
  }

  // 2. Language & Live Date
  function updateLiveDate() {
    const dict = (window.TRANSLATIONS && (window.TRANSLATIONS[currentLang] || window.TRANSLATIONS.en)) || { locale: "en-GB" };
    const el = document.getElementById("liveDateText");
    if (!el) return;
    const now = new Date();
    try {
      el.textContent = now.toLocaleDateString(dict.locale || "en-GB", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric"
      });
    } catch (e) {
      el.textContent = now.toDateString();
    }
  }

  function applyLanguage(langCode) {
    const T = window.TRANSLATIONS || {};
    currentLang = T[langCode] ? langCode : "en";
    const dict = T[currentLang];
    if (!dict) return;

    document.documentElement.lang = currentLang;
    document.documentElement.dir = dict.dir || "ltr";

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && dict[key]) {
        el.textContent = dict[key];
      }
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (key && dict[key]) {
        el.setAttribute("placeholder", dict[key]);
      }
    });

    const label = document.getElementById("currentLangLabel");
    if (label && dict.code) label.textContent = dict.code;

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-lang") === currentLang);
    });

    try {
      localStorage.setItem("twj_lang", currentLang);
    } catch (e) {}
    updateLiveDate();
  }

  function initLanguageModal() {
    const modal = document.getElementById("langModal");
    const openBtn = document.getElementById("openLangBtn");
    const closeBtn = document.getElementById("closeLangBtn");

    function openModal() {
      window.SFX?.open?.();
      modal?.classList.add("open");
    }
    function closeModal() {
      window.SFX?.close?.();
      modal?.classList.remove("open");
    }

    openBtn?.addEventListener("click", openModal);
    closeBtn?.addEventListener("click", closeModal);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.SFX?.tap?.();
        const lang = btn.getAttribute("data-lang") || "en";
        applyLanguage(lang);
        closeModal();
      });
    });

    let savedLang = null;
    try {
      savedLang = localStorage.getItem("twj_lang");
    } catch (e) {}

    if (savedLang && window.TRANSLATIONS?.[savedLang]) {
      applyLanguage(savedLang);
    } else {
      applyLanguage("en");
      // Startup prompt on first visit after launch intro settles
      setTimeout(() => {
        if (modal && !localStorage.getItem("twj_lang")) {
          modal.classList.add("open");
        }
      }, 2350);
    }
  }

  // 3. Route Data Loader (stops.json + localStorage twj_route_override from admin.html)
  async function loadRouteData() {
    let baseData = null;
    try {
      const res = await fetch("data/stops.json?v=" + Date.now());
      if (res.ok) baseData = await res.json();
    } catch (e) {}

    if (!baseData) {
      baseData = {
        currentStopKey: "brighton",
        nextStopKey: "malaga",
        countriesVisited: 2,
        countriesGoal: 13,
        stops: [
          { key: "brighton", label: "Brighton, UK", country: "United Kingdom", coords: [-0.1372, 50.8225], status: "current", dates: "Home Base", notes: "Starting point on the UK South Coast." },
          { key: "malaga", label: "Málaga, Spain", country: "Spain", coords: [-4.4214, 36.7213], status: "next", dates: "Dec 2026", targetIso: "2026-12-01T09:00:00Z", notes: "Costa del Sol house sitting & remote work." }
        ],
        connectSheet: []
      };
    }

    try {
      const overrideRaw = localStorage.getItem("twj_route_override");
      if (overrideRaw) {
        const override = JSON.parse(overrideRaw);
        if (override && Array.isArray(override.stops)) {
          baseData = { ...baseData, ...override };
        }
      }
    } catch (e) {}

    routeData = baseData;
    renderRouteUI(routeData);
    mapApi = window.initTravelMap?.(routeData) || null;
  }

  function renderRouteUI(data) {
    const stops = Array.isArray(data.stops) ? data.stops : [];
    const cur = stops.find((s) => s.key === data.currentStopKey) || stops.find((s) => s.status === "current") || stops[0];
    const nxt = stops.find((s) => s.key === data.nextStopKey) || stops.find((s) => s.status === "next") || stops[1];

    const nowEl = document.getElementById("whereNowText");
    const nextEl = document.getElementById("whereNextText");
    if (nowEl && cur) nowEl.textContent = cur.label;
    if (nextEl && nxt) nextEl.textContent = `${nxt.label} (${nxt.dates || "Soon"})`;

    // 2027 13-Country Progress Bar
    const visited = Number(data.countriesVisited) || 2;
    const goal = Number(data.countriesGoal) || 13;
    const pct = Math.max(8, Math.min(100, Math.round((visited / goal) * 100)));
    const progText = document.getElementById("countriesProgressText");
    const progFill = document.getElementById("countriesProgressFill");
    if (progText) progText.textContent = `${visited} / ${goal} Countries`;
    if (progFill) progFill.style.width = `${pct}%`;

    // Stop Pills
    const pillsWrap = document.getElementById("stopPills");
    if (pillsWrap) {
      pillsWrap.innerHTML = "";
      stops.forEach((stop) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "stop-pill tap-fx" + (stop.key === data.currentStopKey ? " active" : "");
        btn.dataset.stop = stop.key;
        const icon = stop.status === "current" ? "📍" : stop.status === "next" ? "🧭" : stop.status === "visited" ? "✅" : "🗺️";
        btn.textContent = `${icon} ${stop.label}`;
        btn.addEventListener("click", () => {
          window.SFX?.tap?.();
          mapApi?.flyToStop?.(stop.key);
        });
        pillsWrap.appendChild(btn);
      });
    }

    // Live Countdowns
    const cdGrid = document.getElementById("countdownGrid");
    if (cdGrid) {
      const targetStops = stops.filter((s) => s.targetIso).slice(0, 4);
      cdGrid.innerHTML = targetStops
        .map((s) => {
          const diffMs = Math.max(0, new Date(s.targetIso).getTime() - Date.now());
          const days = Math.floor(diffMs / 86400000);
          const hrs = Math.floor((diffMs % 86400000) / 3600000);
          return `
            <div class="cd-card tap-fx" data-stop-jump="${s.key}">
              ${s.photo ? `<img class="cd-photo" src="${s.photo}" alt="${s.label}" loading="lazy" />` : ""}
              <div class="cd-top">
                <div class="cd-place">${s.label}</div>
                <div class="cd-target">${s.dates || ""}</div>
              </div>
              <div class="cd-timer">${days}d ${hrs}h</div>
            </div>
          `;
        })
        .join("");

      cdGrid.querySelectorAll("[data-stop-jump]").forEach((card) => {
        card.addEventListener("click", () => {
          window.SFX?.tap?.();
          const key = card.getAttribute("data-stop-jump");
          document.getElementById("sec-map")?.scrollIntoView({ behavior: "smooth" });
          setTimeout(() => mapApi?.flyToStop?.(key), 400);
        });
      });
    }

    // Global Connect Sheet
    const connectGrid = document.getElementById("connectGrid");
    if (connectGrid && Array.isArray(data.connectSheet)) {
      connectGrid.innerHTML = data.connectSheet
        .map((item) => {
          const waHref = `${WA_BASE}?text=${encodeURIComponent(item.waText || "Hi Jahronimo! Connecting from your travel page.")}`;
          return `
            <article class="connect-card tap-fx">
              <div class="connect-region">${item.region}</div>
              <div class="connect-when">${item.when || ""}</div>
              <p class="connect-focus">${item.focus || ""}</p>
              <div class="connect-actions">
                <a class="btn btn-teal btn-sm tap-fx" href="${waHref}" target="_blank" rel="noopener">WhatsApp</a>
                <a class="btn btn-outline btn-sm tap-fx" href="mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent("Connect: " + item.region)}">Email</a>
              </div>
            </article>
          `;
        })
        .join("");
    }
  }

  // 4. Photo Lightbox
  function initPhotoLightbox() {
    const lb = document.getElementById("photoLightbox");
    const lbImg = document.getElementById("lightboxImg");
    const lbCap = document.getElementById("lightboxCaption");
    const lbClose = document.getElementById("lightboxClose");
    if (!lb || !lbImg) return;

    const strip = document.getElementById("photoScrollStrip");
    document.getElementById("photoPrevBtn")?.addEventListener("click", () => {
      window.SFX?.tap?.();
      strip?.scrollBy({ left: -240, behavior: "smooth" });
    });
    document.getElementById("photoNextBtn")?.addEventListener("click", () => {
      window.SFX?.tap?.();
      strip?.scrollBy({ left: 240, behavior: "smooth" });
    });

    document.getElementById("heroAvatarBtn")?.addEventListener("click", () => {
      const heroImg = document.querySelector("#heroAvatarBtn img");
      if (!heroImg) return;
      window.SFX?.open?.();
      lbImg.src = heroImg.src;
      lbImg.alt = heroImg.alt || "";
      if (lbCap) lbCap.textContent = "Jahronimo — Explorer Edition (Brighton, UK)";
      lb.classList.add("open");
    });

    document.querySelectorAll(".photo-item img").forEach((img) => {
      img.addEventListener("click", () => {
        window.SFX?.open?.();
        lbImg.src = img.src;
        lbImg.alt = img.alt || "";
        if (lbCap) lbCap.textContent = img.getAttribute("data-caption") || img.alt || "";
        lb.classList.add("open");
      });
    });

    function closeLb() {
      window.SFX?.close?.();
      lb.classList.remove("open");
    }

    lbClose?.addEventListener("click", closeLb);
    lb.addEventListener("click", (e) => {
      if (e.target === lb) closeLb();
    });
  }

  // 5. Focus Window Blurred Modal for 8 Visual-Button Cards
  function initFocusModal() {
    const backdrop = document.getElementById("focusBackdrop");
    const titleEl = document.getElementById("focusTitle");
    const bodyEl = document.getElementById("focusBody");
    const closeBtn = document.getElementById("focusCloseBtn");
    if (!backdrop || !bodyEl) return;

    function closeFocus() {
      window.SFX?.close?.();
      backdrop.classList.remove("open");
      document.body.style.overflow = "";
    }

    closeBtn?.addEventListener("click", closeFocus);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeFocus();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && backdrop.classList.contains("open")) closeFocus();
    });

    document.querySelectorAll("details.acc-card").forEach((details) => {
      const summary = details.querySelector("summary");
      const content = details.querySelector(".acc-body");
      if (!summary || !content) return;

      summary.addEventListener("click", (e) => {
        e.preventDefault();
        details.open = false;
        window.SFX?.open?.();
        const hTitle = summary.querySelector(".vbtn-title")?.textContent || "Details";
        if (titleEl) titleEl.textContent = hTitle;
        bodyEl.innerHTML = content.innerHTML;
        const winCard = backdrop.querySelector(".focus-window-card");
        if (winCard) winCard.scrollTop = 0;
        backdrop.classList.add("open");
        document.body.style.overflow = "hidden";
      });
    });

    document.getElementById("openAboutHeroBtn")?.addEventListener("click", () => {
      const firstSummary = document.querySelector("#sec-info details.acc-card summary");
      firstSummary?.click();
    });
  }

  // 6. 5-Star Rating
  function initStarRating() {
    const row = document.getElementById("starRateRow");
    const msg = document.getElementById("starRateMsg");
    if (!row) return;

    const buttons = row.querySelectorAll(".star-btn");
    function paint(val) {
      buttons.forEach((b) => {
        const v = Number(b.dataset.star || 0);
        b.classList.toggle("is-lit", v <= val);
      });
    }

    let saved = 0;
    try {
      saved = Number(localStorage.getItem("twj_rating") || 0);
    } catch (e) {}
    if (saved) {
      paint(saved);
      if (msg) msg.textContent = `Thanks! You rated this ${saved}/5 ★`;
    }

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        window.SFX?.success?.();
        const val = Number(btn.dataset.star || 5);
        paint(val);
        if (msg) msg.textContent = `Thanks! Rated ${val}/5 ★`;
        try {
          localStorage.setItem("twj_rating", String(val));
        } catch (e) {}
      });
    });
  }

  // 7. WhatsApp Custom Message + Topic Pills -> Syncs ONLY Pinned Bottom-Right WA Button
  function initWhatsAppSync() {
    const input = document.getElementById("waCustomMsg");
    const pinnedWa = document.getElementById("pinnedWaBtn");
    const sendBtn = document.getElementById("sendWaCustomBtn");

    function updateWaHref(text) {
      const msg = (text || "").trim() || "Hi Jahronimo! I saw Travel With Jahronimo and want to connect.";
      const url = `${WA_BASE}?text=${encodeURIComponent(msg)}`;
      if (pinnedWa) pinnedWa.href = url;
      if (sendBtn) sendBtn.href = url;
    }

    input?.addEventListener("input", () => updateWaHref(input.value));
    document.querySelectorAll(".wa-topic-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        window.SFX?.tap?.();
        const msg = pill.getAttribute("data-wa-msg") || pill.textContent;
        if (input) input.value = msg;
        updateWaHref(msg);
      });
    });

    updateWaHref(input?.value);
  }

  // 8. Admin Login Modal (SHA-256 + Show/Hide Passcode)
  async function sha256Hex(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function initAuthModal() {
    const modal = document.getElementById("authModal");
    const openBtn = document.getElementById("authQuickBtn");
    const closeBtn = document.getElementById("authCloseBtn");
    const form = document.getElementById("authLoginForm");
    const passInput = document.getElementById("authPassInput");
    const togglePassBtn = document.getElementById("togglePassVisBtn");
    const statusEl = document.getElementById("authStatusMsg");

    function openAuth() {
      window.SFX?.open?.();
      modal?.classList.add("open");
      setTimeout(() => passInput?.focus(), 100);
    }
    function closeAuth() {
      window.SFX?.close?.();
      modal?.classList.remove("open");
    }

    openBtn?.addEventListener("click", openAuth);
    closeBtn?.addEventListener("click", closeAuth);
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) closeAuth();
    });

    togglePassBtn?.addEventListener("click", () => {
      if (!passInput) return;
      const isHidden = passInput.type === "password";
      passInput.type = isHidden ? "text" : "password";
      togglePassBtn.textContent = isHidden ? "🙈" : "👁️";
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const emailVal = (document.getElementById("authEmailInput")?.value || "").trim().toLowerCase();
      const passVal = (passInput?.value || "").trim();
      if (!passVal) return;

      const digest = await sha256Hex(passVal);
      if (emailVal === ADMIN_EMAIL && digest === ADMIN_HASH) {
        window.SFX?.success?.();
        try {
          sessionStorage.setItem("twj_admin_auth", "1");
          localStorage.setItem("twj_admin_auth", "1");
        } catch (err) {}
        if (statusEl) {
          statusEl.textContent = "✅ Unlocked! Opening Admin Panel…";
          statusEl.style.color = "#15803d";
        }
        setTimeout(() => {
          window.location.href = "admin.html";
        }, 450);
      } else {
        window.SFX?.close?.();
        if (statusEl) {
          statusEl.textContent = "❌ Incorrect email or passcode.";
          statusEl.style.color = "#b91c1c";
        }
      }
    });
  }

  // 9. Scroll Reveals, Panel Rail & Tactile Tap Light-Up
  function initMotionAndNav() {
    // 3-Bar Hamburger Dropdown Fast-Jump Menu
    const menuBtn = document.getElementById("navMenuBtn");
    const menuDrop = document.getElementById("navMenuDropdown");
    menuBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      window.SFX?.tap?.();
      const open = menuDrop?.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav-jump-btn[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.SFX?.tap?.();
        menuDrop?.classList.remove("open");
        menuBtn?.setAttribute("aria-expanded", "false");
        const target = document.getElementById(btn.getAttribute("data-jump"));
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    document.addEventListener("click", (e) => {
      if (menuDrop?.classList.contains("open") && !menuDrop.contains(e.target) && e.target !== menuBtn) {
        menuDrop.classList.remove("open");
        menuBtn?.setAttribute("aria-expanded", "false");
      }
    });

    // Top Tab Bar smooth scroll
    document.querySelectorAll(".tab-btn[data-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        window.SFX?.tap?.();
        const target = document.getElementById(btn.getAttribute("data-target"));
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    // Panel Rail Dots
    const railDots = document.querySelectorAll(".rail-dot[data-target]");
    railDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        window.SFX?.tap?.();
        const target = document.getElementById(dot.getAttribute("data-target"));
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    const sections = ["sec-hero", "sec-photos", "sec-map", "sec-info", "sec-connect"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if ("IntersectionObserver" in window) {
      const revObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) entry.target.classList.add("is-visible");
          });
        },
        { threshold: 0.08 }
      );
      document.querySelectorAll(".reveal").forEach((el) => revObs.observe(el));

      const railObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.id;
              railDots.forEach((d) => d.classList.toggle("active", d.getAttribute("data-target") === id));
              document.querySelectorAll(".tab-btn").forEach((t) => {
                t.classList.toggle("active", t.getAttribute("data-target") === id);
              });
            }
          });
        },
        { rootMargin: "-35% 0px -45% 0px" }
      );
      sections.forEach((s) => railObs.observe(s));
    } else {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    }

    // Tactile tap light-up on pointerdown
    document.addEventListener("pointerdown", (e) => {
      const fx = e.target.closest(".tap-fx");
      if (!fx) return;
      fx.classList.add("is-lit");
      setTimeout(() => fx.classList.remove("is-lit"), 240);
    });
  }

  // Boot
  document.addEventListener("DOMContentLoaded", () => {
    initLaunchIntro();
    initLanguageModal();
    initPhotoLightbox();
    initFocusModal();
    initStarRating();
    initWhatsAppSync();
    initAuthModal();
    initMotionAndNav();
    loadRouteData();
  });
})();
