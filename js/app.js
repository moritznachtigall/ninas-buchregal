import { configIsValid } from "./supabase-client.js";
import { getSession, signIn, signOut, onAuthChange } from "./auth.js";
import {
  fetchBooks, saveBook, removeBook, uploadCover, deleteCover, lookupIsbn
} from "./books.js";
import {
  els, showLogin, showApp, toast, updateStats, populateGenres,
  clearBooks, appendBooks, setLoadMoreState, setEmptyState,
  openBookDialog, closeBookDialog, applyIsbnData
} from "./ui.js";
import { openBarcodeScanner, stopBarcodeScanner, decodeBarcodePhoto } from "./scanner.js";

const state = {
  session: null,
  books: [],
  search: "",
  status: "",
  genre: "",
  sort: "created-desc",
  loadingBooks: false,
  renderedCount: 0,
  batchSize: 30,
  filteredBooks: []
};

function normalize(value) {
  return String(value ?? "").toLocaleLowerCase("de");
}

function visibleBooks() {
  const search = normalize(state.search);

  return [...state.books]
    .filter(book => {
      const haystack = [
        book.title, book.author, book.isbn, book.genre, book.publisher,
        book.description, book.shelf, book.shelf_section, ...(book.tags ?? [])
      ].map(normalize).join(" ");

      return (!search || haystack.includes(search))
        && (!state.status || book.status === state.status)
        && (!state.genre || book.genre === state.genre);
    })
    .sort((a, b) => {
      if (state.sort === "title") return a.title.localeCompare(b.title, "de");
      if (state.sort === "author") return a.author.localeCompare(b.author, "de");
      if (state.sort === "year-desc") return (b.year ?? 0) - (a.year ?? 0);
      if (state.sort === "rating-desc") return (b.rating ?? 0) - (a.rating ?? 0);
      return new Date(b.created_at) - new Date(a.created_at);
    });
}

async function refreshBooks() {
  if (!state.session || state.loadingBooks) return;
  state.loadingBooks = true;
  els.resultInfo.textContent = "Bücher werden geladen …";

  try {
    state.books = await fetchBooks();
    updateStats(state.books);
    populateGenres(state.books);
    resetAndRender();
  } catch (error) {
    els.resultInfo.textContent = `Fehler beim Laden: ${error.message}`;
  } finally {
    state.loadingBooks = false;
  }
}

function resetAndRender() {
  state.filteredBooks = visibleBooks();
  state.renderedCount = 0;
  clearBooks();
  setEmptyState(state.filteredBooks.length === 0);
  loadNextBatch();
}

function loadNextBatch() {
  if (state.renderedCount >= state.filteredBooks.length) {
    setLoadMoreState(false);
    updateResultInfo();
    return;
  }

  const nextBooks = state.filteredBooks.slice(
    state.renderedCount,
    state.renderedCount + state.batchSize
  );

  appendBooks(nextBooks, openBookDialog);
  state.renderedCount += nextBooks.length;
  setLoadMoreState(state.renderedCount < state.filteredBooks.length);
  updateResultInfo();
}

function updateResultInfo() {
  els.resultInfo.textContent =
    `${state.renderedCount} von ${state.filteredBooks.length} passenden Büchern angezeigt` +
    (state.filteredBooks.length !== state.books.length
      ? ` · ${state.books.length} insgesamt`
      : "");
}

async function initialize() {
  if (!configIsValid()) {
    showLogin("Bitte zuerst die Werte in js/config.js eintragen.");
    return;
  }

  try {
    state.session = await getSession();
    if (state.session) {
      showApp();
      await refreshBooks();
    } else {
      showLogin();
    }

    onAuthChange(async (_event, session) => {
      state.session = session;
      if (session) {
        showApp();
        await refreshBooks();
      } else {
        state.books = [];
        showLogin();
      }
    });
  } catch (error) {
    showLogin(`Initialisierung fehlgeschlagen: ${error.message}`);
  }
}

els.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  els.loginButton.disabled = true;
  els.loginMessage.textContent = "Anmeldung läuft …";

  try {
    state.session = await signIn(els.loginEmail.value.trim(), els.loginPassword.value);
    els.loginMessage.textContent = "";
    showApp();
    await refreshBooks();
  } catch (error) {
    els.loginMessage.textContent = `Anmeldung fehlgeschlagen: ${error.message}`;
  } finally {
    els.loginButton.disabled = false;
  }
});

els.logoutButton.addEventListener("click", async () => {
  try {
    await signOut();
  } catch (error) {
    toast(`Abmelden fehlgeschlagen: ${error.message}`);
  }
});

els.addBookButton.addEventListener("click", () => openBookDialog());
els.closeDialog.addEventListener("click", closeBookDialog);
els.cancel.addEventListener("click", closeBookDialog);

async function loadBookByIsbn(isbn) {
  els.lookupButton.disabled = true;
  els.scanBarcodeButton.disabled = true;
  els.photoBarcodeButton.disabled = true;
  els.isbnMessage.textContent = "Buchdaten werden gesucht …";

  try {
    const data = await lookupIsbn(isbn);
    applyIsbnData(data);
    els.isbnMessage.textContent = "Daten gefunden. Bitte vor dem Speichern prüfen.";
  } catch (error) {
    els.isbnMessage.textContent = error.message;
  } finally {
    els.lookupButton.disabled = false;
    els.scanBarcodeButton.disabled = false;
    els.photoBarcodeButton.disabled = false;
  }
}

// Manuelle Eingabe bleibt vollständig erhalten.
els.lookupButton.addEventListener("click", () => {
  loadBookByIsbn(els.isbnLookup.value);
});

// Der Scanner füllt dasselbe Feld und nutzt dieselbe ISBN-Suche.
els.scanBarcodeButton.addEventListener("click", async () => {
  els.isbnMessage.textContent = "";

  try {
    await openBarcodeScanner(async isbn => {
      els.isbnLookup.value = isbn;
      await loadBookByIsbn(isbn);
    });
  } catch (error) {
    els.isbnMessage.textContent = error.message;
  }
});

els.photoBarcodeButton.addEventListener("click", () => {
  els.isbnMessage.textContent = "";
  els.barcodePhotoInput.value = "";
  els.barcodePhotoInput.click();
});

els.barcodePhotoInput.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;

  els.photoBarcodeButton.disabled = true;
  els.scanBarcodeButton.disabled = true;
  els.lookupButton.disabled = true;
  els.isbnMessage.textContent = "Barcode-Foto wird ausgewertet …";

  try {
    const isbn = await decodeBarcodePhoto(file);
    els.isbnLookup.value = isbn;
    await loadBookByIsbn(isbn);
  } catch (error) {
    els.isbnMessage.textContent = error.message;
  } finally {
    els.photoBarcodeButton.disabled = false;
    els.scanBarcodeButton.disabled = false;
    els.lookupButton.disabled = false;
  }
});

els.form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.session) return;

  els.saveButton.disabled = true;
  els.formMessage.textContent = "Buch wird gespeichert …";

  const id = document.querySelector("#bookId").value || null;
  const oldCoverPath = document.querySelector("#existingCoverPath").value || null;
  const coverFile = document.querySelector("#coverFile").files?.[0] || null;
  let newCoverPath = oldCoverPath;

  try {
    if (coverFile) {
      newCoverPath = await uploadCover(coverFile, state.session.user.id);
    }

    const book = {
      owner_id: state.session.user.id,
      title: document.querySelector("#title").value.trim(),
      author: document.querySelector("#author").value.trim(),
      year: numberOrNull("#year"),
      publisher: valueOrNull("#publisher"),
      pages: numberOrNull("#pages"),
      genre: valueOrNull("#genre"),
      language: valueOrNull("#language"),
      status: document.querySelector("#status").value,
      rating: Number(document.querySelector("#rating").value),
      isbn: valueOrNull("#isbn"),
      shelf: valueOrNull("#shelf"),
      shelf_section: valueOrNull("#shelfSection"),
      tags: document.querySelector("#tags").value.split(",").map(tag => tag.trim()).filter(Boolean),
      description: valueOrNull("#description"),
      favorite: document.querySelector("#favorite").checked,
      cover_path: newCoverPath,
      cover_url: coverFile ? null : valueOrNull("#coverUrl")
    };

    await saveBook(book, id);

    if (coverFile && oldCoverPath && oldCoverPath !== newCoverPath) {
      await deleteCover(oldCoverPath);
    }

    closeBookDialog();
    toast(id ? "Buch wurde aktualisiert." : "Buch wurde hinzugefügt.");
    await refreshBooks();
  } catch (error) {
    if (coverFile && newCoverPath && newCoverPath !== oldCoverPath) await deleteCover(newCoverPath);
    els.formMessage.textContent = `Speichern fehlgeschlagen: ${error.message}`;
  } finally {
    els.saveButton.disabled = false;
  }
});

els.deleteButton.addEventListener("click", async () => {
  const id = document.querySelector("#bookId").value;
  const coverPath = document.querySelector("#existingCoverPath").value;
  if (!id || !window.confirm("Dieses Buch wirklich löschen?")) return;

  els.deleteButton.disabled = true;
  els.formMessage.textContent = "Buch wird gelöscht …";

  try {
    await removeBook(id);
    await deleteCover(coverPath);
    closeBookDialog();
    toast("Buch wurde gelöscht.");
    await refreshBooks();
  } catch (error) {
    els.formMessage.textContent = `Löschen fehlgeschlagen: ${error.message}`;
  } finally {
    els.deleteButton.disabled = false;
  }
});

els.search.addEventListener("input", event => {
  state.search = event.target.value;
  resetAndRender();
});
els.statusFilter.addEventListener("change", event => {
  state.status = event.target.value;
  resetAndRender();
});
els.genreFilter.addEventListener("change", event => {
  state.genre = event.target.value;
  resetAndRender();
});
els.sort.addEventListener("change", event => {
  state.sort = event.target.value;
  resetAndRender();
});

const loadMoreObserver = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) {
    loadNextBatch();
  }
}, { rootMargin: "500px 0px" });

loadMoreObserver.observe(els.loadMoreSentinel);

function valueOrNull(selector) {
  return document.querySelector(selector).value.trim() || null;
}
function numberOrNull(selector) {
  const value = document.querySelector(selector).value;
  return value === "" ? null : Number(value);
}

initialize();
