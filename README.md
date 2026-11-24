# Fitness

Persoonlijke app om trainingen te loggen. Werkt offline en is te installeren op je
telefoon (PWA). Alle gegevens staan **alleen op het toestel** (IndexedDB); er is geen
server en er gaat niets naar GitHub.

**Openen:** https://tlbakker.github.io/fitnessapp/

## Wat kan het (stap 1)

- Training starten en sets loggen (kg × reps), met de waarden van vorige keer al ingevuld
- 85 vooringeladen oefeningen per spiergroep, waaronder Technogym-apparaten, plus eigen oefeningen
- Geschiedenis per training en per oefening
- Geschatte 1RM volgens Epley: gewicht × (1 + reps ÷ 30)
- Back-up downloaden en terugzetten (JSON)

## Installeren op Android

Open de link in Chrome, tik op ⋮ → **App installeren** (of *Toevoegen aan startscherm*).

## Ontwikkelen

Geen build-stap: gewone HTML, CSS en JavaScript-modules.

```sh
npm start     # lokale server op http://localhost:8080
npm test      # unit-tests (Node 22)
```

- `js/exercises.js` – de oefeningenlijst. Ids nooit wijzigen, alleen toevoegen.
- `js/db.js` – opslag. Stores voor vaste workouts (`templates`) en agenda (`plans`) staan al klaar voor stap 2.
- `js/calc.js` – rekenfuncties (Epley, volume).
- `sw.js` – offline cache. Verhoog `VERSION` bij elke release.

Bij elke push naar `main` draaien de tests en wordt de site gepubliceerd via GitHub Actions.
