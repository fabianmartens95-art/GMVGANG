import type { CreatorQualification } from "@gmvgang/creator-qualification";
import type { CreatorProfileResult } from "./creator-profile.js";
import {
  creatorNetworkStatusPresentation,
  type CreatorPortalNetworkStatus,
} from "./creator-status.js";

type CreatorOnboardingStepState = "complete" | "current" | "pending" | "attention";

export type CreatorOnboardingStep = {
  id: "account" | "profile" | "qualification" | "network";
  label: string;
  detail: string;
  state: CreatorOnboardingStepState;
};

export type CreatorOnboardingAction = {
  label: string;
  description: string;
  href?: string;
};

export type CreatorOnboardingModel = {
  setupCompletedSteps: number;
  setupTotalSteps: 4;
  profileCompletionPercent: number | null;
  profileCompletionLabel: string;
  networkStatusLabel: string;
  networkStatusDescription: string;
  networkStatusTone: "pending" | "ready" | "attention";
  steps: CreatorOnboardingStep[];
  nextAction: CreatorOnboardingAction;
};

const PROGRESSED_AFTER_QUALIFICATION = new Set<CreatorPortalNetworkStatus>([
  "qualified",
  "invited",
  "contracted",
  "active",
  "performing",
  "rejected",
  "paused",
]);

const NETWORK_APPROVED = new Set<CreatorPortalNetworkStatus>([
  "qualified",
  "invited",
  "contracted",
  "active",
  "performing",
]);

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function completedSteps(steps: readonly CreatorOnboardingStep[]): number {
  return steps.filter((step) => step.state === "complete").length;
}

export function buildCreatorOnboardingModel(
  profileResult: CreatorProfileResult,
  qualification: CreatorQualification | null,
): CreatorOnboardingModel {
  if (!profileResult.ok) {
    const steps: CreatorOnboardingStep[] = [
      { id: "account", label: "GMVGANG Account", detail: "Account ist aktiv.", state: "complete" },
      { id: "profile", label: "Creator-Profil", detail: "Profil konnte noch nicht vollständig geladen werden.", state: "current" },
      { id: "qualification", label: "Qualifizierung", detail: "Wird nach dem Profil freigeschaltet.", state: "pending" },
      { id: "network", label: "Netzwerkfreigabe", detail: "Erfolgt nach der Qualifizierung.", state: "pending" },
    ];

    return {
      setupCompletedSteps: completedSteps(steps),
      setupTotalSteps: 4,
      profileCompletionPercent: null,
      profileCompletionLabel: "Profilstatus konnte gerade nicht geladen werden.",
      networkStatusLabel: "Noch nicht verfügbar",
      networkStatusDescription: "Der Netzwerkstatus wird angezeigt, sobald dein Creator-Profil verfügbar ist.",
      networkStatusTone: "pending",
      steps,
      nextAction: {
        label: "Creator-Profil öffnen",
        description: "Prüfe deine Creator-Basisdaten und vervollständige dein Profil.",
        href: "/creator/profile",
      },
    };
  }

  const profile = profileResult.creatorProfile;
  const profileProgress = clampPercent(profile.profileCompletionPercent);
  const profileDone = profileProgress === 100 || profile.networkStatus !== "registered";
  const qualificationDone = qualification !== null || PROGRESSED_AFTER_QUALIFICATION.has(profile.networkStatus);
  const networkApproved = NETWORK_APPROVED.has(profile.networkStatus);
  const networkPresentation = creatorNetworkStatusPresentation(profile.networkStatus);

  let networkState: CreatorOnboardingStepState = "pending";
  if (networkApproved) {
    networkState = "complete";
  } else if (profile.networkStatus === "rejected" || profile.networkStatus === "paused") {
    networkState = "attention";
  } else if (qualificationDone) {
    networkState = "current";
  }

  const steps: CreatorOnboardingStep[] = [
    {
      id: "account",
      label: "GMVGANG Account",
      detail: "Account ist aktiv und der Creator-Rolle zugeordnet.",
      state: "complete",
    },
    {
      id: "profile",
      label: "Creator-Profil",
      detail: profileDone
        ? "Profilphase ist abgeschlossen."
        : `${profileProgress}% der Basisdaten sind vollständig.`,
      state: profileDone ? "complete" : "current",
    },
    {
      id: "qualification",
      label: "Qualifizierung",
      detail: qualificationDone
        ? "Runde 2 wurde eingereicht."
        : "Shop-, Content- und Umsetzungsdaten fehlen noch.",
      state: qualificationDone ? "complete" : profileDone ? "current" : "pending",
    },
    {
      id: "network",
      label: "Netzwerkfreigabe",
      detail: networkPresentation.description,
      state: networkState,
    },
  ];

  let nextAction: CreatorOnboardingAction;
  if (!profileDone) {
    nextAction = {
      label: "Profil vervollständigen",
      description: "Markt, Content-Sprache und Kategorien vollständig hinterlegen.",
      href: "/creator/profile",
    };
  } else if (!qualificationDone) {
    nextAction = {
      label: "Qualifizierung abschließen",
      description: "Beantworte Runde 2 zu TikTok Shop, Content und Umsetzung.",
      href: "/creator/qualification",
    };
  } else if (profile.networkStatus === "profile_complete") {
    nextAction = {
      label: "Review läuft",
      description: "Deine Qualifizierung ist eingereicht. Aktuell ist keine weitere Aktion erforderlich.",
    };
  } else if (profile.networkStatus === "rejected") {
    nextAction = {
      label: "Review abgeschlossen",
      description: "Aktuell besteht keine Netzwerkfreigabe. Der Status bleibt im Portal nachvollziehbar.",
    };
  } else if (profile.networkStatus === "paused") {
    nextAction = {
      label: "Status pausiert",
      description: "Aktuell ist keine Aktion erforderlich, bis der Netzwerkstatus wieder freigegeben wird.",
    };
  } else if (profile.networkStatus === "qualified" || profile.networkStatus === "invited") {
    nextAction = {
      label: "Matches prüfen",
      description: "Dein Creator-Profil ist freigegeben. Prüfe verfügbare Opportunities.",
      href: "/creator/matches",
    };
  } else {
    nextAction = {
      label: "Campaigns öffnen",
      description: "Verwalte deine aktiven Campaigns und die nächsten operativen Schritte.",
      href: "/creator/campaigns",
    };
  }

  return {
    setupCompletedSteps: completedSteps(steps),
    setupTotalSteps: 4,
    profileCompletionPercent: profileProgress,
    profileCompletionLabel: "Basisdaten laut deinem Creator-Profil.",
    networkStatusLabel: networkPresentation.label,
    networkStatusDescription: networkPresentation.description,
    networkStatusTone: networkPresentation.tone,
    steps,
    nextAction,
  };
}

function stepStateLabel(state: CreatorOnboardingStepState): string {
  if (state === "complete") return "ERLEDIGT";
  if (state === "current") return "JETZT";
  if (state === "attention") return "STATUS";
  return "SPÄTER";
}

export function renderCreatorOnboarding(model: CreatorOnboardingModel): string {
  const action = model.nextAction.href
    ? `<a class="button creator-onboarding-action__button" href="${model.nextAction.href}" data-nav>${model.nextAction.label}</a>`
    : `<span class="creator-onboarding-action__status">${model.nextAction.label}</span>`;

  const profileValue = model.profileCompletionPercent === null
    ? "—"
    : `${model.profileCompletionPercent}%`;

  return `
    <section class="creator-onboarding">
      <div class="creator-onboarding__hero">
        <div>
          <div class="eyebrow">CREATOR SETUP</div>
          <h2>Dein Weg ins GMVGANG Netzwerk.</h2>
          <p>Account, Profil, Qualifizierung und Netzwerkfreigabe sind getrennte Statusbereiche.</p>
        </div>
        <strong class="creator-onboarding__setup-count">
          <span>${model.setupCompletedSteps}/${model.setupTotalSteps}</span>
          <small>Schritte</small>
        </strong>
      </div>

      <progress
        class="creator-onboarding__progress"
        value="${model.setupCompletedSteps}"
        max="${model.setupTotalSteps}"
      >${model.setupCompletedSteps} von ${model.setupTotalSteps} Schritten</progress>

      <div class="creator-onboarding__truth-grid">
        <article class="creator-onboarding-truth">
          <span>PROFILVOLLSTÄNDIGKEIT</span>
          <strong>${profileValue}</strong>
          <p>${model.profileCompletionLabel}</p>
        </article>
        <article class="creator-onboarding-truth creator-onboarding-truth--${model.networkStatusTone}">
          <span>NETWORK STATUS</span>
          <strong>${model.networkStatusLabel}</strong>
          <p>${model.networkStatusDescription}</p>
        </article>
      </div>

      <div class="creator-onboarding__steps">
        ${model.steps.map((step, index) => `
          <article class="creator-onboarding-step creator-onboarding-step--${step.state}">
            <div class="creator-onboarding-step__index">${String(index + 1).padStart(2, "0")}</div>
            <div>
              <span class="creator-onboarding-step__state">${stepStateLabel(step.state)}</span>
              <h3>${step.label}</h3>
              <p>${step.detail}</p>
            </div>
          </article>
        `).join("")}
      </div>

      <aside class="creator-onboarding-action">
        <div>
          <span>NEXT BEST ACTION</span>
          <h3>${model.nextAction.label}</h3>
          <p>${model.nextAction.description}</p>
        </div>
        ${action}
      </aside>
    </section>
  `;
}
