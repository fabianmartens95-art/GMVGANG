const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('#main-nav');

if (menuButton && nav) {
  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = 'Menü';
    nav.dataset.open = 'false';
  };

  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    const nextOpen = !isOpen;
    menuButton.setAttribute('aria-expanded', String(nextOpen));
    menuButton.textContent = nextOpen ? 'Schließen' : 'Menü';
    nav.dataset.open = String(nextOpen);
  });

  nav.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });
}

const resultScore = document.querySelector('#result-score');
const resultBand = document.querySelector('#result-band');
if (resultScore && resultBand) {
  const params = new URLSearchParams(window.location.search);
  const scoreValue = params.get('score');
  const bandValue = params.get('band');

  if (scoreValue && /^\d{1,3}$/.test(scoreValue)) {
    const parsed = Number(scoreValue);
    if (parsed >= 0 && parsed <= 100) resultScore.textContent = String(parsed);
  }
  if (bandValue && bandValue.length <= 80) resultBand.textContent = bandValue;
}

const form = document.querySelector('#pc-form');
if (form instanceof HTMLFormElement) {
  const steps = [...form.querySelectorAll('.pc-step')];
  const error = document.querySelector('#pc-error');
  const success = document.querySelector('#pc-success');
  const failure = document.querySelector('#pc-failure');
  const stepNow = document.querySelector('#pc-step-now');
  const progress = document.querySelector('#pc-progress-fill');
  const productionHosts = new Set(['gmvgang.de', 'www.gmvgang.de']);
  const productionHost = productionHosts.has(window.location.hostname.toLowerCase());
  let current = 1;
  let busy = false;

  const field = (name) => form.elements.namedItem(name);
  const numberValue = (name) => {
    const control = field(name);
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) return 0;
    const parsed = Number(control.value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const labelValue = (name) => {
    const control = field(name);
    if (control instanceof HTMLSelectElement) return control.options[control.selectedIndex]?.text || '';
    if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) return control.value;
    return '';
  };
  const setValue = (id, value) => {
    const control = document.getElementById(id);
    if (control instanceof HTMLInputElement) control.value = value;
  };

  const setMessage = (node, text, visible) => {
    if (!(node instanceof HTMLElement)) return;
    if (text) node.textContent = text;
    node.hidden = !visible;
    if (visible) node.focus();
  };

  const show = (step, focusHeading = false) => {
    current = step;
    steps.forEach((node) => {
      const active = Number(node.dataset.step) === step;
      node.classList.toggle('pc-step-active', active);
      node.setAttribute('aria-hidden', String(!active));
    });
    if (stepNow) stepNow.textContent = String(step);
    if (progress instanceof HTMLElement) progress.style.width = `${step * 25}%`;
    setMessage(error, '', false);
    setMessage(failure, '', false);
    if (focusHeading) {
      const heading = form.querySelector('.pc-step-active h3');
      if (heading instanceof HTMLElement) heading.focus();
    }
  };

  const validateStep = (step) => {
    const node = steps.find((candidate) => Number(candidate.dataset.step) === step);
    if (!(node instanceof HTMLElement)) return false;

    if (step === 1) {
      const website = document.querySelector('#website');
      if (website instanceof HTMLInputElement && website.value.trim() && !/^[a-z]+:\/\//i.test(website.value.trim())) {
        website.value = `https://${website.value.trim()}`;
      }
    }

    const invalid = [...node.querySelectorAll('[required]')].find((control) => !control.checkValidity());
    if (invalid instanceof HTMLElement) {
      show(step, false);
      setMessage(error, 'Bitte prüfen Sie das markierte Pflichtfeld.', true);
      invalid.focus();
      if ('reportValidity' in invalid) invalid.reportValidity();
      return false;
    }
    return true;
  };

  const calculate = () => {
    const marginControl = field('margin');
    const marginUnknown = marginControl instanceof HTMLSelectElement && marginControl.value === 'unknown';
    const total = ['shop_status', 'demo_fit', 'creator_fit', 'content_depth', 'creator_history', 'margin', 'samples', 'ops']
      .reduce((sum, key) => sum + numberValue(key), 0);
    const score = Math.round((total / 120) * 100);
    const risk = marginUnknown || numberValue('margin') < 7 || numberValue('ops') < 7;

    let band = score >= 80
      ? 'SEHR HOHES POTENZIAL'
      : score >= 65
        ? 'GUTES POTENZIAL'
        : score >= 45
          ? 'POTENZIAL MIT KLAREN HEBELN'
          : 'AKTUELL SELEKTIV TESTEN';
    if (risk) band = 'VORAUSSETZUNGEN ZUERST KLÄREN';

    const scoreNode = document.querySelector('#pc-score');
    const bandNode = document.querySelector('#pc-band');
    const copyNode = document.querySelector('#pc-result-copy');
    const recommendation1 = document.querySelector('#pc-reco-1');
    const recommendation2 = document.querySelector('#pc-reco-2');
    const recommendation3 = document.querySelector('#pc-reco-3');

    if (scoreNode) scoreNode.textContent = marginUnknown ? '–' : String(score);
    if (bandNode) bandNode.textContent = band;
    if (copyNode) {
      copyNode.textContent = marginUnknown
        ? 'Ohne bekannte Marge geben wir keinen belastbaren Gesamtscore aus. Gemeinsam klären wir zunächst die wirtschaftliche Grundlage.'
        : risk
          ? 'Einzelne Voraussetzungen sind noch offen. Ein hoher Gesamtwert gleicht Risiken bei Marge oder Versand nicht aus. Vor größerem Budget müssen diese Punkte geprüft werden.'
          : 'Ihre Selbstauskunft zeigt Ansatzpunkte. Als Nächstes prüfen wir passende Produkte, Creator und die tatsächlichen Kosten. Der Score ist keine Umsatzprognose.';
    }
    if (recommendation1) {
      recommendation1.textContent = numberValue('demo_fit') + numberValue('creator_fit') >= 35
        ? 'CREATOR: Passende Personen und wenige Produktideen für einen begrenzten Test auswählen.'
        : 'CONTENT: Zuerst testen, wie sich der Produktnutzen verständlich und glaubwürdig zeigen lässt.';
    }
    if (recommendation2) recommendation2.textContent = 'WIRTSCHAFTLICHKEIT: Wareneinsatz, Provisionen, Versand, Samples, Retouren und Werbung gemeinsam rechnen.';
    if (recommendation3) {
      recommendation3.textContent = numberValue('ops') >= 7
        ? 'NÄCHSTER SCHRITT: Umfang und Erfolgskriterien eines möglichen Tests gemeinsam festlegen.'
        : 'VERSAND: Lager und zuverlässige Auftragsabwicklung klären, bevor mehr Verkäufe angestoßen werden.';
    }

    setValue('pc-score-input', marginUnknown ? '' : String(score));
    setValue('pc-band-input', band);
    setValue('pc-potential-crm', risk ? 'C – Mittel' : score >= 80 ? 'A – Sehr hoch' : score >= 65 ? 'B – Hoch' : score >= 45 ? 'C – Mittel' : 'D – Niedrig');
    setValue('pc-tiktok-crm', numberValue('shop_status') >= 8 ? 'Ja' : 'Nein');

    const category = field('category');
    setValue('pc-branche-crm', category instanceof HTMLSelectElement ? category.value : '');
    setValue('pc-source-url', window.location.href);
    setValue(
      'pc-summary-input',
      `Website Potenzial-Check V1.1 | ${marginUnknown ? 'Score offen' : `Score ${score}/100`} | ${band} | Branche: ${labelValue('category')} | Shop: ${labelValue('shop_status')} | Produkt: ${labelValue('demo_fit')} | Creator: ${labelValue('creator_fit')} | Content: ${labelValue('content_depth')} | Erfahrung: ${labelValue('creator_history')} | Bruttomarge: ${labelValue('margin')} | Samples: ${labelValue('samples')} | Versand: ${labelValue('ops')} | Ziel: ${labelValue('goal')}${risk ? ' | Manuelle Prüfung vor Skalierung erforderlich.' : ''}`,
    );

    return { score, band, marginUnknown };
  };

  form.addEventListener('click', (event) => {
    if (busy) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('[data-next]')) {
      if (validateStep(current)) show(current + 1, true);
      return;
    }
    if (target.closest('[data-back]')) {
      show(Math.max(1, current - 1), true);
      return;
    }
    if (target.closest('[data-score]') && validateStep(current)) {
      calculate();
      show(4, true);
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || current !== 4) return;

    for (let step = 1; step <= 4; step += 1) {
      if (!validateStep(step)) return;
    }

    const resultState = calculate();
    if (!productionHost) {
      setMessage(
        failure,
        'Vorschau-/Testmodus: Der echte Formularversand ist nur auf gmvgang.de freigeschaltet. Ihre Eingaben wurden nicht übertragen.',
        true,
      );
      return;
    }

    busy = true;
    setMessage(failure, '', false);

    const submit = form.querySelector('[type="submit"]');
    const originalLabel = submit?.textContent || 'Anfrage senden';
    if (submit instanceof HTMLButtonElement) {
      submit.disabled = true;
      submit.textContent = 'Wird gesendet …';
    }

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { data } }),
      });
      const result = await response.json();
      if (!response.ok || result.saved !== true) throw new Error('save_not_confirmed');

      form.hidden = true;
      setMessage(success, 'Danke – Ihre Anfrage ist angekommen. Wir leiten Sie zur Ersteinschätzung weiter.', true);
      const query = new URLSearchParams();
      if (!resultState.marginUnknown) query.set('score', String(resultState.score));
      query.set('band', resultState.band);
      window.setTimeout(() => {
        window.location.assign(`/analyse-erhalten/${query.toString() ? `?${query.toString()}` : ''}`);
      }, 500);
    } catch (errorThrown) {
      console.error('GMVGANG potential-check submit failed', errorThrown);
      setMessage(
        failure,
        'Wir konnten den Eingang noch nicht bestätigen. Ihre Eingaben bleiben erhalten. Bitte versuchen Sie es später erneut oder schreiben Sie an tiktokagentur@gmail.com.',
        true,
      );
    } finally {
      busy = false;
      if (submit instanceof HTMLButtonElement) {
        submit.disabled = false;
        submit.textContent = originalLabel;
      }
    }
  });

  show(1, false);
}
