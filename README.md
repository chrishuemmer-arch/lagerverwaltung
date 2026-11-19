# Lagerverwaltung

Kleine Lagerverwaltung als Handy-Web-App (PWA): Container-Regale mit nummerierten Plätzen, Projekte, Geräte mit Seriennummer und ein Kofferraum-Vorrat mit Mindestmengen.

**App:** https://chrishuemmer-arch.github.io/lagerverwaltung/

## Funktionen

- **Orte & Plätze:** z. B. Container → Regal A → Plätze A-01 … A-20, plus Kofferraum
- **Einlagern:** Geräte einzeln mit Seriennummer (Barcode per Kamera scannen) oder Kleinteile nach Stückzahl
- **Projekte:** jeder Eintrag kann einem Projekt zugeordnet werden, Bestand nach Projekt filtern
- **Kofferraum:** Mindestmengen pro Artikel, die App zeigt was fehlt und wo im Lager Nachschub liegt
- **QR-Etiketten** für jeden Platz drucken; Scannen öffnet den Platz
- **Verlauf** aller Bewegungen (einlagern, entnehmen, umlagern)
- **Backup** als JSON-Datei exportieren und wiederherstellen

## Daten

Alle Daten liegen lokal im Browser des Geräts (IndexedDB). Es gibt keinen Server.
Deshalb regelmäßig unter *Mehr → Backup erstellen* sichern.

## Auf dem Handy installieren

- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“
- **Android (Chrome):** Menü ⋮ → „App installieren“

Danach funktioniert die App auch ohne Netz.

## Entwicklung

```bash
npm install
npm run dev     # http://localhost:5173/lagerverwaltung/
npm run build
npm run lint
```

Jeder Push auf `main` wird per GitHub Actions automatisch auf GitHub Pages veröffentlicht.
