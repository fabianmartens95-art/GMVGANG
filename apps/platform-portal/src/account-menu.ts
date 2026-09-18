import "./account-menu.css";
import "./workspace-switcher.css";

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
    const workspaceSwitcher = controls.querySelector<HTMLElement>(".workspace-switcher");
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

    const password = document.createElement("a");
    password.className = "account-menu__item";
    password.href = "/account/password";
    password.setAttribute("role", "menuitem");
    password.textContent = "Passwort";

    const logout = document.createElement("button");
    logout.className = "account-menu__logout";
    logout.type = "button";
    logout.setAttribute("role", "menuitem");
    logout.textContent = "Abmelden";
    logout.addEventListener("click", () => {
      menu.open = false;
      signOut.click();
    });

    signOut.hidden = true;
    signOut.setAttribute("aria-hidden", "true");
    signOut.tabIndex = -1;

    panel.append(label);
    if (workspaceSwitcher) panel.append(workspaceSwitcher);
    panel.append(password, logout);
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
