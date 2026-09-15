import "./styles.css";
import "./runtime.css";
import { demoLedgers, demoNow } from "./demo";
import { buildPortfolioCockpitView } from "./model";
import { renderCockpit, type CreatorFilter } from "./render";
import { loadRuntimeSnapshot, type CockpitRuntimeSnapshot } from "./runtime";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("#app not found");
const mount: HTMLDivElement = root;

let runtime: CockpitRuntimeSnapshot | null = null;
let selectedCampaignId = "";
let creatorFilter: CreatorFilter = "all";

function selectedLedgers() {
  if (runtime?.campaignSource === "company-os" && runtime.ledgers.length > 0) return runtime.ledgers;
  return demoLedgers;
}

function render(): void {
  const ledgers = selectedLedgers();
  const now = runtime?.generatedAt ?? demoNow;
  const portfolio = buildPortfolioCockpitView(ledgers, now);
  if (!selectedCampaignId) selectedCampaignId = portfolio.campaigns[0]?.id ?? "";
  const campaign = portfolio.campaigns.find((item) => item.id === selectedCampaignId) ?? portfolio.campaigns[0];

  if (!campaign) {
    mount.innerHTML = `<main class="empty">Noch keine Kampagnen vorhanden.</main>`;
    return;
  }

  mount.innerHTML = renderCockpit(portfolio, campaign, creatorFilter, runtime);

  mount.querySelectorAll<HTMLButtonElement>("[data-campaign-id]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCampaignId = button.dataset.campaignId ?? selectedCampaignId;
      creatorFilter = "all";
      render();
    });
  });

  mount.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.filter;
      if (next === "all" || next === "action" || next === "sample" || next === "content") {
        creatorFilter = next;
        render();
      }
    });
  });
}

async function bootstrap(): Promise<void> {
  mount.innerHTML = `<main class="empty">Campaign Cockpit wird geladen…</main>`;
  runtime = await loadRuntimeSnapshot();
  render();
}

void bootstrap();
