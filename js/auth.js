import { db } from "./supabase-client.js";

export async function getSession() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

export function onAuthChange(callback) {
  return db.auth.onAuthStateChange((event, session) => {
    // Keine weiteren Supabase-Aufrufe direkt im Callback ausführen.
    window.setTimeout(() => callback(event, session), 0);
  });
}
