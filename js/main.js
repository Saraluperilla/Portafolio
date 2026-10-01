// ---------- Projects from data/projects.json ----------
function createCard(project) {
  const card = document.createElement("li");
  card.className = "card";

  const media = document.createElement("div");
  media.className = "card__media";

  if (project.type === "video") {
    const video = document.createElement("video");
    video.src = project.src;
    video.autoplay = true;
    video.muted = true; // browsers only autoplay muted videos
    video.loop = true;
    video.playsInline = true;
    media.append(video);
  } else {
    const img = document.createElement("img");
    img.src = project.src;
    img.alt = project.alt || project.title;
    img.loading = "lazy";
    media.append(img);
  }

  const caption = document.createElement("p");
  caption.className = "label card__caption";
  // Skip empty fields so a missing year doesn't leave a dangling dash
  caption.textContent = [project.title, project.year].filter(Boolean).join(" — ");

  // Only wrap in a link when the project has one
  if (project.link) {
    const link = document.createElement("a");
    link.className = "card__link";
    link.href = project.link;
    link.target = "_blank";
    link.rel = "noopener";
    link.append(media, caption);
    card.append(link);
  } else {
    card.append(media, caption);
  }

  return card;
}

async function renderProjects() {
  const strip = document.querySelector("[data-strip]");
  if (!strip) return;

  try {
    const response = await fetch("data/projects.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const projects = await response.json();
    strip.replaceChildren(...projects.map(createCard));
  } catch (error) {
    // Usually means the page was opened via file:// instead of a local server
    const notice = document.createElement("li");
    notice.className = "label strip__notice";
    notice.textContent = "Could not load projects — open the site with Live Server.";
    strip.replaceChildren(notice);
    console.warn("Could not load data/projects.json", error);
  }
}

// ---------- Today's date in the header ----------
function renderToday() {
  const el = document.querySelector("[data-today]");
  if (!el) return;

  const today = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  el.textContent = today;
}

// ---------- Copy email to clipboard ----------
function setupCopyEmail() {
  const button = document.querySelector("[data-copy-email]");
  if (!button) return;

  const email = button.dataset.copyEmail;

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(email);
      button.textContent = "Copied!";
    } catch {
      // Clipboard API can fail (e.g. without HTTPS); fall back to mailto
      window.location.href = `mailto:${email}`;
      return;
    }
    setTimeout(() => (button.textContent = email), 1500);
  });
}

// ---------- Read more (expand / collapse) ----------
function setupReadMore() {
  document.querySelectorAll("[data-read-more]").forEach((button) => {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (!panel) return;

    button.addEventListener("click", () => {
      const isOpen = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isOpen));
      panel.hidden = isOpen;
      button.textContent = isOpen ? "Read more" : "Read less";
    });
  });
}

// ---------- Grid view overlay ----------
function setupGridView() {
  const openButton = document.querySelector("[data-open-grid]");
  const overlay = document.querySelector("[data-grid]");
  const closeButton = document.querySelector("[data-close-grid]");
  const gridList = document.querySelector("[data-grid-list]");
  const strip = document.querySelector("[data-strip]");
  if (!openButton || !overlay || !closeButton || !gridList || !strip) return;

  function open() {
    // Reuse the strip cards so both views always show the same work
    gridList.innerHTML = strip.innerHTML;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    closeButton.focus();
  }

  function close() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    openButton.focus();
  }

  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", close);

  // Clicking the empty background (not a card) also closes
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) close();
  });
}

// ---------- Reveal blocks on scroll ----------
function setupReveal() {
  const blocks = document.querySelectorAll(".block:not(.header)");
  if (!("IntersectionObserver" in window)) return;

  document.documentElement.classList.add("js");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target); // animate only once
      });
    },
    { threshold: 0.15 }
  );

  blocks.forEach((block) => {
    block.classList.add("reveal");
    observer.observe(block);
  });
}

setupReveal();
renderProjects();
renderToday();
setupCopyEmail();
setupReadMore();
setupGridView();
