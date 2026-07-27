import { db, storageBucket } from "./supabase-client.js";

export async function fetchBooks() {
  const { data, error } = await db.from("books").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveBook(book, id = null) {
  const query = id
    ? db.from("books").update(book).eq("id", id).select().single()
    : db.from("books").insert(book).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function removeBook(id) {
  const { error } = await db.from("books").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadCover(file, userId) {
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("Das Cover ist größer als 5 MB.");

  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await db.storage.from(storageBucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type
  });
  if (error) throw error;
  return path;
}

export async function deleteCover(path) {
  if (!path) return;
  const { error } = await db.storage.from(storageBucket).remove([path]);
  if (error) console.warn("Altes Cover konnte nicht gelöscht werden:", error.message);
}

export async function signedCoverUrl(path) {
  if (!path) return null;
  const { data, error } = await db.storage.from(storageBucket).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function lookupIsbn(rawIsbn) {
  const isbn = rawIsbn.replace(/[^0-9Xx]/g, "");
  if (!isbn) throw new Error("Bitte eine ISBN eingeben.");

  const response = await fetch(
    `https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&limit=1&fields=title,author_name,first_publish_year,publisher,number_of_pages_median,language,cover_i,isbn,subject`
  );
  if (!response.ok) throw new Error("Die ISBN-Suche ist momentan nicht erreichbar.");

  const payload = await response.json();
  const item = payload.docs?.[0];
  if (!item) throw new Error("Zu dieser ISBN wurden keine Buchdaten gefunden.");

  return {
    isbn,
    title: item.title || "",
    author: item.author_name?.join(", ") || "",
    year: item.first_publish_year || null,
    publisher: item.publisher?.[0] || "",
    pages: item.number_of_pages_median || null,
    language: languageName(item.language?.[0]),
    genre: item.subject?.[0] || "",
    coverUrl: item.cover_i ? `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg` : ""
  };
}

function languageName(code) {
  const map = { ger: "Deutsch", eng: "Englisch", fre: "Französisch", spa: "Spanisch", ita: "Italienisch" };
  return map[code] || "";
}
