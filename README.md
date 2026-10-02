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

