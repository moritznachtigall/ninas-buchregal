# Ninas Bücherregal

Eine private Buchverwaltung für GitHub Pages mit Supabase.

## Enthalten

- Anmeldung per E-Mail und Passwort
- Keine öffentliche Registrierung
- Bücher hinzufügen, bearbeiten und löschen
- ISBN-Suche über Open Library
- Eigene Cover in privatem Supabase Storage
- Suche, Filter und Sortierung
- Bewertungen, Favoriten, Regal und Fach
- Row Level Security: Benutzer sehen nur ihre eigenen Daten

## Einrichtung

### 1. Dateien hochladen

Ersetze den bisherigen Inhalt deines GitHub-Repositorys durch den Inhalt dieses Ordners. Die Ordnerstruktur muss erhalten bleiben.

### 2. Supabase-Schema ausführen

1. Supabase-Projekt öffnen.
2. `SQL Editor` öffnen.
3. `New query` wählen.
4. Den vollständigen Inhalt von `supabase-schema.sql` einfügen.
5. `Run` klicken.

Das Skript erstellt die Tabelle, Zugriffsregeln und den privaten Cover-Bucket.

### 3. Nina als Benutzer anlegen

1. `Authentication` → `Users`.
2. `Add user` → `Create new user`.
3. E-Mail-Adresse und sicheres Passwort festlegen.
4. Den Benutzer als bestätigt anlegen bzw. die E-Mail bestätigen.

Die Website bietet absichtlich keine Registrierung.

### 4. Supabase-Verbindung eintragen

Öffne `js/config.js` und ersetze die Platzhalter:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://DEIN-PROJEKT.supabase.co",
  supabaseAnonKey: "DEIN_OEFFENTLICHER_KEY",
  storageBucket: "book-covers"
};
```

Die Werte findest du in Supabase unter `Project Settings` → `API`.

Verwende nur den öffentlichen `anon`- oder `publishable`-Key. Niemals den `service_role`-Key veröffentlichen.

### 5. GitHub Pages prüfen

Im GitHub-Repository:

1. `Settings` → `Pages`
2. `Deploy from a branch`
3. Branch `main`
4. Ordner `/ (root)`

Nach Änderungen die Seite gegebenenfalls mit `Strg + F5` neu laden.

## Fehlerdiagnose

- **Es passiert beim Login nichts:** Browser-Konsole mit `F12` öffnen und auf rote Meldungen prüfen.
- **Invalid login credentials:** E-Mail/Passwort stimmen nicht oder der Benutzer ist nicht bestätigt.
- **Bücherliste leer:** Das ist bei einem neuen Konto normal. Bei vorhandenen Daten RLS und Benutzer-ID prüfen.
- **Cover-Upload 403:** `supabase-schema.sql` erneut vollständig ausführen.
- **config.js wird nicht übernommen:** GitHub Pages neu deployen lassen und Browsercache leeren.

## Datenschutz

Die GitHub-Pages-Dateien selbst sind öffentlich abrufbar. Die Buchdaten und hochgeladenen Cover werden jedoch erst nach erfolgreicher Supabase-Anmeldung ausgegeben und sind durch RLS-Regeln geschützt.
