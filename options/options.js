/**
 * Internet Video Download Assistant - Options Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const chkFloatingBtn = document.getElementById('chkFloatingBtn');
  const selMinSize = document.getElementById('selMinSize');
  const selNamingPattern = document.getElementById('selNamingPattern');
  const btnSave = document.getElementById('btnSave');
  const saveStatus = document.getElementById('saveStatus');

  // Load saved preferences
  try {
    const prefs = await chrome.storage.local.get({
      enableFloatingButton: true,
      minFileSize: '153600',
      namingPattern: 'title'
    });

    chkFloatingBtn.checked = prefs.enableFloatingButton;
    selMinSize.value = prefs.minFileSize;
    selNamingPattern.value = prefs.namingPattern;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Save preferences
  btnSave.addEventListener('click', async () => {
    try {
      await chrome.storage.local.set({
        enableFloatingButton: chkFloatingBtn.checked,
        minFileSize: selMinSize.value,
        namingPattern: selNamingPattern.value
      });

      saveStatus.classList.remove('hidden');
      setTimeout(() => {
        saveStatus.classList.add('hidden');
      }, 2500);
    } catch (err) {
      alert(`Ayarlar kaydedilirken hata oluştu: ${err.message}`);
    }
  });
});
