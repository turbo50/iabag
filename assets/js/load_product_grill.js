async function fetchProducts() {
    const url = "https://api.iabag.fr/products"; // Ton endpoint API
    const res = await fetch(url);
    const data = await res.json();

    window.PRODUCTS = data; // liste complète disponible partout

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
    colors.forEach(color => {
        const li = document.createElement("li");
        li.textContent = color; // Tu peux améliorer plus tard (swatches)
        container.appendChild(li);
    });
}

function applyDynamicLists(card, product) {
    // Tous les éléments dans le bloc produit ayant l'attribut data-colors
    const colorLists = card.querySelectorAll("[data-colors]");

    colorLists.forEach(list => {
        const key = list.getAttribute("data-colors").replace("$", "");
        const colors = product[key] || [];
        fillColorList(list, colors);
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

        // 3️⃣ ajouter dans la grille
        grid.appendChild(card);
    });
}

document.addEventListener("DOMContentLoaded", renderProductGrid);

