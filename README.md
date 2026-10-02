Budżet Domowy 💰
Prosta, w pełni client-side aplikacja webowa do zarządzania budżetem domowym i firmowym. Działa w całości w przeglądarce – dane przechowywane są lokalnie w IndexedDB, z opcjonalną synchronizacją kopii zapasowej do Google Drive.

✨ Funkcje
👤 Dwa niezależne profile
Prywatny i Firmowy – osobne transakcje, salda początkowe, ustawienia autooszczędzania i notatnik.

Szybkie przełączanie profilu przyciskami w panelu bocznym.

💸 Transakcje
Dodawanie przychodów i wydatków z nazwą, kwotą i datą.

Edycja i usuwanie transakcji przez modal.

Duplikacja transakcji z dzisiejszą datą jednym kliknięciem.

Paginacja listy („Pokaż więcej”).

Automatyczne sortowanie po dacie.

🐖 Autooszczędzanie
Konfigurowalne dla każdego profilu osobno.

Próg wydatku + kwota oszczędzania.

Automatyczne tworzenie wpisu „Auto-Oszczędzanie” przy większych wydatkach.

Powiązanie z transakcją główną – edycja i usuwanie aktualizują wpis oszczędzania.

📓 Notatnik stałych wydatków
Lista powtarzalnych wydatków (czynsz, ZUS, rachunki itp.).

Pole na numer konta / IBAN z automatycznym formatowaniem (NRB: 2-4-4-4-4-4-4).

Zaznaczanie wielu pozycji i:

dodawanie ich jako wydatki jednym kliknięciem,

usuwanie hurtowe,

podgląd sumy zaznaczonych.

Sortowanie alfabetyczne.

📊 Statystyki i podsumowania
Miesięczne przychody, wydatki i wynik.

Skumulowane saldo całkowite z przeniesieniem.

Grupowanie transakcji po nazwie (osobno przychody i wydatki) z liczbą wystąpień i sumą.

Kliknięcie grupy filtruje listę transakcji.

Normalizacja tekstu (ignorowanie wielkości liter i polskich znaków).

🔍 Filtrowanie
Zakres dat (od–do).

Typ transakcji (wszystkie / wydatki / przychody).

Reset filtrów.

☁️ Google Drive
Logowanie przez Google Identity Services (OAuth 2.0).

Zapis kopii zapasowej do pliku budzet_domowy_kopia.json na Dysku Google.

Nadpisywanie istniejącej kopii (PATCH) lub tworzenie nowej (POST multipart).

Lista zapisanych kopii z możliwością wczytania.

Monit o zapis kopii przy próbie opuszczenia strony z niezapisanymi zmianami.

💾 Kopie zapasowe
Eksport / import pełnego stanu aplikacji do pliku JSON.

Import obsługuje zarówno nowy format, jak i starsze wersje (sama tablica transakcji).

Czyszczenie danych tylko dla aktywnego profilu.

Ochrona beforeunload przy niezapisanych zmianach.

🖨️ Drukowanie / PDF
Przycisk „Drukuj / Zapisz do PDF”.

Przed drukiem tymczasowo pokazuje wszystkie transakcje.

Dedykowany arkusz @media print.

🎨 UI/UX
Ciemny motyw.

Trzykolumnowy układ responsywny (na węższych ekranach przechodzi w jedną kolumnę).

Modale zamiast natywnych alert / confirm:

potwierdzenia (showConfirmModal),

powiadomienia toast (showToastModal),

modal duplikacji, edycji, wyboru plików Google Drive.

Zamykanie modali klawiszem ESC lub kliknięciem w tło.

Automatyczne formatowanie kwot (spacja co 3 cyfry, przecinek dziesiętny).

Przyciski z feedbackiem „Zapisano ✓”.

🛠️ Technologie
Vanilla JavaScript (ES2020+) – bez frameworków.

IndexedDB – lokalna baza danych (obiekty: transactions, settings, recurring).

Google Identity Services + Drive API v3 – kopie zapasowe w chmurze.

HTML5 + CSS3 – semantyczny markup, Grid, media queries, @media print.

Blob API + URL.createObjectURL – eksport plików.

sessionStorage / localStorage – tokeny sesyjne Google.

📁 Struktura projektu
text
.
├── index.html   # Struktura interfejsu i modali
├── style.css    # Ciemny motyw, layout 3-kolumnowy, style druku
└── app.js       # Cała logika: DB, UI, Google Drive, import/export
🚀 Uruchomienie
Sklonuj repozytorium:

bash
git clone https://github.com/twoj-user/budzet-domowy.git
Otwórz index.html w nowoczesnej przeglądarce (Chrome, Edge, Firefox).

Ze względu na użycie Google OAuth zalecane jest serwowanie przez lokalny serwer HTTP, np.:

bash
npx serve .
# lub
python -m http.server 8080
Aby korzystać z Google Drive:

Utwórz projekt w Google Cloud Console.

Włącz Google Drive API.

Utwórz OAuth 2.0 Client ID typu Web application.

Dodaj swoje origin (np. http://localhost:8080) do Authorized JavaScript origins.

W app.js podmień GOOGLE_CLIENT_ID na swój identyfikator klienta.

🔐 Bezpieczeństwo i prywatność
Wszystkie dane przechowywane są lokalnie w przeglądarce.

Do Google Drive wysyłany jest tylko plik JSON z danymi, i tylko po zalogowaniu użytkownika.

Token dostępu przechowywany jest wyłącznie w sessionStorage (kasowany po zamknięciu karty).

🗺️ Plan rozwoju
□ Eksport do CSV / XLSX.
□ Wykresy (Chart.js) – trendy miesięczne i kategorie.
□ Wielojęzyczność (PL / EN).
□ Testy jednostkowe (Jest / Vitest).
□ PWA z trybem offline i instalacją na urządzeniu.
□ Refaktoryzacja na moduły ES (db.js, ui.js, gdrive.js, utils.js).
📜 Licencja
MIT – możesz swobodnie używać, modyfikować i rozpowszechniać.

🙌 Wkład
Pull requesty i zgłoszenia błędów są mile widziane. Jeśli masz pomysł na nową funkcję – otwórz Issue i opisz propozycję.

Miłego budżetowania! 💚
