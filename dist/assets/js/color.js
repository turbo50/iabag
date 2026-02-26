document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("ul.swatches[data-colors]").forEach(ul => {
        const raw = ul.getAttribute("data-colors");

        let colors;
        try {
            colors = JSON.parse(raw); 
        } catch (e) {
            console.error("Colors invalid JSON:", raw);
            return;
        }

        ul.innerHTML = ""; // reset contenu

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

            ul.appendChild(li);
        });
    });
});
