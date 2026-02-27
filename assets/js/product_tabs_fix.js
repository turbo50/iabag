export function rebindProductTabs() {
  // Desktop tabs: <li rel="reviews"><a class="tablink">
  document.querySelectorAll(".product-tabs li[rel] .tablink").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();

      const li = a.closest("li[rel]");
      if (!li) return;

      const rel = li.getAttribute("rel");
      if (!rel) return;

      // active tab header
      li.parentElement?.querySelectorAll("li").forEach((x) => x.classList.remove("active"));
      li.classList.add("active");

      // show/hide contents
      document.querySelectorAll(".tab-container .tab-content").forEach((c) => c.classList.remove("active"));
      const content = document.getElementById(rel);
      if (content) content.classList.add("active");
    });
  });

  // Mobile accordion headings: <h3 rel="reviews">
  document.querySelectorAll(".tabs-ac-style[rel]").forEach((h3) => {
    h3.addEventListener("click", () => {
      const rel = h3.getAttribute("rel");
      if (!rel) return;

      document.querySelectorAll(".tabs-ac-style").forEach((x) => x.classList.remove("active"));
      h3.classList.add("active");

      document.querySelectorAll(".tab-container .tab-content").forEach((c) => c.classList.remove("active"));
      const content = document.getElementById(rel);
      if (content) content.classList.add("active");
    });
  });
}