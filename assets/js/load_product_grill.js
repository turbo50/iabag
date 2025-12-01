function fillTemplate(template, data) {
    return template.replace(/\$[a-zA-Z0-9_]+/g, match => {
        const key = match.substring(1);
        return data[key] !== undefined ? data[key] : "";
    });
}


function renderProduct(product) {
    const template = document.getElementById("product-template").innerHTML;

    // Remplacement des variables $...
    const filled = fillTemplate(template, product);

    // Conversion en élément DOM
    const div = document.createElement("div");
    div.innerHTML = filled.trim();
    return div.firstElementChild;
}


async function loadProducts() {
    const url = "https://api.iabag.fr/products"; // ton endpoint API Gateway

    const response = await fetch(url);
    const products = await response.json(); // <--- liste de produits

    const container = document.querySelector(".grid-products .row");

    products.forEach(product => {
        const card = renderProduct(product);
        container.appendChild(card);
    });
}
