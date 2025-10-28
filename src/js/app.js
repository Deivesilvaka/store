// app.js — versão corrigida com busca acento-insensível e suporte a imagens locais
// Carrega src/db/products.json, renderiza cards e implementa busca + tentativa de extrair meta info do link
// Coloque window.CONFIG.CORS_PROXY = 'https://api.allorigins.win/raw?url=' em index.html se quiser usar proxy.

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const resultsEl = document.getElementById("results");
    const searchInput = document.getElementById("search");

    let PRODUCTS = [];

    // Função para normalizar strings (remove acentos e ignora maiúsculas/minúsculas)
    function normalizeString(str) {
      return (str || "")
        .normalize("NFD") // separa acentos
        .replace(/\p{Diacritic}/gu, "") // remove acentuação
        .toLowerCase();
    }

    // Carrega lista de produtos
    async function loadProducts() {
      try {
        const res = await fetch("src/db/products.json", { cache: "no-store" });
        if (!res.ok)
          throw new Error("Erro ao carregar products.json: " + res.status);
        PRODUCTS = await res.json();
      } catch (err) {
        console.error("Erro ao carregar products.json", err);
        PRODUCTS = [];
      }
    }

    // Placeholder padrão enquanto carrega imagem
    function makeThumbPlaceholder(text) {
      const placeholder = document.createElement("div");
      placeholder.className = "thumb";
      placeholder.textContent = text;
      return placeholder;
    }

    // Cria o card de produto
    function createCard(product) {
      const el = document.createElement("article");
      el.className = "card";

      const thumb = makeThumbPlaceholder("Carregando imagem...");
      const title = document.createElement("h3");
      title.textContent = product.name || "Produto sem nome";

      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = product.store || "";

      const actions = document.createElement("div");
      actions.className = "actions";

      const link = document.createElement("a");
      link.className = "btn btn-primary";
      link.href = product.link || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Ver na Shopee";

      const btn2 = document.createElement("a");
      btn2.className = "btn btn-outline";
      btn2.href = "#";
      btn2.textContent = "Detalhes";
      btn2.addEventListener("click", (e) => {
        e.preventDefault();
        alert(
          (product.name || "Produto") + "\n" + (product.link || "Sem link")
        );
      });

      actions.appendChild(link);
      actions.appendChild(btn2);

      el.appendChild(thumb);
      el.appendChild(title);
      el.appendChild(meta);
      el.appendChild(actions);

      // Exibe imagem local, se disponível
      if (product.image) {
        const img = document.createElement("img");
        img.className = "thumb-img";
        img.alt = product.name || "Produto";
        img.style.width = "100%";
        img.style.height = "160px";
        img.style.objectFit = "cover";
        img.src = "src/img/" + product.image;
        thumb.textContent = "";
        thumb.appendChild(img);
      } else {
        // Se não houver imagem local, tenta pegar via meta tags (SEO)
        fetchSeoMeta(product.link)
          .then((data) => {
            if (data && data.image) {
              const img = document.createElement("img");
              img.className = "thumb-img";
              img.alt = product.name || "Produto";
              img.style.width = "100%";
              img.style.height = "160px";
              img.style.objectFit = "cover";
              try {
                const imgUrl = new URL(data.image, product.link).href;
                img.src = imgUrl;
              } catch {
                img.src = data.image;
              }
              thumb.textContent = "";
              thumb.appendChild(img);
            } else {
              thumb.textContent = "Sem imagem (uso manual)";
            }

            if (data && data.price) {
              const p = document.createElement("div");
              p.className = "meta";
              p.textContent = "Preço (capturado): " + data.price;
              el.insertBefore(p, actions);
            }
          })
          .catch((err) => {
            console.warn(
              "Não foi possível obter meta do link (CORS ou erro):",
              err
            );
            thumb.textContent = "Imagem indisponível (CORS)";
          });
      }

      return el;
    }

    // Captura meta tags de imagem, descrição e preço (caso queira SEO info da Shopee)
    async function fetchSeoMeta(url) {
      if (!url) return null;
      try {
        const proxy =
          window.CONFIG && window.CONFIG.CORS_PROXY
            ? window.CONFIG.CORS_PROXY
            : "";
        const target = proxy ? proxy + encodeURIComponent(url) : url;
        const r = await fetch(target, { method: "GET" });
        if (!r.ok) throw new Error("fetch erro " + r.status);
        const text = await r.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");

        const metas = {};

        const pickContent = (selectorList) => {
          for (const sel of selectorList) {
            const node = doc.querySelector(sel);
            if (node) {
              return (
                node.getAttribute("content") ||
                node.getAttribute("value") ||
                node.textContent ||
                null
              );
            }
          }
          return null;
        };

        metas.image = pickContent([
          'meta[property="og:image"]',
          'meta[name="og:image"]',
          'meta[name="twitter:image"]',
          'meta[property="twitter:image"]',
          'link[rel="image_src"]',
        ]);

        metas.price = pickContent([
          'meta[property="product:price:amount"]',
          'meta[property="og:price:amount"]',
          'meta[name="twitter:data1"]',
          'meta[itemprop="price"]',
        ]);

        metas.description = pickContent([
          'meta[property="og:description"]',
          'meta[name="description"]',
          'meta[name="twitter:description"]',
        ]);

        return metas;
      } catch (err) {
        throw err;
      }
    }

    // Renderiza os produtos
    function render(list) {
      resultsEl.innerHTML = "";
      if (!Array.isArray(list) || list.length === 0) {
        resultsEl.innerHTML =
          '<p class="footer-note">Nenhum produto encontrado.</p>';
        return;
      }
      const fragment = document.createDocumentFragment();
      for (const p of list) {
        fragment.appendChild(createCard(p));
      }
      resultsEl.appendChild(fragment);
    }

    // Aplica filtro de busca com normalização
    function applyFilter(q) {
      const query = normalizeString(q);
      if (!query) {
        render(PRODUCTS);
        return;
      }
      const filtered = PRODUCTS.filter((p) =>
        normalizeString(p.name).includes(query)
      );
      render(filtered);
    }

    // Eventos
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        applyFilter(e.target.value);
      });
    }

    // Inicialização
    (async function init() {
      await loadProducts();
      render(PRODUCTS);
    })();
  });
})();
