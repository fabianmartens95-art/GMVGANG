import {
  calculateProductEconomics,
  type ProductEconomicsInput,
  type ProductEconomicsResult
} from "@gmvgang/economics";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("#app root not found");
}

app.innerHTML = `
  <main class="page-shell">
    <header class="topbar">
      <div class="brand-lockup" aria-label="GMVGANG">
        <span class="brand-mark">GMV</span><span class="brand-word">GANG</span>
      </div>
      <span class="tool-label">INTERNAL TOOL / REVENUE CORE</span>
    </header>

    <section class="hero" aria-labelledby="page-title">
      <div>
        <p class="eyebrow">PRODUCT ECONOMICS</p>
        <h1 id="page-title">ECONOMICS<br /><span>CALCULATOR.</span></h1>
        <p class="hero-copy">
          Kalkuliere Marge, Creator-Provision und Paid Media auf Basis des getesteten GMVGANG Revenue Core.
        </p>
      </div>
      <div class="hero-note">
        <span class="hero-note-kicker">STATELESS</span>
        <strong>Keine Kundendaten werden gespeichert.</strong>
        <p>Alle Berechnungen laufen lokal im Browser.</p>
      </div>
    </section>

    <section class="calculator-grid">
      <form class="panel input-panel" id="economics-form" novalidate>
        <div class="panel-heading">
          <div>
            <p class="section-number">01</p>
            <h2>INPUTS</h2>
          </div>
          <button class="text-button" id="reset-example" type="button">BEISPIELWERTE</button>
        </div>

        <div class="field-grid">
          <label class="field field-featured">
            <span>Verkaufspreis brutto</span>
            <div class="input-shell"><input id="selling-price" type="number" min="0" step="0.01" value="59.90" inputmode="decimal" /><span>€</span></div>
          </label>

          <label class="field">
            <span>MwSt.</span>
            <div class="input-shell"><input id="vat-rate" type="number" min="0" max="99.99" step="0.01" value="19" inputmode="decimal" /><span>%</span></div>
          </label>

          <label class="field">
            <span>COGS / Wareneinsatz</span>
            <div class="input-shell"><input id="cogs" type="number" min="0" step="0.01" value="14.00" inputmode="decimal" /><span>€</span></div>
          </label>

          <label class="field">
            <span>Fulfillment / Order</span>
            <div class="input-shell"><input id="fulfillment" type="number" min="0" step="0.01" value="4.50" inputmode="decimal" /><span>€</span></div>
          </label>

          <label class="field">
            <span>Payment Cost / Order</span>
            <div class="input-shell"><input id="payment-cost" type="number" min="0" step="0.01" value="1.50" inputmode="decimal" /><span>€</span></div>
          </label>

          <label class="field">
            <span>Retourenreserve / Order</span>
            <div class="input-shell"><input id="returns-reserve" type="number" min="0" step="0.01" value="2.00" inputmode="decimal" /><span>€</span></div>
          </label>

          <label class="field field-accent">
            <span>Creator-Provision</span>
            <div class="input-shell"><input id="affiliate-rate" type="number" min="0" max="99.99" step="0.01" value="15" inputmode="decimal" /><span>%</span></div>
          </label>

          <label class="field field-accent">
            <span>Paid Media / Order</span>
            <div class="input-shell"><input id="paid-media" type="number" min="0" step="0.01" value="8.00" inputmode="decimal" /><span>€</span></div>
          </label>

          <label class="field field-target">
            <span>Target Contribution Margin</span>
            <div class="input-shell"><input id="target-margin" type="number" min="0" max="99.99" step="0.01" value="20" inputmode="decimal" /><span>%</span></div>
          </label>
        </div>

        <div class="form-actions">
          <button class="primary-button" type="submit">BERECHNEN <span aria-hidden="true">→</span></button>
          <p>Werte sind Planungsinputs, keine garantierte Performance.</p>
        </div>
      </form>

      <section class="panel results-panel" aria-live="polite" aria-labelledby="results-title">
        <div class="panel-heading results-heading">
          <div>
            <p class="section-number">02</p>
            <h2 id="results-title">RESULT</h2>
          </div>
          <span class="status-badge" id="status-badge">—</span>
        </div>

        <div class="hero-kpi">
          <span>Contribution Margin nach Marketing</span>
          <strong id="contribution-margin">—</strong>
          <p id="status-detail">Eingaben prüfen und berechnen.</p>
        </div>

        <div class="kpi-grid">
          <article class="kpi-card">
            <span>Net Revenue</span>
            <strong id="net-revenue">—</strong>
          </article>
          <article class="kpi-card">
            <span>Creator Cost</span>
            <strong id="affiliate-cost">—</strong>
          </article>
          <article class="kpi-card">
            <span>Contribution vor Marketing</span>
            <strong id="contribution-before">—</strong>
          </article>
          <article class="kpi-card">
            <span>Contribution nach Marketing</span>
            <strong id="contribution-after">—</strong>
          </article>
        </div>

        <div class="guardrail-section">
          <div class="guardrail-heading">
            <span>ECONOMIC GUARDRAILS</span>
            <span class="purple-line" aria-hidden="true"></span>
          </div>
          <dl class="metric-list">
            <div><dt>Break-even ROAS</dt><dd id="break-even-roas">—</dd></div>
            <div><dt>Target ROAS</dt><dd id="target-roas">—</dd></div>
            <div><dt>Max. Marketing Cost / Order</dt><dd id="max-marketing">—</dd></div>
            <div><dt>Max. Marketing Cost bei Target-CM</dt><dd id="max-marketing-target">—</dd></div>
            <div><dt>Target Contribution / Order</dt><dd id="target-contribution">—</dd></div>
            <div><dt>Paid Media / Order</dt><dd id="paid-media-output">—</dd></div>
          </dl>
        </div>

        <div class="error-box" id="error-box" role="alert" hidden></div>
      </section>
    </section>

    <footer class="footer-note">
      <span>GMVGANG / REVENUE CORE V1</span>
      <span>CREATORS. BRANDS. SALES.</span>
    </footer>
  </main>
`;

type StatusTone = "positive" | "warning" | "negative";

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function mustQuery<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing UI element: ${selector}`);
  }
  return element;
}

function readNumber(id: string): number {
  const input = mustQuery<HTMLInputElement>(`#${id}`);
  const value = Number(input.value);

  if (!Number.isFinite(value)) {
    throw new Error(`${input.closest("label")?.querySelector("span")?.textContent ?? id}: ungültiger Wert`);
  }

  return value;
}

function formatRoas(value: number | null): string {
  return value === null ? "—" : `${numberFormatter.format(value)}×`;
}

function setText(id: string, value: string): void {
  mustQuery<HTMLElement>(`#${id}`).textContent = value;
}

function setStatus(label: string, detail: string, tone: StatusTone): void {
  const badge = mustQuery<HTMLElement>("#status-badge");
  badge.textContent = label;
  badge.dataset.tone = tone;
  setText("status-detail", detail);
}

function buildInput(): ProductEconomicsInput {
  return {
    sellingPriceGross: readNumber("selling-price"),
    vatRate: readNumber("vat-rate") / 100,
    cogs: readNumber("cogs"),
    fulfillmentCost: readNumber("fulfillment"),
    paymentCost: readNumber("payment-cost"),
    returnsReserve: readNumber("returns-reserve"),
    affiliateCommissionRate: readNumber("affiliate-rate") / 100,
    paidMediaCostPerOrder: readNumber("paid-media"),
    targetContributionMargin: readNumber("target-margin") / 100
  };
}

function renderResult(result: ProductEconomicsResult): void {
  setText("net-revenue", euroFormatter.format(result.netRevenue));
  setText("affiliate-cost", euroFormatter.format(result.affiliateCommissionCost));
  setText("contribution-before", euroFormatter.format(result.contributionBeforeMarketing));
  setText("contribution-after", euroFormatter.format(result.contributionAfterMarketing));
  setText("contribution-margin", percentFormatter.format(result.contributionMarginAfterMarketing));
  setText("break-even-roas", formatRoas(result.breakEvenRoas));
  setText("target-roas", formatRoas(result.targetRoas));
  setText("max-marketing", euroFormatter.format(result.maximumMarketingCostPerOrder));
  setText(
    "max-marketing-target",
    result.maximumMarketingCostAtTargetMargin === null
      ? "—"
      : euroFormatter.format(result.maximumMarketingCostAtTargetMargin)
  );
  setText(
    "target-contribution",
    result.targetContributionAmount === null
      ? "—"
      : euroFormatter.format(result.targetContributionAmount)
  );
  setText("paid-media-output", euroFormatter.format(result.paidMediaCostPerOrder));

  if (result.contributionAfterMarketing < 0) {
    setStatus(
      "NEGATIV",
      "Die geplanten Kosten liegen über dem verfügbaren Deckungsbeitrag pro Order.",
      "negative"
    );
    return;
  }

  if (
    result.targetContributionMargin !== null &&
    result.contributionMarginAfterMarketing >= result.targetContributionMargin
  ) {
    setStatus(
      "TARGET ERREICHT",
      "Die aktuelle Kalkulation erreicht die eingegebene Ziel-Deckungsbeitragsmarge.",
      "positive"
    );
    return;
  }

  if (result.targetContributionMargin !== null) {
    setStatus(
      "UNTER TARGET",
      "Die Kalkulation bleibt positiv, unterschreitet aber die eingegebene Zielmarge.",
      "warning"
    );
    return;
  }

  setStatus("POSITIV", "Die Kalkulation ist nach Marketing positiv.", "positive");
}

function calculate(): void {
  const errorBox = mustQuery<HTMLElement>("#error-box");

  try {
    const result = calculateProductEconomics(buildInput());
    renderResult(result);
    errorBox.hidden = true;
    errorBox.textContent = "";
  } catch (error) {
    errorBox.hidden = false;
    errorBox.textContent = error instanceof Error ? error.message : "Berechnung fehlgeschlagen.";
    setStatus("INPUT PRÜFEN", "Mindestens ein Eingabewert ist ungültig.", "negative");
  }
}

const form = mustQuery<HTMLFormElement>("#economics-form");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

form.addEventListener("input", () => {
  calculate();
});

mustQuery<HTMLButtonElement>("#reset-example").addEventListener("click", () => {
  form.reset();
  calculate();
});

calculate();
