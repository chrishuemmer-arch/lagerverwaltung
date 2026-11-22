# FeliStore

Lagerverwaltung von Feline Systems Ltd. als Handy-Web-App (PWA): mehrere Lager mit Container-Regalen und nummerierten Plätzen, Projekte, Geräte mit Seriennummer und ein Kofferraum-Vorrat mit Mindestmengen.

**App:** https://chrishuemmer-arch.github.io/lagerverwaltung/

## Funktionen

- **Orte & Plätze:** z. B. Container → Regal A → Plätze A-01 … A-20, plus Kofferraum
- **Einlagern:** Geräte einzeln mit Seriennummer (Barcode per Kamera scannen) oder Kleinteile nach Stückzahl
- **Projekte:** jeder Eintrag kann einem Projekt zugeordnet werden, Bestand nach Projekt filtern
- **Kofferraum:** Mindestmengen pro Artikel, die App zeigt was fehlt und wo im Lager Nachschub liegt
- **QR-Etiketten** für jeden Platz drucken; Scannen öffnet den Platz
- **Verlauf** aller Bewegungen (einlagern, entnehmen, umlagern)
- **Mehrere Lager:** alle Kollegen sehen den Bestand aller Lager; geändert wird nur im oben gewählten „aktuellen Lager“
- **Verlauf mit Namen:** jede Bewegung speichert, wer sie gemacht hat
- **Export** als JSON und Übernahme von Daten der alten, rein lokalen Version

## Daten & Zugang

Die Daten liegen zentral in Supabase (Postgres, Projekt `ardniaocmkicijxqlkei`). Die App hält eine lokale Kopie für schnelles Lesen.

- Kollegen registrieren sich in der App mit E-Mail und Passwort; ein Admin schaltet sie unter *Mehr → Kollegen* frei.
- Die erste registrierte Person ist automatisch Admin.
- Ohne Freischaltung sieht man nichts und kann nichts ändern (Row Level Security in der Datenbank).
- Schema und Rechte: `supabase/migrations/`.

## Auf dem Handy installieren

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü ⋮ → „App installieren“

Für Änderungen braucht die App Internet.

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:5173/lagerverwaltung/
npm run build
npm run lint
```

`.env` enthält die öffentliche Supabase-URL und den Publishable Key (kein Geheimnis).

Jeder Push auf `main` wird per GitHub Actions automatisch auf GitHub Pages veröffentlicht.
