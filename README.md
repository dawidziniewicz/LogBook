# Dziennik jachtowy (LogBook)

Elektroniczny dziennik jachtowy odwzorowujący papierowy dziennik AKŻ AGH – PWA działające offline na telefonach, tabletach i komputerach.

## Funkcje
- Wszystkie pola dziennika: dane rejsu i jachtu, spis ożaglowania, sprawdzenie stanu jachtu, szkolenie, wpisy godzinowe 1–16, zliczenie 17, trasa 18A–C, przebieg żeglugi 19–22, kontrole 23–28, podpisy 29, crew list, wachty, karta rejsu.
- **Wypływamy z portu / Wchodzimy do portu / Kotwica** – pobiera pozycję GPS, nazwę portu (18A/18B/18C) i robi wpis w przebiegu żeglugi.
- **📍 przy każdej godzinie** – pozycja Φ/Λ, KD (kurs nad dnem), szybkość (średnia od poprzedniej pozycji), LOG; przy dostępie do internetu puste pola pogody (wiatr, ciśnienie, temperatura, zachmurzenie, widzialność, stan morza) z modelu Open‑Meteo – oznaczone jako „auto”.
- **Mapa** (OpenStreetMap + znaki nawigacyjne OpenSeaMap) ze śladem rejsu; dotknięcie mapy podaje odległość od jachtu w Mm, kurs i czas dojścia, tryb „Linijka” mierzy trasę z wielu punktów. Obejrzane kafelki są zapisywane i działają offline.
- **Ślad rejsu** na prawdziwej mapie (OSM + OpenSeaMap): na ekranie Start, w karcie rejsu i w wydruku/PDF.
- **Przypomnienia** o pełnej godzinie (konfigurowalna minuta, interwał w morzu/porcie, powtórki, pola wymagane).
- Tryb nocny (czerwony), tryb wachty (ekran nie gaśnie), eksport/import JSON, druk/PDF.

## Rozwój
```bash
npm install
npm run dev
```

## Deploy
Każdy push na `main` buduje aplikację i wdraża ją na Cloudflare Pages (`.github/workflows/deploy.yml`).
Projekt Pages `logbook` tworzy się automatycznie przy pierwszym uruchomieniu. Wymagany sekret `CLOUDFLARE_API_TOKEN` z uprawnieniem **Cloudflare Pages: Edit**.
Pull requesty dostają podglądowe wdrożenie.

## iPhone (iOS 26+)
iOS rozmywa pas pod paskiem statusu w aplikacjach z ekranu głównego (Liquid Glass) – nie da się tego wyłączyć, więc aplikacja trzyma tam jednolity kolor nagłówka, a treść zaczyna się poniżej.
Po zmianach ustawień paska statusu trzeba usunąć ikonę z ekranu głównego i dodać ją ponownie – iOS zapamiętuje konfigurację z chwili dodania.
