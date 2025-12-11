import { MOCK_PRODUCTS } from "../../data/mock-products.js";
console.log("Mock Fetch chargé");

const USE_LOCAL = true; // passe à false pour retourner sur API Gateway

export async function fetchProducts() {
    if (USE_LOCAL) {
        console.log("➡️ Mock activé : données locales utilisées");
        window.PRODUCTS = MOCK_PRODUCTS;
        return MOCK_PRODUCTS;
    }

    const url = "https://2f0ihly4q7.execute-api.eu-west-3.amazonaws.com/products";
    const res = await fetch(url);
    const data = await res.json();

    window.PRODUCTS = data;
    return data;
}


function fillTemplate(template, product) {
    return template.replace(/\$[a-zA-Z0-9_]+/g, match => {
        const key = match.substring(1); // enlève le $
        return product[key] !== undefined ? product[key] : "";
    });
}

function buildProductHTML(product) {
    const template = document.getElementById("product-template").innerHTML;

    // Remplace toutes les variables $xxx par leurs valeurs
    const filled = fillTemplate(template, product);

    // Convertit le HTML rempli → un vrai DOM Element
    const wrapper = document.createElement("div");
    wrapper.innerHTML = filled.trim();

    return wrapper.firstElementChild;
}

function fillColorList(container, colors) {
    container.innerHTML = "";
   /* colors.forEach(color => {
        const li = document.createElement("li");
        li.textContent = color; // Tu peux améliorer plus tard (swatches)
        container.appendChild(li);
    });*/
    colors.forEach(color => {
           // Selon le format reçu :
           const name = typeof color === "string" ? color : color.name;
           const cssClass = typeof color === "string" ? color.toLowerCase() : color.cssClass;

           const li = document.createElement("li");
           li.className = `medium radius ${cssClass}`;

           li.innerHTML = `
               <span class="swacth-btn"></span>
               <span class="tooltip-label">${name}</span>
           `;

           container.appendChild(li);
       });
}

function applyDynamicLists(card, product) {
    // Tous les éléments dans le bloc produit ayant l'attribut data-colors
    const colorLists = card.querySelectorAll("[data-colors]");

    colorLists.forEach(list => {
        const key = list.getAttribute("data-colors");
        const colors = product[key] || [];
        fillColorList(list, colors);
    });
}

function openQuickView(productId) {
    const product = window.PRODUCTS.find(p => p.code_produit === productId);

    if (!product) {
        console.error("Produit introuvable pour QuickView");
        return;
    }

    fillQuickView(product);

    $.magnificPopup.open({
        items: { src: '#quickView-modal' },
        type: 'inline'
    });
}

function fillQuickView(product) {

    // ---------------------------
    // TITRE, SKU, PRIX
    // ---------------------------
    document.getElementById("qv-title").textContent = product.nom_produit;
    document.getElementById("qv-sku").textContent = product.sku;
    document.getElementById("qv-marque").textContent = product.marque_produit;
    document.getElementById("qv-oldprice").textContent = product.ancien_prix + " €";
    document.getElementById("qv-price").textContent = product.prix_actuel + " €";

    // ---------------------------
    // IMAGES DU CAROUSSEL
    // ---------------------------
    const carousel = document.getElementById("qv-carousel");
    const thumbs = document.getElementById("qv-thumbs");

    carousel.innerHTML = "";
    thumbs.innerHTML = "";

    // Image principale
    const allImages = [product.image_produit, ...(product.autres_images || [])];

    allImages.forEach((imgUrl, index) => {

        // Slide principal
        carousel.innerHTML += `
            <div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img class="blur-up lazyload" src="${imgUrl}" alt="">
            </div>
        `;

        // Miniature
        thumbs.innerHTML += `
            <div class="list-inline-item ${index === 0 ? 'active' : ''}"
                 data-bs-slide-to="${index}" data-bs-target="#quickView">
                <img class="blur-up lazyload" src="${imgUrl}" alt="">
            </div>
        `;
    });

    // ---------------------------
    // COULEURS
    // ---------------------------
    const colorBox = document.getElementById("qv-colors");
    colorBox.innerHTML = "";

    (product.liste_couleur || []).forEach(color => {
        colorBox.innerHTML += `
            <li class="swatch-element color available">
                <label class="rounded-0 swatchLbl small color ${color}" title="${color}"></label>
                <span class="tooltip-label top">${color}</span>
            </li>
        `;
    });
}

function setupQuickViewButtons() {
    document.querySelectorAll("[data-product-id]").forEach(btn => {

        btn.addEventListener("click", () => {
            const productId = btn.getAttribute("data-product-id");
            openQuickView(productId);
        });
    });
}

function renderRatingStars(container, rating) {
    container.innerHTML = ""; // nettoie le contenu

    const fullStars = Math.floor(rating);
    const halfStar = (rating % 1) >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

    // Étoiles pleines
    for (let i = 0; i < fullStars; i++) {
        container.innerHTML += '<i class="an an-star"></i>';
    }

    // Demi-étoile
    if (halfStar) {
        container.innerHTML += '<i class="an an-star-half-o"></i>';
    }

    // Étoiles vides
    for (let i = 0; i < emptyStars; i++) {
        container.innerHTML += '<i class="an an-star-o"></i>';
    }

}

function applyRatingStars(card, product){
    card.querySelectorAll('.product-review').forEach(el => {
        const rating = parseFloat(el.getAttribute("data-rating"));
        if (!isNaN(rating)) {
            renderRatingStars(el, rating);
        }
    });
}

async function renderProductGrid() {
    const products = await fetchProducts();
    const grid = document.getElementById("product-grid");
    products.forEach(product => {
        // 1️⃣ construire le bloc HTML
        const card = buildProductHTML(product);
        // 2️⃣ intégrer les listes dynamiques (ex: liste_couleur)
        applyDynamicLists(card, product);
        //  rating
        applyRatingStars(card, product);
        // 3️⃣ ajouter dans la grille
        grid.appendChild(card);
    });

    // Active les boutons QuickView maintenant que la grille est générée
     setupQuickViewButtons();
}

document.addEventListener("DOMContentLoaded", renderProductGrid);
fetchProducts().then(data => {
    console.log("📦 Données retournées par fetchProducts :", data);
});

