// Konfiguracja Bazy Danych IndexedDB
const DB_NAME = 'BudgetAppDB';
const DB_VERSION = 1;
let db = null;

// Stan aplikacji
let currentProfile = 'private'; // 'private' lub 'company'
let transactions = [];
let initialBalances = { private: 0, company: 0 };
let displayedCount = 10;
let currentSearchFilter = null;
let showSavingsEntries = false;
let selectedGroups = new Set();

// --- FORMATOWANIE KWOT ZE SPACJĄ CO 3 CYFRY ---
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  const parts = num.toFixed(2).split('.');
  // Wymuszenie spacji co 3 cyfry od końca części całkowitej bez wyjątku dla 4 cyfr
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${parts.join(',')} PLN`;
}

// Funkcja pomocnicza do wprowadzania cyfr w czasie rzeczywistym w polach <input>
function formatInputField(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    let rawValue = inputEl.value.replace(/\s/g, '').replace(',', '.');
    
    if (rawValue === '') {
      inputEl.value = '';
      return;
    }

    // Pozwól na dozwolone znaki (cyfry, opcjonalnie jeden minus na początku, kropka/przecinek)
    const isNegative = rawValue.startsWith('-');
    if (isNegative) rawValue = rawValue.substring(1);

    const parts = rawValue.split('.');
    // Usuń nie-cyfry z części całkowitej
    parts[0] = parts[0].replace(/\D/g, '');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    if (parts.length > 2) {
      parts.length = 2; // Tylko jeden separator dziesiętny
    }

    let formatted = parts.join(',');
    if (isNegative) formatted = '-' + formatted;

    inputEl.value = formatted;
  });
}

function getCleanNumberFromInput(inputEl) {
  if (!inputEl || !inputEl.value) return 0;
  const cleanVal = inputEl.value.replace(/\s/g, '').replace(',', '.');
  return parseFloat(cleanVal) || 0;
}

function setFormattedInputValue(inputEl, value) {
  if (!inputEl) return;
  if (value === 0 || value === undefined || value === null || isNaN(value)) {
    inputEl.value = '';
    return;
  }
  const parts = Number(value).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  inputEl.value = parts.join(',');
}

// Elementy DOM
const profileSelect = document.getElementById('profile-select');
const profileSubtitle = document.getElementById('profile-subtitle');
const initialBalanceInput = document.getElementById('initial-balance-input');
const saveInitialBalanceBtn = document.getElementById('save-initial-balance-btn');

const totalIncomeEl = document.getElementById('total-income');
const totalExpenseEl = document.getElementById('total-expense');
const monthBalanceEl = document.getElementById('month-balance');
const totalBalanceEl = document.getElementById('total-balance');

const incomeLabelEl = document.getElementById('income-label');
const expenseLabelEl = document.getElementById('expense-label');
const monthBalanceLabelEl = document.getElementById('month-balance-label');

const transactionForm = document.getElementById('transaction-form');
const descriptionInput = document.getElementById('description');
const amountInput = document.getElementById('amount');
const dateInput = document.getElementById('date');
const typeInput = document.getElementById('type');

const transactionList = document.getElementById('transaction-list');
const loadMoreBtn = document.getElementById('load-more-btn');
const groupedSummaryContainer = document.getElementById('grouped-summary-container');

const searchFrom = document.getElementById('search-from');
const searchTo = document.getElementById('search-to');
const searchType = document.getElementById('search-type');
const searchBtn = document.getElementById('search-btn');
const resetSearchBtn = document.getElementById('reset-search-btn');

const printPdfBtn = document.getElementById('print-pdf-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const importFileInput = document.getElementById('import-file-input');
const clearAllBtn = document.getElementById('clear-all-btn');

// Elementy modala edycji
const editModal = document.getElementById('edit-modal');
const editIdInput = document.getElementById('edit-id');
const editDescriptionInput = document.getElementById('edit-description');
const editAmountInput = document.getElementById('edit-amount');
const editDateInput = document.getElementById('edit-date');
const editTypeInput = document.getElementById('edit-type');
const saveModalBtn = document.getElementById('save-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const deleteModalBtn = document.getElementById('delete-modal-btn');

// --- NORMALIZACJA TEKSTU ---
function normalizeText(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase()
    .trim();
}

// --- INDEXEDDB ---
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const dbInstance = e.target.result;
      if (!dbInstance.objectStoreNames.contains('transactions')) {
        dbInstance.createObjectStore('transactions', { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains('settings')) {
        dbInstance.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => {
      console.error('Błąd otwierania IndexedDB:', e.target.error);
      reject(e.target.error);
    };
  });
}

function loadDataFromDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'settings'], 'readonly');
    const txStore = tx.objectStore('transactions');
    const settingsStore = tx.objectStore('settings');

    const reqTx = txStore.getAll();
    const reqBalances = settingsStore.get('initialBalances');

    let loadedTransactions = [];
    let loadedBalances = { private: 0, company: 0 };

    reqTx.onsuccess = () => {
      loadedTransactions = reqTx.result || [];
    };

    reqBalances.onsuccess = () => {
      if (reqBalances.result && reqBalances.result.value) {
        loadedBalances = reqBalances.result.value;
      }
    };

    tx.oncomplete = () => {
      transactions = loadedTransactions;
      initialBalances = loadedBalances;
      resolve();
    };

    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveTransactionToDB(transaction) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    store.put(transaction);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

function deleteTransactionFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    const store = tx.objectStore('transactions');
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveBalancesToDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    store.put({ key: 'initialBalances', value: initialBalances });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveAllDataToDB(newTransactions, newBalances) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'settings'], 'readwrite');
    const txStore = tx.objectStore('transactions');
    const settingsStore = tx.objectStore('settings');

    txStore.clear();
    newTransactions.forEach(t => txStore.put(t));
    settingsStore.put({ key: 'initialBalances', value: newBalances });

    tx.oncomplete = () => {
      transactions = newTransactions;
      initialBalances = newBalances;
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function migrateFromLocalStorage() {
  const savedTransactions = localStorage.getItem('budget_transactions');
  const savedBalances = localStorage.getItem('budget_initial_balances');

  if (savedTransactions || savedBalances) {
    let oldTx = [];
    let oldBal = { private: 0, company: 0 };

    try {
      if (savedTransactions) oldTx = JSON.parse(savedTransactions);
      if (savedBalances) oldBal = JSON.parse(savedBalances);
    } catch (e) {
      console.error('Błąd odczytu danych do migracji', e);
    }

    if (oldTx.length > 0 || oldBal.private > 0 || oldBal.company > 0) {
      await saveAllDataToDB(oldTx, oldBal);
    }

    localStorage.removeItem('budget_transactions');
    localStorage.removeItem('budget_initial_balances');
  }
}

// --- LOGIKA BANERA PRZYPOMINAJĄCEGO O KOPII ---
function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function checkAndRunMonthlyAutoBackup() {
  const currentMonthKey = getCurrentMonthKey();
  const isDownloaded = localStorage.getItem(`backup_downloaded_${currentMonthKey}`);
  const isDismissedInSession = sessionStorage.getItem(`backup_dismissed_${currentMonthKey}`);

  const banner = document.getElementById('backup-banner');
  if (!banner) return;

  if (transactions.length > 0 && !isDownloaded && !isDismissedInSession) {
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

function setupBannerEvents() {
  const bannerDownloadBtn = document.getElementById('banner-download-btn');
  const bannerDismissBtn = document.getElementById('banner-dismiss-btn');
  const banner = document.getElementById('backup-banner');

  if (bannerDownloadBtn) {
    bannerDownloadBtn.addEventListener('click', () => {
      exportDataJSON();
    });
  }

  if (bannerDismissBtn) {
    bannerDismissBtn.addEventListener('click', () => {
      const currentMonthKey = getCurrentMonthKey();
      sessionStorage.setItem(`backup_dismissed_${currentMonthKey}`, 'true');
      if (banner) banner.style.display = 'none';
    });
  }
}

// --- INICJALIZACJA ---
document.addEventListener('DOMContentLoaded', async () => {
  if (dateInput) dateInput.valueAsDate = new Date();

  formatInputField(initialBalanceInput);
  formatInputField(amountInput);
  formatInputField(editAmountInput);

  try {
    await initDB();
    await migrateFromLocalStorage();
    await loadDataFromDB();
  } catch (err) {
    console.error('Nie udało się załadować IndexedDB:', err);
  }

  setupEventListeners();
  renderApp();
  checkAndRunMonthlyAutoBackup();
});

function setupEventListeners() {
  setupBannerEvents();

  if (profileSelect) {
    profileSelect.addEventListener('change', (e) => {
      currentProfile = e.target.value;
      if (profileSubtitle) profileSubtitle.textContent = currentProfile === 'private' ? 'Prywatny' : 'Firmowy';
      displayedCount = 10;
      currentSearchFilter = null;
      selectedGroups.clear();
      resetSearchInputs();
      renderApp();
    });
  }

  if (saveInitialBalanceBtn) {
    saveInitialBalanceBtn.addEventListener('click', async () => {
      const val = getCleanNumberFromInput(initialBalanceInput);
      initialBalances[currentProfile] = val;
      await saveBalancesToDB();
      renderApp();
    });
  }

  if (transactionForm) transactionForm.addEventListener('submit', handleAddTransaction);

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      displayedCount += 10;
      renderTransactionsList();
    });
  }

  const showSavingsCheckbox = document.getElementById('show-savings-checkbox');
  if (showSavingsCheckbox) {
    showSavingsCheckbox.addEventListener('change', (e) => {
      showSavingsEntries = e.target.checked;
      renderApp();
    });
  }

  if (searchBtn) searchBtn.addEventListener('click', handleSearch);
  if (resetSearchBtn) resetSearchBtn.addEventListener('click', handleResetSearch);

  if (printPdfBtn) {
    printPdfBtn.addEventListener('click', () => {
      const previousCount = displayedCount;
      displayedCount = Infinity;
      renderTransactionsList();

      setTimeout(() => {
        window.print();
        displayedCount = previousCount;
        renderTransactionsList();
      }, 50);
    });
  }

  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportDataJSON);
  if (importJsonBtn && importFileInput) {
    importJsonBtn.addEventListener('click', () => {
      importFileInput.value = '';
      importFileInput.click();
    });
    importFileInput.addEventListener('change', importDataJSON);
  }
  if (clearAllBtn) clearAllBtn.addEventListener('click', clearCurrentProfileData);

  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeEditModal);
  if (saveModalBtn) saveModalBtn.addEventListener('click', handleSaveEditModal);
  if (deleteModalBtn) deleteModalBtn.addEventListener('click', handleDeleteFromModal);
}

async function handleAddTransaction(e) {
  e.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = getCleanNumberFromInput(amountInput);
  const date = dateInput.value;
  const type = typeInput.value;

  if (!description || isNaN(amount) || amount <= 0 || !date) return;

  const mainId = Date.now().toString();

  const newTransaction = {
    id: mainId,
    profile: currentProfile,
    description,
    amount,
    date,
    type,
    isSavings: false
  };

  transactions.push(newTransaction);
  await saveTransactionToDB(newTransaction);

  if (type === 'expense' && currentProfile === 'private' && amount >= 10) {
    const savingsTransaction = {
      id: `${mainId}_savings`,
      profile: currentProfile,
      description: 'Auto-Oszczędzanie',
      amount: 3.00,
      date,
      type: 'expense',
      isSavings: true,
      relatedTransactionId: mainId
    };
    transactions.push(savingsTransaction);
    await saveTransactionToDB(savingsTransaction);
  }

  descriptionInput.value = '';
  amountInput.value = '';
  dateInput.valueAsDate = new Date();

  renderApp();
  checkAndRunMonthlyAutoBackup();
}

function renderApp() {
  if (initialBalanceInput) {
    const val = initialBalances[currentProfile];
    setFormattedInputValue(initialBalanceInput, val);
  }

  const profileTransactions = transactions.filter(t => (t.profile || 'private') === currentProfile);

  calculateBalances(profileTransactions);

  const allTimeAndTypeFiltered = getTimeAndTypeFilteredTransactions(true);
  renderGroupedSummary(allTimeAndTypeFiltered);

  const listFiltered = getTimeAndTypeFilteredTransactions(false);
  renderTransactionsList(listFiltered);
}

function calculateBalances(profileTransactions) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthNamesPL = [
    'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
  ];
  const monthName = monthNamesPL[currentMonth];

  if (incomeLabelEl) incomeLabelEl.textContent = `Przychody (${monthName} ${currentYear})`;
  if (expenseLabelEl) expenseLabelEl.textContent = `Wydatki (${monthName} ${currentYear})`;
  if (monthBalanceLabelEl) monthBalanceLabelEl.textContent = `Wynik (${monthName} ${currentYear})`;

  let monthIncome = 0;
  let monthExpense = 0;
  let totalNet = initialBalances[currentProfile] || 0;

  profileTransactions.forEach(t => {
    const tDate = new Date(t.date);
    const isCurrentMonth = tDate.getFullYear() === currentYear && tDate.getMonth() === currentMonth;

    if (t.type === 'income') {
      totalNet += t.amount;
      if (isCurrentMonth) monthIncome += t.amount;
    } else {
      totalNet -= t.amount;
      if (isCurrentMonth) monthExpense += t.amount;
    }
  });

  const monthBalance = monthIncome - monthExpense;

  if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(monthIncome);
  if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(monthExpense);
  if (monthBalanceEl) {
    monthBalanceEl.textContent = formatCurrency(monthBalance);
    monthBalanceEl.className = monthBalance >= 0 ? 'income-text' : 'expense-text';
  }
  if (totalBalanceEl) {
    totalBalanceEl.textContent = formatCurrency(totalNet);
    totalBalanceEl.className = totalNet >= 0 ? 'income-text' : 'expense-text';
  }
}

function renderGroupedSummary(filteredTransactions) {
  if (!groupedSummaryContainer) return;
  groupedSummaryContainer.innerHTML = '';

  const incomeGroups = {};
  const expenseGroups = {};

  filteredTransactions.forEach(t => {
    const rawName = t.isSavings ? 'Auto-Oszczędzanie' : t.description;
    const groupKey = normalizeText(rawName);
    const targetGroup = t.type === 'income' ? incomeGroups : expenseGroups;

    if (!targetGroup[groupKey]) {
      targetGroup[groupKey] = { 
        displayName: rawName,
        count: 0, 
        total: 0, 
        type: t.type 
      };
    }
    targetGroup[groupKey].count += 1;
    targetGroup[groupKey].total += t.amount;
  });

  const sortedIncomeKeys = Object.keys(incomeGroups).sort((a, b) => incomeGroups[b].total - incomeGroups[a].total);
  const sortedExpenseKeys = Object.keys(expenseGroups).sort((a, b) => expenseGroups[b].total - expenseGroups[a].total);

  if (sortedIncomeKeys.length === 0 && sortedExpenseKeys.length === 0) {
    groupedSummaryContainer.innerHTML = '<div style="color:#aaa; text-align:center;">Brak danych</div>';
    return;
  }

  const renderGroupSection = (title, sortedKeys, groupData, typeClass) => {
    if (sortedKeys.length === 0) return;

    const sectionHeader = document.createElement('div');
    sectionHeader.className = `summary-group-header ${typeClass}`;
    sectionHeader.textContent = title;
    groupedSummaryContainer.appendChild(sectionHeader);

    const ul = document.createElement('ul');
    ul.style.listStyle = 'none';

    sortedKeys.forEach(key => {
      const item = groupData[key];
      const li = document.createElement('li');
      li.className = 'grouped-item';
      li.style.cursor = 'pointer';
      li.style.transition = 'all 0.2s ease';
      
      const isSelected = selectedGroups.has(key);
      if (isSelected) {
        li.style.backgroundColor = 'rgba(0, 123, 255, 0.25)';
        li.style.borderLeft = '4px solid #007bff';
        li.style.paddingLeft = '8px';
      }

      const sign = item.type === 'income' ? '+' : '-';
      const colorClass = item.type === 'income' ? 'income-text' : 'expense-text';

      li.innerHTML = `
        <span>
          <strong>${item.displayName}</strong> <small>(${item.count}x)</small>
          ${isSelected ? '<span style="color:#007bff; margin-left: 5px; font-weight:bold;">&#10004;</span>' : ''}
        </span>
        <span class="${colorClass}">${sign}${formatCurrency(item.total)}</span>
      `;

      li.addEventListener('click', () => {
        toggleGroupSelection(key);
      });

      ul.appendChild(li);
    });

    groupedSummaryContainer.appendChild(ul);
  };

  renderGroupSection('Przychody', sortedIncomeKeys, incomeGroups, 'income');
  renderGroupSection('Wydatki', sortedExpenseKeys, expenseGroups, 'expense');
}

function toggleGroupSelection(groupKey) {
  if (selectedGroups.has(groupKey)) {
    selectedGroups.delete(groupKey);
  } else {
    selectedGroups.add(groupKey);
  }
  displayedCount = 10;
  renderApp();
}

function getTimeAndTypeFilteredTransactions(ignoreSavingsFilter = false) {
  let list = transactions.filter(t => (t.profile || 'private') === currentProfile);

  if (!ignoreSavingsFilter && !showSavingsEntries) {
    list = list.filter(t => !t.isSavings);
  }

  if (currentSearchFilter) {
    const { from, to, type } = currentSearchFilter;
    if (from) list = list.filter(t => t.date >= from);
    if (to) list = list.filter(t => t.date <= to);
    if (type && type !== 'all') list = list.filter(t => t.type === type);
  } else {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    list = list.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });
  }

  list.sort((a, b) => new Date(b.date) - new Date(a.date) || b.id.localeCompare(a.id));
  return list;
}

function renderTransactionsList(baseFilteredList) {
  if (!transactionList) return;
  transactionList.innerHTML = '';
  
  let filtered = baseFilteredList || getTimeAndTypeFilteredTransactions(false);

  if (selectedGroups.size > 0) {
    filtered = filtered.filter(t => {
      const rawKey = t.isSavings ? 'Auto-Oszczędzanie' : t.description;
      const normalizedKey = normalizeText(rawKey);
      return selectedGroups.has(normalizedKey);
    });
  }

  const toDisplay = filtered.slice(0, displayedCount);

  if (toDisplay.length === 0) {
    transactionList.innerHTML = '<li style="color:#aaa; text-align:center; padding: 15px;">Brak transakcji dla wybranych kryteriów</li>';
    if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    return;
  }

  toDisplay.forEach(t => {
    const li = document.createElement('li');
    li.className = `transaction-item ${t.type}`;
    
    const isAutoSavings = !!t.isSavings;
    if (isAutoSavings) li.style.opacity = '0.75';

    const sign = t.type === 'income' ? '+' : '-';
    const amountColor = t.type === 'income' ? 'income-text' : 'expense-text';

    const actionBtnHtml = isAutoSavings 
      ? '' 
      : `<button class="action-btn hide-on-print" title="Zarządzaj" onclick="openEditModal('${t.id}')">&#9998;</button>`;

    li.innerHTML = `
      <div class="info">
        <strong>${t.description}</strong>
        <span class="${amountColor}">${sign}${formatCurrency(t.amount)} &bull; ${t.date}</span>
      </div>
      ${actionBtnHtml}
    `;
    transactionList.appendChild(li);
  });

  if (loadMoreBtn) {
    if (filtered.length > displayedCount) {
      loadMoreBtn.style.display = 'block';
      loadMoreBtn.textContent = `Pokaż więcej (zostało ${filtered.length - displayedCount})`;
    } else {
      loadMoreBtn.style.display = 'none';
    }
  }
}

function openEditModal(id) {
  const item = transactions.find(t => t.id === id);
  if (!item) return;

  editIdInput.value = item.id;
  editDescriptionInput.value = item.description;
  setFormattedInputValue(editAmountInput, item.amount);
  editDateInput.value = item.date;
  if (editTypeInput) editTypeInput.value = item.type || 'expense';

  editModal.style.display = 'flex';
}

function closeEditModal() {
  if (editModal) editModal.style.display = 'none';
}

async function handleSaveEditModal() {
  const id = editIdInput.value;
  const newDesc = editDescriptionInput.value.trim();
  const newAmount = getCleanNumberFromInput(editAmountInput);
  const newDate = editDateInput.value;
  const newType = editTypeInput ? editTypeInput.value : 'expense';

  if (!newDesc || isNaN(newAmount) || newAmount <= 0 || !newDate) {
    alert('Uzupełnij poprawnie wszystkie pola!');
    return;
  }

  const index = transactions.findIndex(t => t.id === id);
  if (index !== -1) {
    const mainTx = transactions[index];
    mainTx.description = newDesc;
    mainTx.amount = newAmount;
    mainTx.date = newDate;
    mainTx.type = newType;

    await saveTransactionToDB(mainTx);

    const profile = mainTx.profile || 'private';
    const relatedIndex = transactions.findIndex(t => t.relatedTransactionId === id);

    if (profile === 'private') {
      if (newType === 'expense' && newAmount >= 10) {
        if (relatedIndex !== -1) {
          transactions[relatedIndex].date = newDate;
          await saveTransactionToDB(transactions[relatedIndex]);
        } else {
          const newSavings = {
            id: `${id}_savings`,
            profile: 'private',
            description: 'Auto-Oszczędzanie',
            amount: 3.00,
            date: newDate,
            type: 'expense',
            isSavings: true,
            relatedTransactionId: id
          };
          transactions.push(newSavings);
          await saveTransactionToDB(newSavings);
        }
      } else {
        if (relatedIndex !== -1) {
          const removed = transactions.splice(relatedIndex, 1)[0];
          await deleteTransactionFromDB(removed.id);
        }
      }
    } else {
      if (relatedIndex !== -1) {
        const removed = transactions.splice(relatedIndex, 1)[0];
        await deleteTransactionFromDB(removed.id);
      }
    }

    renderApp();
    closeEditModal();
  }
}

async function handleDeleteFromModal() {
  const id = editIdInput.value;
  const item = transactions.find(t => t.id === id);
  
  if (!item) return;

  if (confirm(`Czy na pewno chcesz usunąć transakcję "${item.description}" na kwotę ${formatCurrency(item.amount)}?`)) {
    const relatedIndex = transactions.findIndex(t => t.relatedTransactionId === id);
    if (relatedIndex !== -1) {
      const relatedId = transactions[relatedIndex].id;
      await deleteTransactionFromDB(relatedId);
    }

    await deleteTransactionFromDB(id);
    transactions = transactions.filter(t => t.id !== id && t.relatedTransactionId !== id);

    renderApp();
    closeEditModal();
  }
}

function handleSearch() {
  const from = searchFrom ? searchFrom.value : '';
  const to = searchTo ? searchTo.value : '';
  const type = searchType ? searchType.value : 'all';

  if (!from && !to && type === 'all') return;

  currentSearchFilter = { from, to, type };
  displayedCount = 10;
  renderApp();
}

function handleResetSearch() {
  resetSearchInputs();
  currentSearchFilter = null;
  selectedGroups.clear();
  displayedCount = 10;
  renderApp();
}

function resetSearchInputs() {
  if (searchFrom) searchFrom.value = '';
  if (searchTo) searchTo.value = '';
  if (searchType) searchType.value = 'all';
}

function exportDataJSON() {
  const exportPayload = {
    initialBalances: initialBalances,
    transactions: transactions
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `budzet_domowy_kopia_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  const currentMonthKey = getCurrentMonthKey();
  localStorage.setItem(`backup_downloaded_${currentMonthKey}`, 'true');

  const banner = document.getElementById('backup-banner');
  if (banner) banner.style.display = 'none';
}

function importDataJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      let importedTransactions = [];
      let importedBalances = { private: 0, company: 0 };

      if (parsed && (parsed.initialBalances !== undefined || parsed.transactions !== undefined)) {
        if (parsed.initialBalances) {
          importedBalances = {
            private: parseFloat(parsed.initialBalances.private) || 0,
            company: parseFloat(parsed.initialBalances.company) || 0
          };
        }
        if (Array.isArray(parsed.transactions)) {
          importedTransactions = parsed.transactions.map(t => ({
            ...t,
            description: t.description || t.title || 'Bez nazwy',
            amount: parseFloat(t.amount) || 0,
            profile: t.profile || 'private',
            isSavings: !!t.isSavings
          }));
        }
      } else if (parsed && parsed.profiles) {
        Object.keys(parsed.profiles).forEach(profileKey => {
          const profileData = parsed.profiles[profileKey];
          if (profileData.initialBalance !== undefined) {
            importedBalances[profileKey] = parseFloat(profileData.initialBalance) || 0;
          }
          if (Array.isArray(profileData.transactions)) {
            profileData.transactions.forEach((item, index) => {
              importedTransactions.push({
                id: item.id || `${Date.now()}_${profileKey}_${index}`,
                profile: profileKey,
                description: item.title || item.description || 'Bez nazwy',
                amount: parseFloat(item.amount) || 0,
                date: item.date,
                type: item.type || 'expense',
                isSavings: !!item.isSavings
              });
            });
          }
        });
      } else if (Array.isArray(parsed)) {
        importedTransactions = parsed.map(t => ({
          ...t,
          description: t.description || t.title || 'Bez nazwy',
          amount: parseFloat(t.amount) || 0,
          profile: t.profile || 'private',
          isSavings: !!t.isSavings
        }));
      } else {
        alert('Błędny format pliku kopii zapasowej.');
        return;
      }

      await saveAllDataToDB(importedTransactions, importedBalances);
      renderApp();
      checkAndRunMonthlyAutoBackup();
      alert('Kopia zapasowa została pomyślnie wczytana!');
    } catch (err) {
      alert('Nie udało się odczytać pliku JSON.');
    }
  };
  reader.readAsText(file);
}

async function clearCurrentProfileData() {
  if (confirm(`Czy na pewno chcesz usunąć wszystkie transakcje dla profilu: ${currentProfile === 'private' ? 'Prywatny' : 'Firmowy'}?`)) {
    const remainingTransactions = transactions.filter(t => (t.profile || 'private') !== currentProfile);
    const newBalances = { ...initialBalances, [currentProfile]: 0 };

    await saveAllDataToDB(remainingTransactions, newBalances);
    selectedGroups.clear();
    renderApp();
    checkAndRunMonthlyAutoBackup();
  }
}