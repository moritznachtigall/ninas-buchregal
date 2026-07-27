import { signedCoverUrl } from "./books.js";

const $ = selector => document.querySelector(selector);

export const els = {
  loginView: $("#loginView"), appView: $("#appView"), loginForm: $("#loginForm"),
  loginEmail: $("#loginEmail"), loginPassword: $("#loginPassword"), loginButton: $("#loginButton"),
  loginMessage: $("#loginMessage"), logoutButton: $("#logoutButton"), addBookButton: $("#addBookButton"),
  search: $("#searchInput"), statusFilter: $("#statusFilter"), genreFilter: $("#genreFilter"),
  sort: $("#sortSelect"), grid: $("#bookGrid"), template: $("#bookTemplate"), resultInfo: $("#resultInfo"),
  empty: $("#emptyState"), total: $("#totalCount"), read: $("#readCount"),
  reading: $("#readingCount"), favorite: $("#favoriteCount"), dialog: $("#bookDialog"),
  form: $("#bookForm"), dialogTitle: $("#dialogTitle"), closeDialog: $("#closeDialogButton"),
  cancel: $("#cancelButton"), deleteButton: $("#deleteBookButton"), saveButton: $("#saveBookButton"),
  formMessage: $("#formMessage"), lookupButton: $("#lookupIsbnButton"), isbnLookup: $("#isbnLookup"),
  scanBarcodeButton: $("#scanBarcodeButton"), photoBarcodeButton: $("#photoBarcodeButton"),
  barcodePhotoInput: $("#barcodePhotoInput"), isbnMessage: $("#isbnMessage"), toast: $("#toast")
};

export function showLogin(message = "") {
  els.appView.hidden = true;
  els.loginView.hidden = false;
  els.loginMessage.textContent = message;
}

export function showApp() {
  els.loginView.hidden = true;
  els.appView.hidden = false;
}

export function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { els.toast.hidden = true; }, 3200);
}

export function updateStats(books) {
  els.total.textContent = books.length;
  els.read.textContent = books.filter(b => b.status === "gelesen").length;
  els.reading.textContent = books.filter(b => b.status === "lese ich gerade").length;
  els.favorite.textContent = books.filter(b => b.favorite).length;
}

export function populateGenres(books) {
  const selected = els.genreFilter.value;
  els.genreFilter.innerHTML = '<option value="">Alle Genres</option>';
  [...new Set(books.map(b => b.genre).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "de"))
    .forEach(genre => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      els.genreFilter.append(option);
    });
  els.genreFilter.value = selected;
}

export async function renderBooks(books, onEdit) {
  els.grid.replaceChildren();

  for (const book of books) {
    const fragment = els.template.content.cloneNode(true);
    const cover = fragment.querySelector(".book-cover");
    const signedUrl = book.cover_path ? await signedCoverUrl(book.cover_path) : null;
    cover.src = signedUrl || book.cover_url || "covers/placeholder.svg";
    cover.alt = `Buchcover: ${book.title}`;
    cover.addEventListener("error", () => { cover.src = "covers/placeholder.svg"; }, { once: true });

    fragment.querySelector(".status-badge").textContent = book.status || "ungelesen";
    fragment.querySelector(".favorite-badge").hidden = !book.favorite;
    fragment.querySelector(".book-genre").textContent = book.genre || "Ohne Genre";
    fragment.querySelector(".book-title").textContent = book.title;
    fragment.querySelector(".book-author").textContent = book.author;
    fragment.querySelector(".book-year").textContent = book.year || "";
    fragment.querySelector(".book-location").textContent =
      [book.shelf, book.shelf_section].filter(Boolean).join(" · ");
    fragment.querySelector(".book-description").textContent = book.description || "";

    const rating = Number(book.rating || 0);
    fragment.querySelector(".book-rating").textContent =
      rating ? "★".repeat(rating) + "☆".repeat(5 - rating) : "Nicht bewertet";

    const tags = fragment.querySelector(".book-tags");
    (book.tags ?? []).forEach(tag => {
      const span = document.createElement("span");
      span.className = "tag";
      span.textContent = tag;
      tags.append(span);
    });

    fragment.querySelector(".edit-button").addEventListener("click", () => onEdit(book));
    els.grid.append(fragment);
  }

  els.empty.hidden = books.length > 0;
}

export function openBookDialog(book = null) {
  els.form.reset();
  els.formMessage.textContent = "";
  els.isbnMessage.textContent = "";
  els.dialogTitle.textContent = book ? "Buch bearbeiten" : "Buch hinzufügen";
  els.deleteButton.hidden = !book;

  set("bookId", book?.id);
  set("existingCoverPath", book?.cover_path);
  set("title", book?.title);
  set("author", book?.author);
  set("year", book?.year);
  set("publisher", book?.publisher);
  set("pages", book?.pages);
  set("genre", book?.genre);
  set("language", book?.language || "Deutsch");
  set("status", book?.status || "ungelesen");
  set("rating", book?.rating || 0);
  set("isbn", book?.isbn);
  set("isbnLookup", book?.isbn);
  set("shelf", book?.shelf);
  set("shelfSection", book?.shelf_section);
  set("tags", (book?.tags ?? []).join(", "));
  set("description", book?.description);
  set("coverUrl", book?.cover_url);
  set("favorite", book?.favorite);

  els.dialog.showModal();
}

export function closeBookDialog() {
  els.dialog.close();
}

export function applyIsbnData(data) {
  set("isbn", data.isbn);
  set("title", data.title);
  set("author", data.author);
  set("year", data.year);
  set("publisher", data.publisher);
  set("pages", data.pages);
  if (data.language) set("language", data.language);
  if (data.genre) set("genre", data.genre);
  if (data.coverUrl) set("coverUrl", data.coverUrl);
}

function set(id, value) {
  const field = document.getElementById(id);
  if (!field) return;
  if (field.type === "checkbox") field.checked = Boolean(value);
  else field.value = value ?? "";
}
