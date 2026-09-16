const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('#main-nav');

if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    nav.dataset.open = String(!isOpen);
  });

  nav.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      menuButton.setAttribute('aria-expanded', 'false');
      nav.dataset.open = 'false';
    }
  });
}

const score = document.querySelector('#result-score');
const band = document.querySelector('#result-band');
if (score && band) {
  const params = new URLSearchParams(window.location.search);
  const scoreValue = params.get('score');
  const bandValue = params.get('band');

  if (scoreValue && /^\d{1,3}$/.test(scoreValue)) {
    const parsed = Number(scoreValue);
    if (parsed >= 0 && parsed <= 100) score.textContent = String(parsed);
  }
  if (bandValue && bandValue.length <= 80) band.textContent = bandValue;
}
