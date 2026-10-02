# 💰 Budżet Domowy

Nowoczesna, lokalna aplikacja webowa do zarządzania budżetem domowym i firmowym.

Działa całkowicie w przeglądarce (IndexedDB) – Twoje dane nie wychodzą nigdzie bez Twojej zgody. Opcjonalnie możesz robić kopie zapasowe na Google Drive.

---

## ✨ Główne funkcje

### 👤 Dwa profile
- **Prywatny**
- **Firmowy**  
Przełączanie jednym kliknięciem. Każdy profil ma własne saldo, transakcje, notatnik i ustawienia autooszczędzania.

### 📊 Transakcje
- Dodawanie przychodów i wydatków
- Szybkie duplikowanie transakcji z dzisiejszą datą
- Edycja i usuwanie
- Filtrowanie po dacie i typie
- Podsumowanie pogrupowane według nazw (z możliwością klikania grup)

### 🔄 Autooszczędzanie
Automatyczne dodawanie wpisu „Auto-Oszczędzanie” przy wydatkach powyżej określonej kwoty.

### 🔗 Powiązanie Adrian → Praca
Na profilu firmowym możesz włączyć automatyczne tworzenie przychodu „Praca” na profilu prywatnym przy wydatku o nazwie „Adrian”.

### 📓 Notatnik stałych wydatków
- Lista cyklicznych kosztów (czynsz, ZUS, prąd itd.)
- Numer konta / IBAN z automatycznym formatowaniem
- Zaznaczanie wielu pozycji i dodawanie ich hurtowo jako wydatki
- Szybkie dodawanie pojedynczej pozycji przyciskiem **+**

### ☁️ Kopia zapasowa
- Eksport / import pliku JSON
- Integracja z **Google Drive** (logowanie OAuth, zapis i wczytywanie kopii)
- Przypomnienie o zapisie przy zamykaniu strony (gdy masz niezapisane zmiany)

### 🖨️ Drukowanie
Przycisk „Drukuj / Zapisz do PDF” z czystym układem (ukrywa elementy interfejsu).

---

## 🛠️ Technologie

- Czysty **HTML + CSS + JavaScript** (bez frameworków)
- **IndexedDB** – lokalna baza danych
- **Google Identity Services + Drive API** – opcjonalne kopie zapasowe
- Responsywny układ 3-kolumnowy

---

## 🚀 Jak uruchomić

1. Sklonuj repozytorium lub pobierz pliki.
2. Otwórz `index.html` w przeglądarce (najlepiej przez lokalny serwer, np. Live Server w VS Code).
3. Gotowe – aplikacja działa od razu.

> **Uwaga:** Aby korzystać z Google Drive, musisz mieć własny Client ID w Google Cloud Console i podmienić go w pliku `app.js`.

---

## 📁 Struktura projektu
