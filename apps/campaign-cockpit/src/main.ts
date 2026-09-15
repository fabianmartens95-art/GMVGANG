import "./styles.css";
import { demoLedgers, demoNow } from "./demo";
import { buildPortfolioCockpitView } from "./model";
import { renderCockpit, type CreatorFilter } from "./render";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app not found");

const portfolio = buildPortfolioCockpitView(demoLedgers, demoNow);
let selectedCampaignId = portfolio.campaigns[0]?.id ?? "";
let creatorFilter: CreatorFilter = "all";

function render(): void {
  const campaign = portfolio.campaigns.find((item) => item.id === selectedCampaignId) ?? portfolio.campaigns[0];
  if (!campaign) {
    root.innerHTML = `<main class="empty">Noch keine Kampagnen vorhanden.</main>`;
    return;
  }

  root.innerHTML = renderCockpit(portfolio, campaign, creatorFilter);

  root.querySelectorAll<HTMLButtonElement>("[data-campaign-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCampaignId = button.dataset.campaignId ?? selectedCampaignId;
      creatorFilter = "all";
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.filter;
      if (next === "all" || next === "action" || next === "sample" || next === "content") {
        creatorFilter = next;
        render();
      }
    });
  });
}

render();
