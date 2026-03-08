const USER_KEY = "nexdomus_user";
const CART_KEY = "nexdomus_cart";

function parseJSON(value, fallback) {
  try {
    return JSON.parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function getUser() {
  return parseJSON(localStorage.getItem(USER_KEY), null);
}

function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function getCart() {
  return parseJSON(localStorage.getItem(CART_KEY), []);
}

function setCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

function cartCount() {
  return getCart().reduce((acc, item) => acc + item.qty, 0);
}

function euro(value) {
  return `${value.toFixed(2)} EUR`;
}

function syncCommonUI() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  const counts = document.querySelectorAll(".cart-count");
  counts.forEach((el) => {
    el.textContent = String(cartCount());
  });

  const user = getUser();
  const authLink = document.getElementById("auth-link");
  const logoutBtn = document.getElementById("logout-btn");

  if (authLink) {
    if (user) {
      const firstName = user.name.trim().split(" ")[0];
      authLink.textContent = firstName || "Conta";
      authLink.href = "login.html";
    } else {
      authLink.textContent = "Login";
      authLink.href = "login.html";
    }
  }

  if (logoutBtn) {
    logoutBtn.classList.toggle("hidden", !user);
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem(USER_KEY);
      syncCommonUI();
      alert("Sessao terminada.");
    });
  }
}

function setupHeader() {
  const header = document.getElementById("main-header");
  const menuToggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("main-nav");

  if (header) {
    window.addEventListener("scroll", () => {
      header.classList.toggle("scrolled", window.scrollY > 12);
    });
  }

  if (menuToggle && nav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
      });
    });
  }
}

function setupReveal() {
  const revealElements = document.querySelectorAll(".reveal");
  if (!revealElements.length) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );

    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("visible"));
  }
}

function addProductToCart(product) {
  const user = getUser();
  if (!user) {
    alert("Faz login para adicionar produtos ao carrinho.");
    window.location.href = "login.html?next=loja.html";
    return;
  }

  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  setCart(cart);
  syncCommonUI();
}

function setupStoreButtons() {
  const buttons = document.querySelectorAll("[data-add-to-cart]");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const product = {
        id: btn.dataset.id,
        name: btn.dataset.name,
        price: Number(btn.dataset.price),
      };

      addProductToCart(product);
      btn.textContent = "Adicionado";
      setTimeout(() => {
        btn.textContent = "Adicionar ao carrinho";
      }, 900);
    });
  });
}

function setupLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  const user = getUser();
  if (user) {
    const logged = document.getElementById("login-status");
    if (logged) {
      logged.textContent = `Ja iniciaste sessao como ${user.name}.`;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameInput = document.getElementById("login-name");
    const emailInput = document.getElementById("login-email");

    const userData = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
    };

    if (!userData.name || !userData.email) {
      alert("Preenche nome e email.");
      return;
    }

    setUser(userData);
    syncCommonUI();

    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "loja.html";
    window.location.href = next;
  });
}

function updateQuantity(id, delta) {
  const cart = getCart();
  const item = cart.find((entry) => entry.id === id);
  if (!item) return;
  item.qty += delta;

  const filtered = cart.filter((entry) => entry.qty > 0);
  setCart(filtered);
  renderCart();
  syncCommonUI();
}

function removeItem(id) {
  const cart = getCart().filter((entry) => entry.id !== id);
  setCart(cart);
  renderCart();
  syncCommonUI();
}

function renderCart() {
  const list = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total");
  const emptyEl = document.getElementById("cart-empty");
  const checkoutBtn = document.getElementById("checkout-btn");
  if (!list || !totalEl || !emptyEl || !checkoutBtn) return;

  const cart = getCart();
  list.innerHTML = "";

  if (!cart.length) {
    emptyEl.classList.remove("hidden");
    checkoutBtn.disabled = true;
    totalEl.textContent = euro(0);
    return;
  }

  emptyEl.classList.add("hidden");
  checkoutBtn.disabled = false;

  cart.forEach((item) => {
    const row = document.createElement("article");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <h3>${item.name}</h3>
        <p class="product-code">${euro(item.price)} cada</p>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" data-action="dec" data-id="${item.id}" type="button">-</button>
        <button class="qty-btn" type="button" disabled>${item.qty}</button>
        <button class="qty-btn" data-action="inc" data-id="${item.id}" type="button">+</button>
      </div>
      <div>
        <strong>${euro(item.price * item.qty)}</strong>
        <div><button class="btn danger" data-action="remove" data-id="${item.id}" type="button">Remover</button></div>
      </div>
    `;

    list.appendChild(row);
  });

  const total = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  totalEl.textContent = euro(total);

  list.querySelectorAll("button[data-action]").forEach((btn) => {
    const { action, id } = btn.dataset;
    btn.addEventListener("click", () => {
      if (action === "inc") updateQuantity(id, 1);
      if (action === "dec") updateQuantity(id, -1);
      if (action === "remove") removeItem(id);
    });
  });
}

function setupCheckout() {
  const checkoutBtn = document.getElementById("checkout-btn");
  if (!checkoutBtn) return;

  checkoutBtn.addEventListener("click", () => {
    if (!getUser()) {
      alert("Precisas de login para finalizar a compra.");
      window.location.href = "login.html?next=carrinho.html";
      return;
    }

    if (!getCart().length) {
      alert("Carrinho vazio.");
      return;
    }

    localStorage.removeItem(CART_KEY);
    renderCart();
    syncCommonUI();
    alert("Compra simulada concluida com sucesso.");
  });
}

function init() {
  setupHeader();
  setupReveal();
  syncCommonUI();
  setupStoreButtons();
  setupLoginForm();
  renderCart();
  setupCheckout();
}

init();
