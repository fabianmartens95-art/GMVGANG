(() => {
  const form = document.getElementById('creator-application-form');
  if (!(form instanceof HTMLFormElement)) return;

  const status = document.getElementById('creator-application-status');
  const unavailable = document.getElementById('creator-application-unavailable');
  const submit = form.querySelector('button[type="submit"]');
  const categoryInputs = [...form.querySelectorAll('input[name="contentCategories"]')];
  const privacyVersionInput = form.elements.namedItem('privacyNoticeVersion');
  const referralInput = form.elements.namedItem('referralCode');
  const apiOrigin = form.dataset.apiOrigin?.replace(/\/$/, '') || '';
  const storageKey = 'gmvgang.creatorApplicationIdempotencyKey';
  let privacyNoticeVersion = '';

  const setStatus = (message, kind = '') => {
    if (!status) return;
    status.textContent = message;
    status.dataset.kind = kind;
  };

  const setBusy = (busy) => {
    if (submit instanceof HTMLButtonElement) {
      submit.disabled = busy || !privacyNoticeVersion;
      submit.textContent = busy ? 'Wird gesendet …' : 'Bewerbung absenden';
    }
  };

  const showUnavailable = () => {
    form.hidden = true;
    if (unavailable instanceof HTMLElement) unavailable.hidden = false;
  };

  const selectedCategories = () => categoryInputs
    .filter((input) => input instanceof HTMLInputElement && input.checked)
    .map((input) => input.value);

  const idempotencyKey = () => {
    try {
      const existing = sessionStorage.getItem(storageKey);
      if (existing) return existing;
      const created = `creator-app:${crypto.randomUUID()}`;
      sessionStorage.setItem(storageKey, created);
      return created;
    } catch {
      return `creator-app:${crypto.randomUUID()}`;
    }
  };

  const clearIdempotencyKey = () => {
    try { sessionStorage.removeItem(storageKey); } catch { /* no-op */ }
  };

  const loadConfig = async () => {
    if (!apiOrigin) throw new Error('API_ORIGIN_MISSING');
    const response = await fetch(`${apiOrigin}/api/public/creator-application/config`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`CONFIG_${response.status}`);
    const payload = await response.json();
    if (!payload?.ok || typeof payload.privacyNoticeVersion !== 'string' || !payload.privacyNoticeVersion.trim()) {
      throw new Error('CONFIG_INVALID');
    }
    privacyNoticeVersion = payload.privacyNoticeVersion.trim();
    if (privacyVersionInput instanceof HTMLInputElement) privacyVersionInput.value = privacyNoticeVersion;
    setBusy(false);
  };

  const referral = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() || '';
  if (referralInput instanceof HTMLInputElement && /^[A-Z0-9]{6,24}$/.test(referral)) {
    referralInput.value = referral;
  }

  for (const input of categoryInputs) {
    input.addEventListener('change', () => {
      const selected = selectedCategories();
      const limitReached = selected.length >= 5;
      for (const option of categoryInputs) {
        if (option instanceof HTMLInputElement) option.disabled = limitReached && !option.checked;
      }
      if (selected.length > 5) setStatus('Bitte wähle höchstens fünf Content-Kategorien.', 'error');
      else if (status?.dataset.kind === 'error') setStatus('');
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setStatus('');

    if (!privacyNoticeVersion) {
      setStatus('Das Bewerbungsformular ist noch nicht vollständig geladen. Bitte versuche es erneut.', 'error');
      return;
    }

    const categories = selectedCategories();
    if (!form.checkValidity() || categories.length < 1 || categories.length > 5) {
      form.reportValidity();
      if (categories.length < 1) setStatus('Bitte wähle mindestens eine Content-Kategorie.', 'error');
      if (categories.length > 5) setStatus('Bitte wähle höchstens fünf Content-Kategorien.', 'error');
      return;
    }

    const data = new FormData(form);
    const payload = {
      displayName: String(data.get('displayName') || '').trim(),
      tiktokHandle: String(data.get('tiktokHandle') || '').trim(),
      email: String(data.get('email') || '').trim(),
      phone: String(data.get('phone') || '').trim() || undefined,
      followerBand: String(data.get('followerBand') || ''),
      contentCategories: categories,
      tiktokShopExperience: String(data.get('tiktokShopExperience') || ''),
      referralCode: String(data.get('referralCode') || '').trim() || undefined,
      ageConfirmed: data.get('ageConfirmed') === 'on',
      privacyAccepted: data.get('privacyAccepted') === 'on',
      privacyNoticeVersion,
      company: String(data.get('company') || ''),
    };

    setBusy(true);
    try {
      const response = await fetch(`${apiOrigin}/api/public/creator-application`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey(),
        },
        body: JSON.stringify(payload),
      });

      let result = null;
      try { result = await response.json(); } catch { /* handled below */ }

      if (response.ok && result?.ok) {
        clearIdempotencyKey();
        form.reset();
        privacyNoticeVersion = privacyVersionInput instanceof HTMLInputElement ? privacyVersionInput.value : privacyNoticeVersion;
        for (const option of categoryInputs) {
          if (option instanceof HTMLInputElement) option.disabled = false;
        }
        setStatus('Danke. Deine Bewerbung ist eingegangen. Wir prüfen dein Profil und melden uns, wenn der nächste Schritt ansteht.', 'success');
        if (submit instanceof HTMLButtonElement) submit.hidden = true;
        return;
      }

      if (response.status === 409 && Array.isArray(result?.errors) && result.errors.includes('privacy_notice_version_outdated')) {
        privacyNoticeVersion = '';
        if (privacyVersionInput instanceof HTMLInputElement) privacyVersionInput.value = '';
        await loadConfig();
        setStatus('Unsere Datenschutzhinweise wurden aktualisiert. Bitte prüfe die Datenschutzerklärung und sende die Bewerbung erneut ab.', 'error');
        return;
      }

      if (response.status === 429) {
        setStatus('Zu viele Versuche in kurzer Zeit. Bitte versuche es später erneut.', 'error');
        return;
      }

      setStatus('Die Bewerbung konnte gerade nicht gespeichert werden. Bitte versuche es erneut oder nutze den Tally-Fallback.', 'error');
    } catch {
      setStatus('Die Verbindung zum Bewerbungsservice ist gerade nicht verfügbar. Bitte versuche es erneut oder nutze den Tally-Fallback.', 'error');
    } finally {
      if (!(submit instanceof HTMLButtonElement) || !submit.hidden) setBusy(false);
    }
  });

  setBusy(true);
  loadConfig().catch(() => showUnavailable());
})();
