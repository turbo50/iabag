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

// Appel automatique quand la page est chargée
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.product-review').forEach(el => {
        const rating = parseFloat(el.getAttribute("data-rating"));
        if (!isNaN(rating)) {
            renderRatingStars(el, rating);
        }
    });
});
