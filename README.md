# 💰 Budżet Domowy (Local-First Budget App)

Lekka, szybka i w 100% prywatna aplikacja internetowa do zarządzania budżetem osobistym oraz firmowym[cite: 4, 5]. Tworzona w duchu **Local-First** — wszystkie dane przechowywane są wyłącznie w Twojej przeglądarce, bez pośrednictwa zewnętrznych serwerów czy chmury[cite: 3].

Aplikacja waży niecałe **50 KB** i nie posiada żadnych zewnętrznych zależności (zero bibliotek, zero frameworków)[cite: 11].

---

## ✨ Kluczowe Funkcje

- 🔒 **100% Prywatności & Local-First:** Dane finansowe są zapisywane w bazie `IndexedDB` w Twojej przeglądarce[cite: 4].
- 🏷️ **Obsługa Wielu Profili:** Łatwe przełączanie pomiędzy kontem **Prywatnym** a **Firmowym** z osobnymi saldami i historią[cite: 4, 5].
- 📊 **Dynamiczne Podsumowanie Grupowe:** Automatyczne kategoryzowanie transakcji z podziałem na **PRZYCHODY** i **WYDATKI** oraz opcją filtrowania po kliknięciu grupy[cite: 4, 10].
- 💡 **Auto-Oszczędzanie:** Automatyczne tworzenie powiązanych mikro-transakcji oszczędnościowych dla wydatków pow. 10 PLN[cite: 4].
- 🔍 **Zaawansowane Filtrowanie:** Wyszukiwanie transakcji po zakresie dat oraz typie (przychód/wydatek)[cite: 4].
- 💾 **Kopie Zapasowe (JSON):** Prosty eksport i import pełnego zrzutu danych do pliku `.json` oraz wbudowany baner przypominający o comiesięcznym backupie[cite: 4, 5].
- 🖨️ **Gotowość do Druku / PDF:** Wbudowany, dedykowany widok druku (`@media print`) pozwalający generować przejrzyste raporty do formatu PDF[cite: 4, 5, 6].
- 🔢 **Czytelny Interfejs:** Automatyczne formatowanie kwot z separatorem tysięcy (spacją) dla wysokie czytelności[cite: 9, 10].

---

## 🛠️ Technologie

Aplikacja została zbudowana przy użyciu czystych technologii webowych (Vanilla JS)[cite: 11]:

- **HTML5** (Semantyczna struktura)[cite: 5, 11]
- **CSS3** (Ciemny motyw, Flexbox, Grid, style `@media print`)[cite: 6, 11]
- **JavaScript (ES6+)** (A synchroniczna logika, obróbka danych)[cite: 4, 11]
- **IndexedDB API** (Lokalna baza danych w przeglądarce)[cite: 4]

---

## 🚀 Jak Uruchomić?

Aplikacja nie wymaga instalowania Node.js, stawiania serwerów ani budowania projektu.

1. Pobierz pliki z repozytorium (`index.html`, `app.js`, `style.css`)[cite: 11].
2. Otwórz plik `index.html` w dowolnej nowoczesnej przeglądarce internetowej (Chrome, Firefox, Edge, Safari)[cite: 5].
3. To wszystko! Aplikacja jest od razu gotowa do działania.

---

## 📄 Licencja

Projekt udostępniany jest na licencji **MIT** — możesz go swobodnie pobierać, modyfikować i dostosowywać do własnych potrzeb.
