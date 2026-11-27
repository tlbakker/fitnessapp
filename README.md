# Fitness

Persoonlijke app om trainingen te loggen. Werkt offline en is te installeren op je
telefoon (PWA). Alle gegevens staan **alleen op het toestel** (IndexedDB); er is geen
server en er gaat niets naar GitHub.

**Openen:** https://tlbakker.github.io/fitnessapp/

## Wat kan het

- Training starten en sets loggen (kg × reps), met de waarden van vorige keer al ingevuld
- 85 vooringeladen oefeningen per spiergroep, waaronder Technogym-apparaten, plus eigen oefeningen
- Geschiedenis per training en per oefening
- Geschatte 1RM volgens Epley: gewicht × (1 + reps ÷ 30)
- Vaste workouts: kies eerst een trainingsvorm (laag → hoog, hoog → laag, piramide, rest-pause, random 3 sets, rechte sets, drop set, AMRAP-finisher), daarna de oefeningen. Per oefening kun je afwijken. Het gewicht per set rekent de app uit je eigen 1RM
- Conditieapparaten (loopband, crosstrainer, hometrainer, ligfiets, roeiergometer, armergometer, stepper): log je minuten, km en niveau; voortgang als gemiddelde snelheid. Vorm "Intervallen" voor cardio
- Voorblad: persoonlijke groet (naam onder Meer) en de geplande training van vandaag met startknop
- Standaardworkouts in de app (`BUILTIN_WORKOUTS` in `js/exercises.js`), te kopiëren en aan te passen
- Workouts delen via link of bestand (alleen oefeningen + schema, nooit gewichten of trainingen)
- Agenda: maandoverzicht, workouts plannen (ook wekelijks herhalen); gepland telt pas als gedaan als hij gelogd is
- Oefeningen binnen een training inklappen (gaat automatisch bij het toevoegen van een nieuwe)
- Nulmeting: 12 basisoefeningen (één per spiergroep + uithouding) met uitleg, voor je startniveau
- Lichaamsmetingen: gewicht, vet%, spiermassa, buikomtrek, visceraal vet
- Voortgang: nulmeting vs. nu, grafiek per oefening, grafieken van je metingen
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
- `js/calc.js` – rekenfuncties (Epley, volume, prestatie per training).
- `js/workouts.js` + `js/agenda.js` – vaste workouts en agenda.
- `js/schemes.js` – trainingsvormen (`FORMS`) en het in-/uitpakken van gedeelde workouts. Een nieuwe vorm toevoegen = één object in `FORMS`.
- `js/progress.js` + `js/chart.js` – voortgangsscherm en SVG-grafieken.
- `sw.js` – offline cache. Verhoog `VERSION` bij elke release.

Bij elke push naar `main` draaien de tests en wordt de site gepubliceerd via GitHub Actions.
