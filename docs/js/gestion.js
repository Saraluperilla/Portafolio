// ==========================================================
// Project manager for data/projects.json
// - Loads the JSON, edits it in memory, then saves it back.
// - Chrome/Edge: writes the file directly (File System Access API).
// - Other browsers: downloads a new projects.json to replace by hand.
// ==========================================================

const DATA_URL = "data/projects.json";
const ASSETS_DIR = "assets/work/";

// ---------- State ----------
let projects = [];
let editingIndex = null; // null = adding a new project
let fileHandle = null; // set after "Open file…" or first "Save"
let isDirty = false;

// ---------- DOM ----------
const form = document.querySelector("[data-form]");
const formTitle = document.querySelector("[data-form-title]");
const submitButton = document.querySelector("[data-submit]");
const cancelButton = document.querySelector("[data-cancel]");
const preview = document.querySelector("[data-preview]");
const list = document.querySelector("[data-list]");
const count = document.querySelector("[data-count]");
const statusText = document.querySelector("[data-status]");

const supportsFileSystem = "showOpenFilePicker" in window;

// ---------- Status ----------
function setStatus(message, dirty = isDirty) {
  isDirty = dirty;
  statusText.textContent = message;
  statusText.classList.toggle("status--dirty", dirty);
}

function markDirty() {
  setStatus("Unsaved changes", true);
}

// Warn before closing the tab with unsaved work
window.addEventListener("beforeunload", (event) => {
  if (isDirty) event.preventDefault();
});

// ---------- Media helper (shared by preview and list) ----------
function createMedia(project) {
  if (!project.src) return document.createTextNode("");

  if (project.type === "video") {
    const video = document.createElement("video");
    video.src = project.src;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    return video;
  }

  const img = document.createElement("img");
  img.src = project.src;
  img.alt = project.alt || "";
  return img;
}

// ---------- List ----------
function createButton(label, onClick, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pill label";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function renderList() {
  count.textContent = `${projects.length} project${projects.length === 1 ? "" : "s"}`;

  const items = projects.map((project, index) => {
    const item = document.createElement("li");
    item.className = "item";
    if (index === editingIndex) item.classList.add("item--editing");

    const thumb = document.createElement("div");
    thumb.className = "item__thumb";
    thumb.append(createMedia(project));

    const meta = document.createElement("div");
    meta.className = "item__meta";
    const title = document.createElement("p");
    title.textContent = [project.title, project.year].filter(Boolean).join(" — ");
    const path = document.createElement("p");
    path.className = "label status";
    path.textContent = project.src;
    meta.append(title, path);

    const actions = document.createElement("div");
    actions.className = "item__actions";
    actions.append(
      createButton("↑", () => moveProject(index, -1), index === 0),
      createButton("↓", () => moveProject(index, 1), index === projects.length - 1),
      createButton("Edit", () => startEditing(index)),
      createButton("Delete", () => deleteProject(index))
    );

    item.append(thumb, meta, actions);
    return item;
  });

  list.replaceChildren(...items);
}

// ---------- CRUD ----------
function moveProject(index, direction) {
  const target = index + direction;
  // Swap the two items using array destructuring
  [projects[index], projects[target]] = [projects[target], projects[index]];

  // Keep the edit highlight on the same project after moving it
  if (editingIndex === index) editingIndex = target;
  else if (editingIndex === target) editingIndex = index;

  markDirty();
  renderList();
}

function deleteProject(index) {
  const name = projects[index].title || "this project";
  if (!confirm(`Delete "${name}"? The image file in assets/work/ is not deleted.`)) return;

  projects.splice(index, 1);
  if (editingIndex === index) resetForm();
  else if (editingIndex !== null && editingIndex > index) editingIndex--;

  markDirty();
  renderList();
}

function startEditing(index) {
  editingIndex = index;
  const project = projects[index];

  for (const field of ["title", "year", "type", "src", "alt", "link"]) {
    form.elements[field].value = project[field] ?? "";
  }

  formTitle.textContent = `Editing: ${project.title}`;
  submitButton.textContent = "Save changes";
  cancelButton.hidden = false;
  clearErrors();
  updatePreview();
  renderList();
  form.scrollIntoView({ behavior: "smooth" });
  form.elements.title.focus({ preventScroll: true });
}

function resetForm() {
  editingIndex = null;
  form.reset();
  formTitle.textContent = "New project";
  submitButton.textContent = "Add project";
  cancelButton.hidden = true;
  clearErrors();
  updatePreview();
  renderList();
}

// ---------- Form ----------
function readForm() {
  const data = new FormData(form);
  return {
    title: data.get("title").trim(),
    year: data.get("year").trim(),
    type: data.get("type"),
    src: data.get("src").trim(),
    alt: data.get("alt").trim(),
    link: data.get("link").trim(),
  };
}

function validate(project) {
  const errors = {};

  if (!project.title) errors.title = "Title is required.";
  if (!project.alt) errors.alt = "Alt text is required for accessibility.";

  if (!project.src) errors.src = "Path is required.";
  else if (!project.src.startsWith(ASSETS_DIR)) errors.src = `Path must start with ${ASSETS_DIR}`;

  if (project.year && !/^\d{4}$/.test(project.year)) errors.year = "Use 4 digits, e.g. 2026.";

  if (project.link) {
    try {
      new URL(project.link);
    } catch {
      errors.link = "Use a full URL starting with https://";
    }
  }

  return errors;
}

function clearErrors() {
  form.querySelectorAll("[data-error-for]").forEach((el) => (el.textContent = ""));
  form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
}

function showErrors(errors) {
  clearErrors();
  for (const [field, message] of Object.entries(errors)) {
    form.querySelector(`[data-error-for="${field}"]`).textContent = message;
    form.elements[field].setAttribute("aria-invalid", "true");
  }
  const firstField = Object.keys(errors)[0];
  if (firstField) form.elements[firstField].focus();
}

function updatePreview() {
  preview.replaceChildren(createMedia(readForm()));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const project = readForm();
  const errors = validate(project);
  if (Object.keys(errors).length > 0) {
    showErrors(errors);
    return;
  }

  if (editingIndex === null) {
    projects.push(project);
    setStatus(`Added "${project.title}" — unsaved`, true);
  } else {
    projects[editingIndex] = project;
    setStatus(`Updated "${project.title}" — unsaved`, true);
  }

  resetForm();
});

cancelButton.addEventListener("click", resetForm);

// The browser can't reveal the file's real folder, so we only use its name
form.elements.picker.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  form.elements.src.value = ASSETS_DIR + file.name;
  form.elements.type.value = file.type.startsWith("video/") ? "video" : "image";
  updatePreview();
});

form.elements.src.addEventListener("input", updatePreview);
form.elements.type.addEventListener("change", updatePreview);

// ---------- Load ----------
function loadFromText(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("projects.json must contain an array.");
  projects = data;
  resetForm();
}

async function loadFromServer() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    loadFromText(await response.text());
    setStatus(
      supportsFileSystem
        ? "Loaded. Click Save once and pick data/projects.json to enable direct saving."
        : "Loaded. Use Download JSON and replace data/projects.json.",
      false
    );
  } catch (error) {
    console.warn(error);
    setStatus("Could not load projects — open with Live Server or use Open file…", false);
  }
}

const jsonPickerOptions = {
  types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
};

async function openFile() {
  if (!supportsFileSystem) {
    alert("Your browser can't open files directly. Use Chrome or Edge.");
    return;
  }
  if (isDirty && !confirm("Discard unsaved changes?")) return;

  try {
    [fileHandle] = await window.showOpenFilePicker(jsonPickerOptions);
    const file = await fileHandle.getFile();
    loadFromText(await file.text());
    setStatus(`Opened ${file.name}. Save will overwrite it.`, false);
  } catch (error) {
    if (error.name !== "AbortError") setStatus(`Error: ${error.message}`);
  }
}

// ---------- Save ----------
function toJson() {
  return JSON.stringify(projects, null, 2) + "\n";
}

function downloadJson() {
  const blob = new Blob([toJson()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "projects.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded. Replace data/projects.json with it.", false);
}

async function save() {
  if (!supportsFileSystem) {
    downloadJson();
    return;
  }

  try {
    // First save: ask where projects.json lives
    if (!fileHandle) {
      fileHandle = await window.showSaveFilePicker({
        ...jsonPickerOptions,
        suggestedName: "projects.json",
      });
    }
    const writable = await fileHandle.createWritable();
    await writable.write(toJson());
    await writable.close();
    setStatus(`Saved to ${fileHandle.name} at ${new Date().toLocaleTimeString("es-CO")}`, false);
  } catch (error) {
    if (error.name !== "AbortError") setStatus(`Error: ${error.message}`);
  }
}

document.querySelector("[data-open-file]").addEventListener("click", openFile);
document.querySelector("[data-save]").addEventListener("click", save);
document.querySelector("[data-download]").addEventListener("click", downloadJson);

// ---------- Init ----------
loadFromServer();
