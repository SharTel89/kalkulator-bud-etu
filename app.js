// Konfiguracja Bazy Danych IndexedDB
const DB_NAME = 'BudgetAppDB';
const DB_VERSION = 2;
let db = null;

// Konfiguracja Google OAuth 2.0 & Drive API
const GOOGLE_CLIENT_ID = '182085201225-hrmhauseh1m366tbg96qr7hd94mj00ie.apps.googleusercontent.com';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
let tokenClient = null;
let googleAccessToken = null;

// Stała nazwa pliku kopii zapasowej na Dysku Google
const GDRIVE_BACKUP_FILENAME = 'budzet_domowy_kopia.json';

// Stan aplikacji
let currentProfile = 'private'; // 'private' lub 'company'
let transactions = [];
let recurringExpenses = [];
let selectedRecurringByProfile = { private: new Set(), company: new Set() };
let initialBalances = { private: 0, company: 0 };
let autoSaveConfig = {
  private: { enabled: false, minAmount: 10, amount: 3 },
  company: { enabled: false, minAmount: 10, amount: 3 }
};
let syncAdrianEnabled = false;
let displayedCount = 10;
let currentSearchFilter = null;
let showSavingsEntries = false;
let selectedGroups = new Set();

// Flaga określająca, czy użytkownik ma niezapisane lokalne zmiany
let hasUnsavedChanges = false;

// Zmienna przechowująca identyfikator aktywnego timera toastu
let toastTimeout = null;

// Zmienna przechowująca aktywny resolver dla modala potwierdzeń showConfirmModal
let activeConfirmResolve = null;

// --- POMOCNICZE FORMATOWANIE DATY LOKALNEJ (YYYY-MM-DD) ---
function getLocalDateString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- FORMATOWANIE KWOT ZE SPACJĄ CO 3 CYFRY ---
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  const parts = num.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${parts.join(',')} PLN`;
}

function formatInputField(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    let rawValue = inputEl.value.replace(/\s/g, '').replace(',', '.');
    
    if (rawValue === '') {
      inputEl.value = '';
      return;
    }

    const isNegative = rawValue.startsWith('-');
    if (isNegative) rawValue = rawValue.substring(1);

    const parts = rawValue.split('.');
    parts[0] = parts[0].replace(/\D/g, '');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    if (parts.length > 2) {
      parts.length = 2;
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

// --- FORMATOWANIE NUMERU KONTA (NRB: 2-4-4-4-4-4-4) ---
function formatBankAccount(account) {
  if (!account) return '';
  const clean = account.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  let countryCode = '';
  let digits = clean;
  
  if (clean.startsWith('PL')) {
    countryCode = 'PL ';
    digits = clean.substring(2);
  } else if (/^[A-Z]{2}/.test(clean)) {
    countryCode = clean.substring(0, 2) + ' ';
    digits = clean.substring(2);
  }

  digits = digits.replace(/\D/g, '').slice(0, 26);

  if (digits.length === 0) return countryCode.trim();

  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 2));
  for (let i = 2; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }

  return countryCode + parts.join(' ');
}

function formatAccountInputField(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', () => {
    const cursorPos = inputEl.selectionStart;
    const previousLength = inputEl.value.length;
    
    inputEl.value = formatBankAccount(inputEl.value);

    const newLength = inputEl.value.length;
    const diff = newLength - previousLength;
    inputEl.setSelectionRange(cursorPos + diff, cursorPos + diff);
  });
}

// Elementy DOM
const btnProfilePrivate = document.getElementById('btn-profile-private');
const btnProfileCompany = document.getElementById('btn-profile-company');
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

const syncAdrianWrapper = document.getElementById('sync-adrian-wrapper');
const syncAdrianCheckbox = document.getElementById('sync-adrian-checkbox');

// Autooszczędzanie - elementy DOM
const autosaveSection = document.querySelector('.autosave-section');
const autosaveEnableCheckbox = document.getElementById('autosave-enable-checkbox');
const autosaveInputsWrapper = document.getElementById('autosave-inputs-wrapper');
const autosaveMinAmountInput = document.getElementById('autosave-min-amount');
const autosaveAmountInput = document.getElementById('autosave-amount');
const saveAutosaveBtn = document.getElementById('save-autosave-btn');

// Notatnik stałych wydatków - elementy DOM
const recurringForm = document.getElementById('recurring-form');
const recNameInput = document.getElementById('rec-name');
const recAmountInput = document.getElementById('rec-amount');
const recAccountInput = document.getElementById('rec-account');
const recurringListEl = document.getElementById('recurring-list');
const selectedRecurringTotalEl = document.getElementById('selected-recurring-total');
const toggleSelectAllRecBtn = document.getElementById('toggle-select-all-rec-btn');
const addSelectedRecBtn = document.getElementById('add-selected-rec-btn');
const deleteSelectedRecBtn = document.getElementById('delete-selected-rec-btn');

// Modal edycji notatnika
const editRecurringModal = document.getElementById('edit-recurring-modal');
const editRecIdInput = document.getElementById('edit-rec-id');
const editRecNameInput = document.getElementById('edit-rec-name');
const editRecAmountInput = document.getElementById('edit-rec-amount');
const editRecAccountInput = document.getElementById('edit-rec-account');
const saveRecModalBtn = document.getElementById('save-rec-modal-btn');
const cancelRecModalBtn = document.getElementById('cancel-rec-modal-btn');
const deleteRecModalBtn = document.getElementById('delete-rec-modal-btn');

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

// Elementy Google Drive DOM
const gdriveStatusText = document.getElementById('gdrive-status-text');
const gdriveAuthBtn = document.getElementById('gdrive-auth-btn');
const gdriveSaveBtn = document.getElementById('gdrive-save-btn');
const gdriveLoadBtn = document.getElementById('gdrive-load-btn');
const gdriveLogoutBtn = document.getElementById('gdrive-logout-btn');
const gdriveFileModal = document.getElementById('gdrive-file-modal');
const gdriveFileList = document.getElementById('gdrive-file-list');
const gdriveFileModalCancelBtn = document.getElementById('gdrive-file-modal-cancel-btn');

// Modal potwierdzenia zapisu na Google Drive przy wyjściu
const gdriveConfirmModal = document.getElementById('gdrive-confirm-modal');
const gdriveConfirmSaveBtn = document.getElementById('gdrive-confirm-save-btn');
const gdriveConfirmDismissBtn = document.getElementById('gdrive-confirm-dismiss-btn');

// Elementy modala edycji transakcji
const editModal = document.getElementById('edit-modal');
const editIdInput = document.getElementById('edit-id');
const editDescriptionInput = document.getElementById('edit-description');
const editAmountInput = document.getElementById('edit-amount');
const editDateInput = document.getElementById('edit-date');
const editTypeInput = document.getElementById('edit-type');
const saveModalBtn = document.getElementById('save-modal-btn');
const cancelModalBtn = document.getElementById('cancel-modal-btn');
const deleteModalBtn = document.getElementById('delete-modal-btn');

// Elementy modala duplikacji transakcji
const duplicateModal = document.getElementById('duplicate-modal');
const duplicateIdInput = document.getElementById('duplicate-id');
const duplicateModalText = document.getElementById('duplicate-modal-text');
const confirmDuplicateModalBtn = document.getElementById('confirm-duplicate-modal-btn');
const cancelDuplicateModalBtn = document.getElementById('cancel-duplicate-modal-btn');

// Elementy uniwersalnego modala potwierdzenia
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalMessage = document.getElementById('confirm-modal-message');
const confirmModalOkBtn = document.getElementById('confirm-modal-ok-btn');
const confirmModalCancelBtn = document.getElementById('confirm-modal-cancel-btn');

// Elementy modala informacyjnego statusu
const toastStatusModal = document.getElementById('toast-status-modal');
const toastStatusTitle = document.getElementById('toast-status-title');
const toastStatusMessage = document.getElementById('toast-status-message');

function markUnsavedChanges() {
  hasUnsavedChanges = true;
}

function clearUnsavedChanges() {
  hasUnsavedChanges = false;
}

function hideToastModal() {
  if (!toastStatusModal) return;
  toastStatusModal.style.display = 'none';
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
}

// Funkcja wyświetlająca tymczasowy modal informacyjny
function showToastModal(title, message, isSuccess = true) {
  if (!toastStatusModal) return;

  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  const card = toastStatusModal.querySelector('.toast-modal-card');
  if (card) {
    card.classList.remove('success', 'error');
    card.classList.add(isSuccess ? 'success' : 'error');
  }

  if (toastStatusTitle) toastStatusTitle.textContent = title;
  if (toastStatusMessage) toastStatusMessage.textContent = message;

  toastStatusModal.style.display = 'flex';

  toastTimeout = setTimeout(() => {
    hideToastModal();
  }, 2000);
}

// Zastąpienie natywnego window.confirm asynchronicznym modalem
function showConfirmModal(message, title = 'Potwierdzenie') {
  return new Promise((resolve) => {
    if (!confirmModal) {
      resolve(false);
      return;
    }

    if (activeConfirmResolve) {
      activeConfirmResolve(false);
    }
    activeConfirmResolve = resolve;

    if (confirmModalTitle) confirmModalTitle.textContent = title;
    if (confirmModalMessage) confirmModalMessage.textContent = message;

    confirmModal.style.display = 'flex';

    const handleOk = () => {
      cleanup();
      activeConfirmResolve = null;
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      activeConfirmResolve = null;
      resolve(false);
    };

    const cleanup = () => {
      confirmModal.style.display = 'none';
      if (confirmModalOkBtn) confirmModalOkBtn.removeEventListener('click', handleOk);
      if (confirmModalCancelBtn) confirmModalCancelBtn.removeEventListener('click', handleCancel);
    };

    if (confirmModalOkBtn) confirmModalOkBtn.addEventListener('click', handleOk);
    if (confirmModalCancelBtn) confirmModalCancelBtn.addEventListener('click', handleCancel);
  });
}

// Zarządzanie zamykaniem modali ESC / kliknięciem w tło
function closeAllCloseableModals() {
  hideToastModal();
  closeEditModal();
  closeEditRecurringModal();
  closeDuplicateModal();
  closeGDriveFileModal();
  closeGDriveConfirmModal();

  if (confirmModal && confirmModal.style.display !== 'none') {
    confirmModal.style.display = 'none';
    if (activeConfirmResolve) {
      activeConfirmResolve(false);
      activeConfirmResolve = null;
    }
  }
}

function setupModalCloseListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllCloseableModals();
    }
  });

  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAllCloseableModals();
      }
    });
  });
}

function normalizeText(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase()
    .trim();
}

// Generuje unikalny klucz dla grupy zależny od jej typu (income/expense) i nazwy
function getGroupCompositeKey(type, text) {
  return `${type}:${normalizeText(text)}`;
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
      if (!dbInstance.objectStoreNames.contains('recurring')) {
        dbInstance.createObjectStore('recurring', { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => reject(e.target.error);
  });
}

function loadDataFromDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'settings', 'recurring'], 'readonly');
    const txStore = tx.objectStore('transactions');
    const settingsStore = tx.objectStore('settings');
    const recStore = tx.objectStore('recurring');

    const reqTx = txStore.getAll();
    const reqBalances = settingsStore.get('initialBalances');
    const reqAutoSave = settingsStore.get('autoSaveConfig');
    const reqSyncAdrian = settingsStore.get('syncAdrianEnabled');
    const reqSelectedRec = settingsStore.get('selectedRecurringByProfile');
    const reqRec = recStore.getAll();

    let loadedTransactions = [];
    let loadedRecurring = [];
    let loadedBalances = { private: 0, company: 0 };
    let loadedAutoSave = {
      private: { enabled: false, minAmount: 10, amount: 3 },
      company: { enabled: false, minAmount: 10, amount: 3 }
    };
    let loadedSyncAdrian = false;
    let loadedSelectedRec = { private: [], company: [] };

    reqTx.onsuccess = () => { loadedTransactions = reqTx.result || []; };
    reqRec.onsuccess = () => { loadedRecurring = reqRec.result || []; };
    reqBalances.onsuccess = () => {
      if (reqBalances.result && reqBalances.result.value) {
        loadedBalances = reqBalances.result.value;
      }
    };
    reqAutoSave.onsuccess = () => {
      if (reqAutoSave.result && reqAutoSave.result.value) {
        loadedAutoSave = reqAutoSave.result.value;
      }
    };
    reqSyncAdrian.onsuccess = () => {
      if (reqSyncAdrian.result && reqSyncAdrian.result.value !== undefined) {
        loadedSyncAdrian = reqSyncAdrian.result.value;
      }
    };
    reqSelectedRec.onsuccess = () => {
      if (reqSelectedRec.result && reqSelectedRec.result.value) {
        loadedSelectedRec = reqSelectedRec.result.value;
      }
    };

    tx.oncomplete = () => {
      transactions = loadedTransactions;
      recurringExpenses = loadedRecurring;
      initialBalances = loadedBalances;
      autoSaveConfig = loadedAutoSave;
      syncAdrianEnabled = loadedSyncAdrian;
      selectedRecurringByProfile = {
        private: new Set(loadedSelectedRec.private || []),
        company: new Set(loadedSelectedRec.company || [])
      };
      resolve();
    };

    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveTransactionToDB(transaction) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    tx.objectStore('transactions').put(transaction);
    tx.oncomplete = () => {
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

function deleteTransactionFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('transactions', 'readwrite');
    tx.objectStore('transactions').delete(id);
    tx.oncomplete = () => {
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveRecurringToDB(item) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recurring', 'readwrite');
    tx.objectStore('recurring').put(item);
    tx.oncomplete = () => {
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

function deleteRecurringFromDB(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('recurring', 'readwrite');
    tx.objectStore('recurring').delete(id);
    tx.oncomplete = () => {
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveBalancesToDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'initialBalances', value: initialBalances });
    tx.oncomplete = () => {
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveAutoSaveSettingsToDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'autoSaveConfig', value: autoSaveConfig });
    tx.oncomplete = () => {
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveSyncAdrianToDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'syncAdrianEnabled', value: syncAdrianEnabled });
    tx.oncomplete = () => {
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveSelectedRecurringToDB() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    const serializable = {
      private: Array.from(selectedRecurringByProfile.private || []),
      company: Array.from(selectedRecurringByProfile.company || [])
    };
    tx.objectStore('settings').put({ key: 'selectedRecurringByProfile', value: serializable });
    tx.oncomplete = () => {
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

function saveAllDataToDB(newTransactions, newBalances, newAutoSave, newRecurring = [], newSelectedRec = null, newSyncAdrian = null) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['transactions', 'settings', 'recurring'], 'readwrite');
    const txStore = tx.objectStore('transactions');
    const settingsStore = tx.objectStore('settings');
    const recStore = tx.objectStore('recurring');

    txStore.clear();
    recStore.clear();

    newTransactions.forEach(t => txStore.put(t));
    newRecurring.forEach(r => recStore.put(r));

    settingsStore.put({ key: 'initialBalances', value: newBalances });
    if (newAutoSave) {
      settingsStore.put({ key: 'autoSaveConfig', value: newAutoSave });
    }

    if (newSyncAdrian !== null && newSyncAdrian !== undefined) {
      settingsStore.put({ key: 'syncAdrianEnabled', value: newSyncAdrian });
    }

    if (newSelectedRec) {
      settingsStore.put({ key: 'selectedRecurringByProfile', value: newSelectedRec });
    }

    tx.oncomplete = () => {
      transactions = newTransactions;
      recurringExpenses = newRecurring;
      initialBalances = newBalances;
      if (newAutoSave) autoSaveConfig = newAutoSave;
      if (newSyncAdrian !== null && newSyncAdrian !== undefined) syncAdrianEnabled = newSyncAdrian;
      if (newSelectedRec) {
        selectedRecurringByProfile = {
          private: new Set(newSelectedRec.private || []),
          company: new Set(newSelectedRec.company || [])
        };
      }
      markUnsavedChanges();
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });
}

// --- LOGIKA GOOGLE DRIVE API & OAUTH ---
function initGoogleAuth() {
  const storedToken = sessionStorage.getItem('gdrive_access_token');
  if (storedToken) {
    googleAccessToken = storedToken;
    updateGDriveUI(true);
  } else {
    updateGDriveUI(false);
  }

  if (window.google && window.google.accounts && window.google.accounts.oauth2) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('Błąd logowania Google:', response);
          showToastModal('Błąd autoryzacji', 'Nie udało się zalogować do konta Google.', false);
          return;
        }
        googleAccessToken = response.access_token;
        sessionStorage.setItem('gdrive_access_token', googleAccessToken);
        updateGDriveUI(true);
        showToastModal('Zalogowano', 'Pomyślnie połączono z kontem Google Drive!', true);
      }
    });
  }
}

function handleGDriveAuth() {
  if (!tokenClient) {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      initGoogleAuth();
    } else {
      showToastModal('Błąd ładowania SDK', 'Biblioteka Google Identity Services nie została jeszcze załadowana.', false);
      return;
    }
  }
  // Usunięto prompt: 'consent', aby nie wymuszać ponownego potwierdzania za każdym razem
  tokenClient.requestAccessToken();
}

function handleGDriveLogout() {
  googleAccessToken = null;
  sessionStorage.removeItem('gdrive_access_token');
  updateGDriveUI(false);
  showToastModal('Wylogowano', 'Rozłączono z kontem Google Drive.', true);
}

function updateGDriveUI(isLoggedIn) {
  if (!gdriveStatusText || !gdriveAuthBtn || !gdriveSaveBtn || !gdriveLoadBtn || !gdriveLogoutBtn) return;

  if (isLoggedIn) {
    gdriveStatusText.textContent = 'Stan: Zalogowano do Google';
    gdriveStatusText.style.color = '#28a745';
    gdriveAuthBtn.style.display = 'none';
    gdriveSaveBtn.style.display = 'block';
    gdriveLoadBtn.style.display = 'block';
    gdriveLogoutBtn.style.display = 'block';
  } else {
    gdriveStatusText.textContent = 'Stan: Niepołączono';
    gdriveStatusText.style.color = '#aaa';
    gdriveAuthBtn.style.display = 'block';
    gdriveSaveBtn.style.display = 'none';
    gdriveLoadBtn.style.display = 'none';
    gdriveLogoutBtn.style.display = 'none';
  }
}

function getExportPayload() {
  return {
    initialBalances: initialBalances,
    autoSaveConfig: autoSaveConfig,
    syncAdrianEnabled: syncAdrianEnabled,
    transactions: transactions,
    recurringExpenses: recurringExpenses,
    selectedRecurringByProfile: {
      private: Array.from(selectedRecurringByProfile.private || []),
      company: Array.from(selectedRecurringByProfile.company || [])
    }
  };
}

// Funkcja pomocnicza wyszukująca ID pliku kopii na Google Drive
async function findExistingBackupFileId() {
  const q = encodeURIComponent(`name = '${GDRIVE_BACKUP_FILENAME}' and mimeType = 'application/json' and trashed = false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: {
      'Authorization': `Bearer ${googleAccessToken}`
    }
  });

  if (res.status === 401) {
    handleGDriveLogout();
    throw new Error('UNAUTHORIZED');
  }

  if (!res.ok) {
    throw new Error(`Błąd HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

async function saveToGoogleDrive(showToast = true) {
  if (!googleAccessToken) {
    if (showToast) showToastModal('Brak dostępu', 'Musisz się najpierw zalogować do Google Drive.', false);
    return false;
  }

  const payload = getExportPayload();
  const jsonString = JSON.stringify(payload, null, 2);

  try {
    const existingFileId = await findExistingBackupFileId();

    if (existingFileId) {
      // Nadpisanie istniejącego pliku (PATCH)
      const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: jsonString
      });

      if (!res.ok) {
        throw new Error(`Błąd HTTP ${res.status}`);
      }

      clearUnsavedChanges();
      if (showToast) showToastModal('Sukces', 'Plik kopii na Google Drive został pomyślnie nadpisany!', true);
      return true;
    } else {
      // Utworzenie pierwszego pliku (POST multipart)
      const metadata = {
        name: GDRIVE_BACKUP_FILENAME,
        mimeType: 'application/json'
      };

      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', new Blob([jsonString], { type: 'application/json' }));

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`
        },
        body: form
      });

      if (!res.ok) {
        throw new Error(`Błąd HTTP ${res.status}`);
      }

      clearUnsavedChanges();
      if (showToast) showToastModal('Sukces', 'Utworzono nową kopię zapasową na Google Drive!', true);
      return true;
    }
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') {
      if (showToast) showToastModal('Sesja wygasła', 'Proszę zalogować się ponownie do Google Drive.', false);
      return false;
    }
    console.error('Błąd podczas zapisu pliku na Google Drive:', err);
    if (showToast) showToastModal('Błąd zapisu', 'Nie udało się zapisać kopii na Google Drive.', false);
    return false;
  }
}

async function listGoogleDriveFiles() {
  if (!googleAccessToken) {
    showToastModal('Brak dostępu', 'Musisz się najpierw zalogować do Google Drive.', false);
    return;
  }

  try {
    const q = encodeURIComponent(`name contains 'budzet_domowy_kopia' and mimeType = 'application/json' and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime%20desc&fields=files(id,name,createdTime)`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    });

    if (res.status === 401) {
      handleGDriveLogout();
      showToastModal('Sesja wygasła', 'Proszę zalogować się ponownie do Google Drive.', false);
      return;
    }

    const data = await res.json();
    if (!data.files || data.files.length === 0) {
      showToastModal('Brak plików', 'Nie znaleziono zapisanych kopii zapasowych na Twoim Dysku Google.', false);
      return;
    }

    renderGDriveFileList(data.files);
    if (gdriveFileModal) gdriveFileModal.style.display = 'flex';
  } catch (err) {
    console.error('Błąd podczas pobierania listy plików z Google Drive:', err);
    showToastModal('Błąd pobierania', 'Nie udało się pobrać listy plików z Google Drive.', false);
  }
}

function renderGDriveFileList(files) {
  if (!gdriveFileList) return;
  gdriveFileList.innerHTML = '';

  files.forEach(file => {
    const li = document.createElement('li');
    li.className = 'gdrive-file-item';
    const dateStr = new Date(file.createdTime).toLocaleString('pl-PL');

    li.innerHTML = `
      <div class="gdrive-file-info">
        <strong>${file.name}</strong>
        <small>Utworzono: ${dateStr}</small>
      </div>
      <button class="btn btn-primary" style="padding: 6px 12px; font-size: 0.85rem; width: auto;">Wczytaj</button>
    `;

    const loadBtn = li.querySelector('button');
    loadBtn.addEventListener('click', () => {
      loadFromGoogleDrive(file.id);
      closeGDriveFileModal();
    });

    gdriveFileList.appendChild(li);
  });
}

function closeGDriveFileModal() {
  if (gdriveFileModal) gdriveFileModal.style.display = 'none';
}

async function loadFromGoogleDrive(fileId) {
  if (!googleAccessToken) return;

  const confirmed = await showConfirmModal(
    'Wczytanie kopii zapasowej zastąpi dotychczasowe dane w aplikacji. Czy chcesz kontynuować?',
    'Wczytaj z Google Drive'
  );

  if (!confirmed) return;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    });

    if (!res.ok) {
      throw new Error(`Błąd HTTP ${res.status}`);
    }

    const parsed = await res.json();
    await applyImportedPayload(parsed);
  } catch (err) {
    console.error('Błąd pobierania / przetwarzania pliku z Google Drive:', err);
    showToastModal('Błąd wczytywania', 'Nie udało się przetworzyć pliku pobranego z Google Drive.', false);
  }
}

async function applyImportedPayload(parsed) {
  let importedTransactions = [];
  let importedRecurring = [];
  let importedBalances = { private: 0, company: 0 };
  let importedAutoSave = {
    private: { enabled: false, minAmount: 10, amount: 3 },
    company: { enabled: false, minAmount: 10, amount: 3 }
  };
  let importedSyncAdrian = false;
  let importedSelectedRec = { private: [], company: [] };

  if (parsed && (parsed.initialBalances !== undefined || parsed.transactions !== undefined || parsed.autoSaveConfig !== undefined || parsed.recurringExpenses !== undefined || parsed.selectedRecurringByProfile !== undefined)) {
    if (parsed.initialBalances) {
      importedBalances = {
        private: parseFloat(parsed.initialBalances.private) || 0,
        company: parseFloat(parsed.initialBalances.company) || 0
      };
    }
    if (parsed.autoSaveConfig) {
      importedAutoSave = parsed.autoSaveConfig;
    }
    if (parsed.syncAdrianEnabled !== undefined) {
      importedSyncAdrian = !!parsed.syncAdrianEnabled;
    }
    if (parsed.selectedRecurringByProfile) {
      importedSelectedRec = {
        private: Array.isArray(parsed.selectedRecurringByProfile.private) ? parsed.selectedRecurringByProfile.private : [],
        company: Array.isArray(parsed.selectedRecurringByProfile.company) ? parsed.selectedRecurringByProfile.company : []
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
    if (Array.isArray(parsed.recurringExpenses)) {
      importedRecurring = parsed.recurringExpenses.map(r => ({
        ...r,
        name: r.name || 'Bez nazwy',
        amount: parseFloat(r.amount) || 0,
        account: formatBankAccount(r.account || ''),
        profile: r.profile || 'private'
      }));
    }
  } else if (Array.isArray(parsed)) {
    importedTransactions = parsed.map(t => ({
      ...t,
      description: t.description || t.title || 'Bez nazwy',
      amount: parseFloat(t.amount) || 0,
      profile: t.profile || 'private',
      isSavings: !!t.isSavings
    }));
  } else {
    showToastModal('Błąd importu', 'Dane pliku nie zawierają poprawnej struktury.', false);
    return;
  }

  await saveAllDataToDB(importedTransactions, importedBalances, importedAutoSave, importedRecurring, importedSelectedRec, importedSyncAdrian);
  clearUnsavedChanges();
  renderApp();
  showToastModal('Sukces', 'Kopia zapasowa została pomyślnie wczytana!', true);
}

// --- LOGIKA POTWIERDZENIA ZAPISU KOPbackup DRIVE PRZY ZAMYKANIU STRONY ---
function showGDriveConfirmModal() {
  if (gdriveConfirmModal) {
    gdriveConfirmModal.style.display = 'flex';
  }
}

function closeGDriveConfirmModal() {
  if (gdriveConfirmModal) {
    gdriveConfirmModal.style.display = 'none';
  }
}

function setupBeforeUnloadAndGDriveConfirm() {
  // Ochrona przed zacięciem/zostawieniem niezapisanych danych w przeglądarce
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = ''; // Standardowy mechanizm przeglądarki wymagany dla monitu o wyjściu
    }
  });

  if (gdriveConfirmSaveBtn) {
    gdriveConfirmSaveBtn.addEventListener('click', async () => {
      if (!googleAccessToken) {
        closeGDriveConfirmModal();
        handleGDriveAuth();
        return;
      }
      const success = await saveToGoogleDrive(true);
      if (success) {
        closeGDriveConfirmModal();
      }
    });
  }

  if (gdriveConfirmDismissBtn) {
    gdriveConfirmDismissBtn.addEventListener('click', () => {
      closeGDriveConfirmModal();
    });
  }
}

// --- INICJALIZACJA ---
document.addEventListener('DOMContentLoaded', async () => {
  if (dateInput) dateInput.value = getLocalDateString();

  formatInputField(initialBalanceInput);
  formatInputField(amountInput);
  formatInputField(editAmountInput);
  formatInputField(autosaveMinAmountInput);
  formatInputField(autosaveAmountInput);
  formatInputField(recAmountInput);
  formatInputField(editRecAmountInput);

  // Podpięcie automatycznego formatowania numeru konta
  formatAccountInputField(recAccountInput);
  formatAccountInputField(editRecAccountInput);

  try {
    await initDB();
    await loadDataFromDB();
  } catch (err) {
    console.error('Nie udało się załadować IndexedDB:', err);
    showToastModal('Błąd bazy danych', 'Nie udało się załadować lokalnej bazy IndexedDB.', false);
  }

  initGoogleAuth();
  setupEventListeners();
  setupModalCloseListeners();
  setupBeforeUnloadAndGDriveConfirm();
  renderApp();
});

function setProfile(profile) {
  if (currentProfile === profile) return;
  currentProfile = profile;

  if (profileSubtitle) {
    profileSubtitle.textContent = currentProfile === 'private' ? 'Prywatny' : 'Firmowy';
  }

  if (btnProfilePrivate && btnProfileCompany) {
    if (currentProfile === 'private') {
      btnProfilePrivate.classList.add('active');
      btnProfileCompany.classList.remove('active');
    } else {
      btnProfileCompany.classList.add('active');
      btnProfilePrivate.classList.remove('active');
    }
  }

  displayedCount = 10;
  currentSearchFilter = null;
  selectedGroups.clear();
  resetSearchInputs();
  renderApp();
}

function setupEventListeners() {
  if (toastStatusModal) {
    toastStatusModal.addEventListener('click', () => {
      hideToastModal();
    });
  }

  if (btnProfilePrivate) {
    btnProfilePrivate.addEventListener('click', () => setProfile('private'));
  }
  if (btnProfileCompany) {
    btnProfileCompany.addEventListener('click', () => setProfile('company'));
  }

  if (syncAdrianCheckbox) {
    syncAdrianCheckbox.addEventListener('change', (e) => {
      syncAdrianEnabled = e.target.checked;
      saveSyncAdrianToDB();
    });
  }

  if (saveInitialBalanceBtn) {
    saveInitialBalanceBtn.addEventListener('click', async () => {
      const val = getCleanNumberFromInput(initialBalanceInput);
      initialBalances[currentProfile] = val;
      await saveBalancesToDB();
      renderApp();

      const originalText = saveInitialBalanceBtn.textContent;
      saveInitialBalanceBtn.textContent = 'Zapisano ✓';
      saveInitialBalanceBtn.classList.add('btn-success');
      saveInitialBalanceBtn.disabled = true;

      setTimeout(() => {
        saveInitialBalanceBtn.textContent = originalText;
        saveInitialBalanceBtn.classList.remove('btn-success');
        saveInitialBalanceBtn.disabled = false;
      }, 2000);
    });
  }

  if (transactionForm) transactionForm.addEventListener('submit', handleAddTransaction);

  // Notatnik - obsługa formularza dodawania i akcji grupowych
  if (recurringForm) {
    recurringForm.addEventListener('submit', handleAddRecurring);
  }
  if (toggleSelectAllRecBtn) {
    toggleSelectAllRecBtn.addEventListener('click', handleToggleSelectAllRecurring);
  }
  if (addSelectedRecBtn) {
    addSelectedRecBtn.addEventListener('click', handleAddSelectedRecurringAsExpense);
  }
  if (deleteSelectedRecBtn) {
    deleteSelectedRecBtn.addEventListener('click', handleDeleteSelectedRecurring);
  }

  // Obsługa interfejsu Autooszczędzania
  if (autosaveEnableCheckbox) {
    autosaveEnableCheckbox.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      autosaveInputsWrapper.style.display = enabled ? 'flex' : 'none';
      
      if (autosaveSection) {
        if (enabled) {
          autosaveSection.classList.add('autosave-active');
        } else {
          autosaveSection.classList.remove('autosave-active');
        }
      }

      autoSaveConfig[currentProfile].enabled = enabled;
      saveAutoSaveSettingsToDB();
    });
  }

  if (saveAutosaveBtn) {
    saveAutosaveBtn.addEventListener('click', async () => {
      const minAmount = getCleanNumberFromInput(autosaveMinAmountInput);
      const saveAmount = getCleanNumberFromInput(autosaveAmountInput);

      autoSaveConfig[currentProfile] = {
        enabled: autosaveEnableCheckbox.checked,
        minAmount: minAmount,
        amount: saveAmount
      };

      await saveAutoSaveSettingsToDB();

      const originalText = saveAutosaveBtn.textContent;
      saveAutosaveBtn.textContent = 'Zapisano ✓';
      saveAutosaveBtn.classList.remove('btn-primary');
      saveAutosaveBtn.classList.add('btn-success');
      saveAutosaveBtn.disabled = true;

      setTimeout(() => {
        saveAutosaveBtn.textContent = originalText;
        saveAutosaveBtn.classList.remove('btn-success');
        saveAutosaveBtn.classList.add('btn-primary');
        saveAutosaveBtn.disabled = false;
      }, 2000);
    });
  }

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

  // Akcje Google Drive
  if (gdriveAuthBtn) gdriveAuthBtn.addEventListener('click', handleGDriveAuth);
  if (gdriveLogoutBtn) gdriveLogoutBtn.addEventListener('click', handleGDriveLogout);
  if (gdriveSaveBtn) gdriveSaveBtn.addEventListener('click', () => saveToGoogleDrive(true));
  if (gdriveLoadBtn) gdriveLoadBtn.addEventListener('click', listGoogleDriveFiles);
  if (gdriveFileModalCancelBtn) gdriveFileModalCancelBtn.addEventListener('click', closeGDriveFileModal);

  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeEditModal);
  if (saveModalBtn) saveModalBtn.addEventListener('click', handleSaveEditModal);
  if (deleteModalBtn) deleteModalBtn.addEventListener('click', handleDeleteFromModal);

  // Modale Notatnika
  if (cancelRecModalBtn) cancelRecModalBtn.addEventListener('click', closeEditRecurringModal);
  if (saveRecModalBtn) saveRecModalBtn.addEventListener('click', handleSaveEditRecurringModal);
  if (deleteRecModalBtn) deleteRecModalBtn.addEventListener('click', handleDeleteFromRecurringModal);

  // Modal Duplikacji
  if (cancelDuplicateModalBtn) cancelDuplicateModalBtn.addEventListener('click', closeDuplicateModal);
  if (confirmDuplicateModalBtn) confirmDuplicateModalBtn.addEventListener('click', handleConfirmDuplicate);
}

// Pomocnicza funkcja dodająca pojedynczy wydatek z obsługą Autooszczędzania oraz opcjonalnej relacji Adrian -> Praca
async function addExpenseTransaction(description, amount, date = getLocalDateString()) {
  const mainId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);

  const isCompanyAdrian = currentProfile === 'company' && syncAdrianEnabled && normalizeText(description) === 'adrian';
  const syncPairId = isCompanyAdrian ? 'sync_' + mainId : null;

  const newTransaction = {
    id: mainId,
    profile: currentProfile,
    description,
    amount,
    date,
    type: 'expense',
    isSavings: false,
    syncPairId: syncPairId
  };

  transactions.push(newTransaction);
  await saveTransactionToDB(newTransaction);

  // Tworzenie automatycznej połączonej transakcji Przychód "Praca" na profilu prywatnym tylko jeśli opcja jest aktywna
  if (isCompanyAdrian) {
    const pairedTransaction = {
      id: 'paired_' + mainId,
      profile: 'private',
      description: 'Praca',
      amount,
      date,
      type: 'income',
      isSavings: false,
      syncPairId: syncPairId
    };
    transactions.push(pairedTransaction);
    await saveTransactionToDB(pairedTransaction);
  }

  const profileAutoSave = autoSaveConfig[currentProfile] || { enabled: false, minAmount: 0, amount: 0 };
  if (profileAutoSave.enabled && amount >= profileAutoSave.minAmount && profileAutoSave.amount > 0) {
    const savingsTransaction = {
      id: `${mainId}_savings`,
      profile: currentProfile,
      description: 'Auto-Oszczędzanie',
      amount: profileAutoSave.amount,
      date,
      type: 'expense',
      isSavings: true,
      relatedTransactionId: mainId
    };
    transactions.push(savingsTransaction);
    await saveTransactionToDB(savingsTransaction);
  }
}

// Funkcje obsługi modala duplikacji
function openDuplicateModal(id) {
  const sourceTx = transactions.find(t => t.id === id);
  if (!sourceTx) return;

  duplicateIdInput.value = id;
  if (duplicateModalText) {
    duplicateModalText.textContent = `Czy na pewno chcesz zduplikować transakcję "${sourceTx.description}" (${formatCurrency(sourceTx.amount)}) z dzisiejszą datą?`;
  }
  if (duplicateModal) duplicateModal.style.display = 'flex';
}

function closeDuplicateModal() {
  if (duplicateModal) duplicateModal.style.display = 'none';
}

async function handleConfirmDuplicate() {
  const id = duplicateIdInput.value;
  await duplicateTransaction(id);
  closeDuplicateModal();
}

// Funkcja duplikująca istniejącą transakcję na dzisiejszy dzień
async function duplicateTransaction(id) {
  const sourceTx = transactions.find(t => t.id === id);
  if (!sourceTx) return;

  const todayStr = getLocalDateString();

  if (sourceTx.type === 'expense') {
    await addExpenseTransaction(sourceTx.description, sourceTx.amount, todayStr);
  } else {
    const mainId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 5);
    const newTransaction = {
      id: mainId,
      profile: currentProfile,
      description: sourceTx.description,
      amount: sourceTx.amount,
      date: todayStr,
      type: 'income',
      isSavings: false
    };
    transactions.push(newTransaction);
    await saveTransactionToDB(newTransaction);
  }

  renderApp();
  showToastModal('Sukces', 'Transakcja została pomyślnie zduplikowana!', true);
}

async function handleAddTransaction(e) {
  e.preventDefault();

  const description = descriptionInput.value.trim();
  const amount = getCleanNumberFromInput(amountInput);
  const date = dateInput.value;
  const type = typeInput.value;

  if (!description || isNaN(amount) || amount <= 0 || !date) return;

  if (type === 'expense') {
    await addExpenseTransaction(description, amount, date);
  } else {
    const mainId = Date.now().toString();
    const newTransaction = {
      id: mainId,
      profile: currentProfile,
      description,
      amount,
      date,
      type: 'income',
      isSavings: false
    };
    transactions.push(newTransaction);
    await saveTransactionToDB(newTransaction);
  }

  descriptionInput.value = '';
  amountInput.value = '';
  dateInput.value = getLocalDateString();

  renderApp();
}

// --- LOGIKA NOTATNIKA STAŁYCH WYDATKÓW ---
async function handleAddRecurring(e) {
  e.preventDefault();

  const name = recNameInput.value.trim();
  const amount = getCleanNumberFromInput(recAmountInput);
  const account = formatBankAccount(recAccountInput.value);

  if (!name || isNaN(amount) || amount <= 0) return;

  const newItem = {
    id: Date.now().toString(),
    profile: currentProfile,
    name,
    amount,
    account
  };

  recurringExpenses.push(newItem);
  await saveRecurringToDB(newItem);

  recNameInput.value = '';
  recAmountInput.value = '';
  recAccountInput.value = '';

  renderRecurringList();
}

async function handleToggleSelectAllRecurring() {
  const profileItems = recurringExpenses.filter(r => (r.profile || 'private') === currentProfile);
  if (profileItems.length === 0) return;

  const currentSelectedSet = selectedRecurringByProfile[currentProfile];
  const allSelected = profileItems.every(r => currentSelectedSet.has(r.id));

  if (allSelected) {
    profileItems.forEach(r => currentSelectedSet.delete(r.id));
  } else {
    profileItems.forEach(r => currentSelectedSet.add(r.id));
  }

  await saveSelectedRecurringToDB();
  renderRecurringList();
}

async function handleAddSelectedRecurringAsExpense() {
  const currentSelectedSet = selectedRecurringByProfile[currentProfile];
  const selectedItems = recurringExpenses.filter(r => (r.profile || 'private') === currentProfile && currentSelectedSet.has(r.id));

  if (selectedItems.length === 0) {
    showToastModal('Brak zaznaczonych', 'Zaznacz pozycje w notatniku, aby je dodać.', false);
    return;
  }

  const confirmed = await showConfirmModal(
    `Czy na pewno chcesz dodać zaznaczone pozycje (${selectedItems.length}) jako wydatki?`,
    'Dodaj zaznaczone jako wydatek'
  );

  if (!confirmed) return;

  const todayStr = getLocalDateString();

  for (const item of selectedItems) {
    await addExpenseTransaction(item.name, item.amount, todayStr);
  }

  renderApp();
  showToastModal('Sukces', `Dodano zaznaczone wydatki (${selectedItems.length}) do listy transakcji.`, true);
}

async function handleDeleteSelectedRecurring() {
  const currentSelectedSet = selectedRecurringByProfile[currentProfile];
  const selectedIds = Array.from(currentSelectedSet);

  if (selectedIds.length === 0) {
    showToastModal('Brak zaznaczonych', 'Zaznacz pozycje w notatniku, aby je usunąć.', false);
    return;
  }

  const confirmed = await showConfirmModal(
    `Czy na pewno chcesz usunąć zaznaczone pozycje (${selectedIds.length}) z notatnika?`,
    'Usuń zaznaczone'
  );

  if (confirmed) {
    for (const id of selectedIds) {
      await deleteRecurringFromDB(id);
      currentSelectedSet.delete(id);
    }
    recurringExpenses = recurringExpenses.filter(r => !selectedIds.includes(r.id));

    await saveSelectedRecurringToDB();
    renderRecurringList();
  }
}

function renderRecurringList() {
  if (!recurringListEl) return;
  recurringListEl.innerHTML = '';

  let profileItems = recurringExpenses.filter(r => (r.profile || 'private') === currentProfile);

  // Sortowanie alfabetyczne po nazwie
  profileItems.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));

  if (profileItems.length === 0) {
    recurringListEl.innerHTML = '<li style="color:#aaa; text-align:center; padding: 15px;">Brak wpisów w notatniku</li>';
    calculateSelectedRecurringTotal();
    return;
  }

  const currentSelectedSet = selectedRecurringByProfile[currentProfile];

  profileItems.forEach(item => {
    const isChecked = currentSelectedSet.has(item.id);
    const li = document.createElement('li');
    li.className = `recurring-item ${isChecked ? 'selected' : ''}`;

    li.innerHTML = `
      <input type="checkbox" class="recurring-item-checkbox" ${isChecked ? 'checked' : ''} />
      <div class="rec-info">
        <strong>${item.name}</strong>
        <span class="expense-text">${formatCurrency(item.amount)}</span>
        ${item.account ? `<span class="rec-account">Konto: ${formatBankAccount(item.account)}</span>` : ''}
      </div>
      <div class="rec-actions-group">
        <button class="action-btn add-single-rec-btn" title="Dodaj jako wydatek">+</button>
        <button class="action-btn edit-rec-btn" title="Edytuj">&#9998;</button>
      </div>
    `;

    const checkbox = li.querySelector('.recurring-item-checkbox');
    checkbox.addEventListener('change', async () => {
      if (checkbox.checked) {
        currentSelectedSet.add(item.id);
      } else {
        currentSelectedSet.delete(item.id);
      }
      await saveSelectedRecurringToDB();
      renderRecurringList();
    });

    const addSingleBtn = li.querySelector('.add-single-rec-btn');
    addSingleBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const todayStr = getLocalDateString();
      await addExpenseTransaction(item.name, item.amount, todayStr);
      renderApp();
      showToastModal('Sukces', `Dodano wydatek "${item.name}" (${formatCurrency(item.amount)}).`, true);
    });

    const editBtn = li.querySelector('.edit-rec-btn');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditRecurringModal(item.id);
    });

    recurringListEl.appendChild(li);
  });

  calculateSelectedRecurringTotal();
}

function calculateSelectedRecurringTotal() {
  let sum = 0;
  const currentSelectedSet = selectedRecurringByProfile[currentProfile];

  recurringExpenses
    .filter(r => (r.profile || 'private') === currentProfile && currentSelectedSet.has(r.id))
    .forEach(item => {
      sum += item.amount;
    });

  if (selectedRecurringTotalEl) {
    selectedRecurringTotalEl.textContent = formatCurrency(sum);
  }
}

function openEditRecurringModal(id) {
  const item = recurringExpenses.find(r => r.id === id);
  if (!item) return;

  editRecIdInput.value = item.id;
  editRecNameInput.value = item.name;
  setFormattedInputValue(editRecAmountInput, item.amount);
  editRecAccountInput.value = formatBankAccount(item.account || '');

  if (editRecurringModal) editRecurringModal.style.display = 'flex';
}

function closeEditRecurringModal() {
  if (editRecurringModal) editRecurringModal.style.display = 'none';
}

async function handleSaveEditRecurringModal() {
  const id = editRecIdInput.value;
  const name = editRecNameInput.value.trim();
  const amount = getCleanNumberFromInput(editRecAmountInput);
  const account = formatBankAccount(editRecAccountInput.value);

  if (!name || isNaN(amount) || amount <= 0) {
    return;
  }

  const index = recurringExpenses.findIndex(r => r.id === id);
  if (index !== -1) {
    recurringExpenses[index].name = name;
    recurringExpenses[index].amount = amount;
    recurringExpenses[index].account = account;

    await saveRecurringToDB(recurringExpenses[index]);
    renderRecurringList();
    closeEditRecurringModal();
  }
}

async function handleDeleteFromRecurringModal() {
  const id = editRecIdInput.value;
  const item = recurringExpenses.find(r => r.id === id);

  if (!item) return;

  const confirmed = await showConfirmModal(
    `Czy na pewno chcesz usunąć pozycję "${item.name}" z notatnika?`,
    'Usuń z notatnika'
  );

  if (confirmed) {
    await deleteRecurringFromDB(id);
    recurringExpenses = recurringExpenses.filter(r => r.id !== id);
    selectedRecurringByProfile.private.delete(id);
    selectedRecurringByProfile.company.delete(id);

    await saveSelectedRecurringToDB();
    renderRecurringList();
    closeEditRecurringModal();
  }
}

function renderApp() {
  if (initialBalanceInput) {
    const val = initialBalances[currentProfile];
    setFormattedInputValue(initialBalanceInput, val);
  }

  if (syncAdrianWrapper && syncAdrianCheckbox) {
    if (currentProfile === 'company') {
      syncAdrianWrapper.style.display = 'flex';
      syncAdrianCheckbox.checked = syncAdrianEnabled;
    } else {
      syncAdrianWrapper.style.display = 'none';
    }
  }

  const currentAutoSave = autoSaveConfig[currentProfile] || { enabled: false, minAmount: 10, amount: 3 };
  if (autosaveEnableCheckbox) {
    autosaveEnableCheckbox.checked = currentAutoSave.enabled;
    autosaveInputsWrapper.style.display = currentAutoSave.enabled ? 'flex' : 'none';
  }
  
  if (autosaveSection) {
    if (currentAutoSave.enabled) {
      autosaveSection.classList.add('autosave-active');
    } else {
      autosaveSection.classList.remove('autosave-active');
    }
  }

  if (autosaveMinAmountInput) {
    setFormattedInputValue(autosaveMinAmountInput, currentAutoSave.minAmount);
  }
  if (autosaveAmountInput) {
    setFormattedInputValue(autosaveAmountInput, currentAutoSave.amount);
  }

  const profileTransactions = transactions.filter(t => (t.profile || 'private') === currentProfile);

  calculateBalances(profileTransactions);

  const allTimeAndTypeFiltered = getTimeAndTypeFilteredTransactions(true);
  renderGroupedSummary(allTimeAndTypeFiltered);

  const listFiltered = getTimeAndTypeFilteredTransactions(false);
  renderTransactionsList(listFiltered);

  renderRecurringList();
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
    const [year, month] = t.date.split('-').map(Number);
    const isCurrentMonth = year === currentYear && (month - 1) === currentMonth;

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
    const groupKey = getGroupCompositeKey(t.type, rawName);
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

      li.addEventListener('click', () => toggleGroupSelection(key));
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
      const [year, month] = t.date.split('-').map(Number);
      return year === currentYear && (month - 1) === currentMonth;
    });
  }

  list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return list;
}

function renderTransactionsList(baseFilteredList) {
  if (!transactionList) return;
  transactionList.innerHTML = '';
  
  let filtered = baseFilteredList || getTimeAndTypeFilteredTransactions(false);

  if (selectedGroups.size > 0) {
    filtered = filtered.filter(t => {
      const rawName = t.isSavings ? 'Auto-Oszczędzanie' : t.description;
      const compositeKey = getGroupCompositeKey(t.type, rawName);
      return selectedGroups.has(compositeKey);
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
      : `<div class="transaction-actions hide-on-print">
          <button class="action-btn duplicate-btn" title="Duplikuj z dzisiejszą datą">&#128203;</button>
          <button class="action-btn edit-btn" title="Zarządzaj">&#9998;</button>
         </div>`;

    li.innerHTML = `
      <div class="info">
        <strong>${t.description}</strong>
        <span class="${amountColor}">${sign}${formatCurrency(t.amount)} &bull; ${t.date}</span>
      </div>
      ${actionBtnHtml}
    `;

    if (!isAutoSavings) {
      const dupBtn = li.querySelector('.duplicate-btn');
      if (dupBtn) {
        dupBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openDuplicateModal(t.id);
        });
      }

      const editBtn = li.querySelector('.edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditModal(t.id);
        });
      }
    }

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

    // Obsługa synchronizacji powiązanej transakcji (Adrian na firmowym <-> Praca na prywatnym)
    if (mainTx.syncPairId) {
      const pairedTx = transactions.find(t => t.syncPairId === mainTx.syncPairId && t.id !== id);
      if (pairedTx) {
        pairedTx.amount = newAmount;
        pairedTx.date = newDate;
        await saveTransactionToDB(pairedTx);
      }
    }

    const profile = mainTx.profile || 'private';
    const relatedIndex = transactions.findIndex(t => t.relatedTransactionId === id);
    const profileAutoSave = autoSaveConfig[profile] || { enabled: false, minAmount: 0, amount: 0 };

    if (newType === 'expense' && profileAutoSave.enabled && newAmount >= profileAutoSave.minAmount && profileAutoSave.amount > 0) {
      if (relatedIndex !== -1) {
        transactions[relatedIndex].date = newDate;
        transactions[relatedIndex].amount = profileAutoSave.amount;
        await saveTransactionToDB(transactions[relatedIndex]);
      } else {
        const newSavings = {
          id: `${id}_savings`,
          profile: profile,
          description: 'Auto-Oszczędzanie',
          amount: profileAutoSave.amount,
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

    renderApp();
    closeEditModal();
  }
}

async function handleDeleteFromModal() {
  const id = editIdInput.value;
  const item = transactions.find(t => t.id === id);
  
  if (!item) return;

  const confirmed = await showConfirmModal(
    `Czy na pewno chcesz usunąć transakcję "${item.description}" na kwotę ${formatCurrency(item.amount)}?`,
    'Usuń transakcję'
  );

  if (confirmed) {
    // Usunięcie synchronizowanej drugiej połowy pary
    if (item.syncPairId) {
      const pairedTx = transactions.find(t => t.syncPairId === item.syncPairId && t.id !== id);
      if (pairedTx) {
        await deleteTransactionFromDB(pairedTx.id);
        transactions = transactions.filter(t => t.id !== pairedTx.id);
      }
    }

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
  const exportPayload = getExportPayload();

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const objectUrl = URL.createObjectURL(blob);

  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", objectUrl);
  downloadAnchor.setAttribute("download", `budzet_domowy_kopia_${getLocalDateString()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);

  clearUnsavedChanges();
}

async function importDataJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const confirmed = await showConfirmModal(
    'Wczytanie kopii zapasowej zastąpi dotychczasowe dane. Czy chcesz kontynuować?',
    'Wczytaj kopię JSON'
  );

  if (!confirmed) {
    e.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      await applyImportedPayload(parsed);
    } catch (err) {
      console.error('Nie udało się odczytać pliku JSON:', err);
      showToastModal('Błąd importu', 'Nie udało się przetworzyć pliku JSON. Upewnij się, że plik nie jest uszkodzony.', false);
    }
  };
  reader.readAsText(file);
}

async function clearCurrentProfileData() {
  const profileLabel = currentProfile === 'private' ? 'Prywatny' : 'Firmowy';
  const confirmed = await showConfirmModal(
    `Czy na pewno chcesz usunąć wszystkie transakcje oraz notatnik dla profilu: ${profileLabel}?`,
    'Wyczyszczenie profilu'
  );

  if (confirmed) {
    const remainingTransactions = transactions.filter(t => (t.profile || 'private') !== currentProfile);
    const remainingRecurring = recurringExpenses.filter(r => (r.profile || 'private') !== currentProfile);
    const newBalances = { ...initialBalances, [currentProfile]: 0 };
    
    const newAutoSaveConfig = {
      ...autoSaveConfig,
      [currentProfile]: { enabled: false, minAmount: 10, amount: 3 }
    };

    const newSelectedRec = {
      ...selectedRecurringByProfile,
      [currentProfile]: []
    };

    await saveAllDataToDB(remainingTransactions, newBalances, newAutoSaveConfig, remainingRecurring, newSelectedRec, syncAdrianEnabled);
    selectedGroups.clear();
    renderApp();
  }
}
