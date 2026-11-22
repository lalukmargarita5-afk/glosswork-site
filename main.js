(() => {
  // Заявки уходят в Google Apps Script: строка в Google Таблице + письмо на почту (код: google-script-zayavki.gs)
  const LEAD_ENDPOINT = "https://script.google.com/macros/s/AKfycbwqrGymk0LtAsOtFy1lLtXBZoj1ME-voMLHkBuqMidM1uhoJOCVn5CgC0buSQ-qDF1sjQ/exec";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- Text roll: split labels into letters ---------- */
  document.querySelectorAll("[data-roll]").forEach((el) => {
    const text = el.textContent;
    const host = el.closest("a, button");
    let labelled = false;
    if (host && !host.hasAttribute("aria-label") && host.textContent.trim() === text.trim()) {
      host.setAttribute("aria-label", text.trim());
      labelled = true;
    }
    el.textContent = "";
    el.classList.add("roll");
    if (!labelled) {
      const sr = document.createElement("span");
      sr.className = "sr";
      sr.textContent = text;
      el.before(sr);
    }
    el.setAttribute("aria-hidden", "true");
    [...text].forEach((ch, i) => {
      const s = document.createElement("span");
      s.className = "roll__ch";
      s.style.setProperty("--i", i);
      s.textContent = ch;
      el.append(s);
    });
  });

  /* ---------- Light tunnel (projected 3D bars) ---------- */
  const hero = document.querySelector(".hero");
  const svg = document.querySelector(".tunnel");
  const group = svg.querySelector("#bars");
  const grad = svg.querySelector("#tg");
  const NS = "http://www.w3.org/2000/svg";

  const N = 18;
  const spacing = 0.62;
  const span = N * spacing;
  const NEAR = 1.5;
  const CEIL = [[-1.55, -0.58], [-0.46, 0.46], [0.58, 1.55]];
  const quads = [];
  for (let k = 0; k < N; k++) {
    const base = k * spacing;
    const add = (pts, kind) => quads.push({ base, pts, kind });
    // ceiling: three panels of transverse bars
    CEIL.forEach(([x0, x1]) => add([[x0, 1, 0], [x1, 1, 0], [x1, 1, 0.15], [x0, 1, 0.15]], 1));
    // walls: vertical bars
    [-1.7, 1.7].forEach((x) => add([[x, -0.82, 0], [x, 0.86, 0], [x, 0.86, 0.15], [x, -0.82, 0.15]], 1));
    // glossy floor (y = -0.95): mirrored wall and ceiling bars
    [-1.7, 1.7].forEach((x) => add([[x, -1.08, 0], [x, -2.76, 0], [x, -2.76, 0.15], [x, -1.08, 0.15]], 0.3));
    CEIL.forEach(([x0, x1]) => add([[x0, -2.9, 0], [x1, -2.9, 0], [x1, -2.9, 0.15], [x0, -2.9, 0.15]], 0.2));
  }
  const polys = quads.map((q) => {
    const p = document.createElementNS(NS, "polygon");
    group.append(p);
    return p;
  });

  const SHIFT_X = 34, SHIFT_Y = 14; // px the box and the car move together at the edge of the screen
  let W = 0, H = 0, heroH = 1;
  function sizeTunnel() {
    const r = hero.getBoundingClientRect();
    W = r.width; H = r.height; heroH = H;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    grad.setAttribute("y2", H);
  }
  // mx,my: pointer parallax (-1..1); off: how far the camera has travelled down the tunnel
  function drawTunnel(mx, my, off) {
    const f = Math.max(H * 0.82, W * 0.42);
    // the whole box shifts with the pointer by the same amount as the car, so the car stays fixed in it
    const cx = W / 2 + mx * SHIFT_X;
    const cy = H * 0.5 + my * SHIFT_Y;
    const camX = 0, camY = 0;
    quads.forEach((q, i) => {
      const zk = NEAR + ((((q.base - off) % span) + span) % span);
      const depth = Math.max(0, 1 - (zk - NEAR) / 11);
      const fade = Math.min(1, (NEAR + span - zk) / 1.8) * Math.min(1, (zk - NEAR) / 0.5 + 0.1);
      let s = "";
      for (const [x, y, dz] of q.pts) {
        const z = zk + dz;
        s += `${(cx + (f * (x - camX)) / z).toFixed(1)},${(cy - (f * (y - camY)) / z).toFixed(1)} `;
      }
      polys[i].setAttribute("points", s);
      polys[i].setAttribute("opacity", (q.kind * (0.4 + 0.6 * depth) * fade).toFixed(3));
    });
  }

  /* ---------- Motion loop: pointer parallax + scroll depth ---------- */
  const car = document.querySelector("[data-car]");
  const title = document.querySelector(".hero__title");
  const fadeOnScroll = [...document.querySelectorAll(".hero__side, .amen")];
  const wideHero = matchMedia("(min-width: 1181px)");
  const gf = document.querySelector(".gf");
  const motion = !reduceMotion;
  const st = { tx: 0, ty: 0, cx: 0, cy: 0, ts: 0, cs: 0, gx: 0, gy: 0, tgx: 0, tgy: 0 };
  let raf = 0;
  // ambient life on the first screen: the tunnel keeps flowing slowly, and on touch screens
  // (no pointer to follow) the car and the walls sway gently together
  let idle = 0, lastT = 0, heroOn = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => { heroOn = en.isIntersecting; if (heroOn) kick(); }).observe(hero);
  }

  function frame(now = performance.now()) {
    raf = 0;
    const dt = lastT ? Math.min(now - lastT, 50) : 16;
    lastT = now;
    const ambient = motion && heroOn;
    if (ambient) {
      idle += dt * 0.00016;
      if (!finePointer) {
        st.tx = Math.sin(now * 0.00042) * 0.5;
        st.ty = Math.sin(now * 0.00029) * 0.3;
      }
    }
    st.cx += (st.tx - st.cx) * 0.08;
    st.cy += (st.ty - st.cy) * 0.08;
    st.cs += (st.ts - st.cs) * 0.12;
    st.gx += (st.tgx - st.gx) * 0.06;
    st.gy += (st.tgy - st.gy) * 0.06;

    const p = clamp(st.cs / heroH, 0, 1.2);
    if (st.cs < heroH * 1.05) {
      drawTunnel(st.cx, st.cy, st.cs * 0.0034 + idle);
      car.style.transform = `translate3d(${st.cx * SHIFT_X}px, ${st.cy * SHIFT_Y + p * 46}px, 0) scale(${1 + p * 0.16})`;
      car.style.setProperty("--refl", st.cx.toFixed(3));
      title.style.transform = `translate3d(${st.cx * -22}px, ${st.cy * -10 - p * 20}px, 0) scale(${1 + p * 0.26})`;
      // side columns fade only where they sit beside the car; on narrow screens they are read while scrolling
      const fade = wideHero.matches ? String(clamp(1 - p * 1.4, 0, 1)) : "";
      fadeOnScroll.forEach((el) => { el.style.opacity = fade; });
    }
    if (gf) {
      gf.style.setProperty("--px", st.gx.toFixed(4));
      gf.style.setProperty("--py", st.gy.toFixed(4));
      gf.style.setProperty("--pz", clamp(1 - Math.hypot(st.gx, st.gy), 0, 1).toFixed(4));
      gf.style.setProperty("--sr", (st.cs * 0.012).toFixed(3));
      gf.style.setProperty("--sc", (1 + Math.min(st.cs, 5000) * 0.00007).toFixed(4));
      // the calligraphy surfaces as the first screen dissolves, so there is no seam between them
      gf.style.setProperty("--gfo", (0.45 + 0.55 * clamp(st.cs / (heroH * 0.75), 0, 1)).toFixed(3));
    }
    const moving = Math.abs(st.tx - st.cx) > 0.001 || Math.abs(st.ty - st.cy) > 0.001
      || Math.abs(st.ts - st.cs) > 0.4 || Math.abs(st.tgx - st.gx) > 0.001 || Math.abs(st.tgy - st.gy) > 0.001;
    if (moving || ambient) raf = requestAnimationFrame(frame);
    else lastT = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  sizeTunnel();
  drawTunnel(0, 0, 0);
  addEventListener("resize", () => { sizeTunnel(); kick(); }, { passive: true });

  if (motion) {
    st.cs = st.ts = scrollY;
    addEventListener("scroll", () => { st.ts = scrollY; updateDepth(); updateStack(); kick(); }, { passive: true });
    kick();
  }
  if (motion && finePointer) {
    hero.addEventListener("pointermove", (e) => {
      st.tx = (e.clientX / innerWidth) * 2 - 1;
      st.ty = (e.clientY / innerHeight) * 2 - 1;
      kick();
    });
    hero.addEventListener("pointerleave", () => { st.tx = 0; st.ty = 0; kick(); });
    // the calligraphy rings follow the pointer anywhere on the page
    addEventListener("pointermove", (e) => {
      st.tgx = (e.clientX / innerWidth) * 2 - 1;
      st.tgy = (e.clientY / innerHeight) * 2 - 1;
      kick();
    }, { passive: true });
  }

  /* ---------- Scroll depth: blocks approach the viewer as they enter ---------- */
  const depthEls = motion
    ? [...document.querySelectorAll("[data-depth], .services .wrap, .process .wrap > .h2, .process .section__lede, .steps, .booking__copy, .book")]
    : [];
  function updateDepth() {
    const vh = innerHeight;
    depthEls.forEach((el) => {
      const top = el.getBoundingClientRect().top;
      const p = clamp((vh - top) / (vh * 0.5), 0, 1);
      el.style.setProperty("--dp", (1 - (1 - p) * (1 - p)).toFixed(3));
    });
  }
  if (depthEls.length) {
    depthEls.forEach((el) => el.setAttribute("data-depth-on", ""));
    document.documentElement.classList.add("js-depth");
    updateDepth();
    addEventListener("resize", updateDepth, { passive: true });
  }

  /* ---------- Service cards: the next card covers the previous one ---------- */
  const cards = [...document.querySelectorAll(".scard")];
  function updateStack() {
    const vh = innerHeight;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const next = cards[i + 1];
      // how far the next card has slid over this one (0..1)
      const cover = next ? clamp(1 - (next.getBoundingClientRect().top - r.top) / r.height, 0, 1) : 0;
      c.style.setProperty("--cover", cover.toFixed(3));
      // the photo drifts slower than the card while it travels up the screen
      c.style.setProperty("--par", `${(clamp((r.top - vh * 0.2) / vh, -1, 1) * -28).toFixed(1)}px`);
    });
  }
  if (motion && cards.length) { updateStack(); addEventListener("resize", updateStack, { passive: true }); }

  /* ---------- Headlights ---------- */
  const setLit = (on) => {
    car.classList.toggle("is-lit", on);
    if (on) car.classList.add("was-lit");
  };
  if (finePointer) {
    const frameEl = car.querySelector(".car__frame");
    frameEl.addEventListener("pointerenter", () => setLit(true));
    frameEl.addEventListener("pointerleave", () => setLit(false));
  } else {
    const onScroll = () => setLit(scrollY > 4);
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("touchmove", () => setLit(true), { passive: true, once: true });
    // tap the car to switch the lights; and light them once on their own, so nobody misses it
    car.querySelector(".car__frame").addEventListener("click", () => setLit(!car.classList.contains("is-lit")));
    setTimeout(() => { if (!car.classList.contains("was-lit")) setLit(true); }, 1600);
    onScroll();
  }

  /* ---------- Tilt cards (hero amenities) ---------- */
  if (finePointer && motion) {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * 2 - 1;
        const y = ((e.clientY - r.top) / r.height) * 2 - 1;
        el.style.setProperty("--ry", `${(x * 7).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
        el.style.setProperty("--tx", x.toFixed(3));
        el.style.setProperty("--ty", y.toFixed(3));
      });
      el.addEventListener("pointerleave", () => {
        ["--rx", "--ry", "--tx", "--ty"].forEach((v) => el.style.removeProperty(v));
      });
    });
  }

  /* ---------- Lounge scene: parallax layers, lights come on ---------- */
  const scene = document.querySelector("[data-scene]");
  if (scene) {
    if (finePointer) {
      scene.addEventListener("pointerenter", () => scene.classList.add("is-on"));
      scene.addEventListener("pointerleave", () => {
        scene.classList.remove("is-on");
        scene.style.setProperty("--sx", 0);
        scene.style.setProperty("--sy", 0);
      });
      if (motion) {
        scene.addEventListener("pointermove", (e) => {
          const r = scene.getBoundingClientRect();
          scene.style.setProperty("--sx", (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
          scene.style.setProperty("--sy", (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
        });
      }
    } else if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => es.forEach((en) => scene.classList.toggle("is-on", en.isIntersecting)), { threshold: 0.5 }).observe(scene);
    } else {
      scene.classList.add("is-on");
    }
  }

  /* ---------- Process lamps switch on in sequence ---------- */
  const steps = [...document.querySelectorAll(".step")];
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        steps.forEach((s, i) => setTimeout(() => s.classList.add("is-on"), i * 180));
        io.disconnect();
      });
    }, { threshold: 0.45 });
    io.observe(document.querySelector(".steps"));
  } else {
    steps.forEach((s) => s.classList.add("is-on"));
  }

  /* ---------- Services preselect a chip ---------- */
  document.querySelectorAll("a[data-service]").forEach((a) => {
    a.addEventListener("click", () => {
      const box = document.querySelector(`.chips input[value="${a.dataset.service}"]`);
      if (box) box.checked = true;
    });
  });

  /* ---------- Forms ---------- */
  const digits = (v) => v.replace(/\D/g, "");
  function formatPhone(v) {
    let d = digits(v);
    if (!d) return "";
    if (d[0] === "8") d = "7" + d.slice(1);
    if (d[0] !== "7") d = "7" + d;
    d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let out = "+7";
    if (p[0]) out += ` (${p[0]}`;
    if (p[0].length === 3) out += ")";
    if (p[1]) out += ` ${p[1]}`;
    if (p[2]) out += `-${p[2]}`;
    if (p[3]) out += `-${p[3]}`;
    return out;
  }
  document.querySelectorAll('input[type="tel"]').forEach((inp) => {
    inp.addEventListener("input", () => { inp.value = formatPhone(inp.value); });
  });

  function setErr(input, msg, form) {
    input.setAttribute("aria-invalid", msg ? "true" : "false");
    const err = form.querySelector(`#${input.id}-err`);
    if (err) {
      err.textContent = msg;
      if (msg) input.setAttribute("aria-describedby", err.id);
    }
    return !msg;
  }

  /* ---------- «Заявка принята» ---------- */
  const done = document.getElementById("done");
  function openDone(name) {
    const text = done.querySelector(".done__text");
    text.textContent = name ? `Спасибо, ${name}! Мы свяжемся с вами в ближайшее время.` : "Спасибо! Мы свяжемся с вами в ближайшее время.";
    if (typeof done.showModal === "function") done.showModal();
    else { done.setAttribute("open", ""); }
    done.querySelector("[data-close]").focus();
  }
  const closeDone = () => { if (typeof done.close === "function") done.close(); else done.removeAttribute("open"); };
  done.querySelector("[data-close]").addEventListener("click", closeDone);
  // клик по затемнению вокруг окна тоже закрывает
  done.addEventListener("click", (e) => { if (e.target === done) closeDone(); });

  document.querySelectorAll("form[data-form]").forEach((form) => {
    const msg = form.querySelector(".form__msg");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = form.elements.name;
      const phone = form.elements.phone;
      const okName = setErr(name, name.value.trim() ? "" : "Как к вам обращаться?", form);
      const okPhone = setErr(phone, digits(phone.value).length === 11 ? "" : "Нужен номер из 11 цифр, например +7 (912) 345-67-89", form);
      msg.classList.remove("is-error");
      if (!okName || !okPhone) {
        if (form.dataset.form === "quick") {
          msg.textContent = !okName ? "Введите имя" : "Проверьте номер телефона";
          msg.classList.add("is-error");
        } else {
          msg.textContent = "";
        }
        (!okName ? name : phone).focus();
        return;
      }
      const data = Object.fromEntries(new FormData(form));
      data.service = [...form.querySelectorAll('input[name="service"]:checked')].map((i) => i.value);
      data.form = form.dataset.form;
      // ловушка для ботов: людям это поле не видно, бот его заполняет — такую заявку молча пропускаем
      const isBot = Boolean(data.company);
      delete data.company;

      // Куда отправлять заявки: адрес обработчика (Telegram-бот, почта, CRM).
      // Пока пусто — форма честно говорит, что онлайн-запись не подключена.
      if (!LEAD_ENDPOINT) {
        msg.textContent = "Онлайн-запись пока не подключена. Позвоните нам: [телефон]";
        msg.classList.add("is-error");
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      msg.textContent = "Отправляем…";
      let ok = false;
      if (isBot) {
        ok = true;
      } else {
        try {
          // text/plain — так Google Apps Script принимает заявку с любого сайта без лишних проверок браузера
          const res = await fetch(LEAD_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(data),
          });
          const answer = await res.json().catch(() => ({}));
          ok = res.ok && answer.ok === true;
        } catch (_) { ok = false; }
      }
      btn.disabled = false;
      if (!ok) {
        msg.textContent = "Не получилось отправить. Проверьте интернет и попробуйте ещё раз или позвоните нам.";
        msg.classList.add("is-error");
        return;
      }
      // успех: чистим форму и показываем окно «Заявка принята»
      form.reset();
      form.querySelectorAll("[aria-invalid]").forEach((el) => el.setAttribute("aria-invalid", "false"));
      msg.textContent = "";
      openDone(data.name.trim());
    });
  });
})();
