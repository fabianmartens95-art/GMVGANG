import "./account-menu.css";

function closeOtherMenus(active: HTMLDetailsElement): void {
  document.querySelectorAll<HTMLDetailsElement>("details.account-menu[open]").forEach((menu) => {
    if (menu !== active) menu.open = false;
  });
}

function enhanceAccountMenu(): void {
  document.querySelectorAll<HTMLElement>(".session-controls").forEach((controls) => {
    if (controls.dataset.accountMenuEnhanced === "true") return;

    const chip = controls.querySelector<HTMLElement>(".session-chip");
    const signOut = controls.querySelector<HTMLButtonElement>("#sign-out");
    if (!chip || !signOut) return;

    const menu = document.createElement("details");
    menu.className = "account-menu";

    const trigger = document.createElement("summary");
    trigger.className = "account-menu__trigger";
    trigger.setAttribute("aria-label", "Account-Menü öffnen");

    const caret = document.createElement("span");
    caret.className = "account-menu__caret";
    caret.setAttribute("aria-hidden", "true");
    caret.textContent = "⌄";

    trigger.append(chip, caret);

    const panel = document.createElement("div");
    panel.className = "account-menu__panel";
    panel.setAttribute("role", "menu");

    const label = document.createElement("span");
    label.className = "account-menu__label";
    label.textContent = "Account";

    signOut.classList.add("account-menu__logout");
    signOut.setAttribute("role", "menuitem");

    panel.append(label, signOut);
    menu.append(trigger, panel);
    controls.append(menu);
    controls.dataset.accountMenuEnhanced = "true";

    menu.addEventListener("toggle", () => {
      if (menu.open) closeOtherMenus(menu);
    });
  });
}

enhanceAccountMenu();

const observer = new MutationObserver(() => enhanceAccountMenu());
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Node)) return;

  document.querySelectorAll<HTMLDetailsElement>("details.account-menu[open]").forEach((menu) => {
    if (!menu.contains(target)) menu.open = false;
  });
});
