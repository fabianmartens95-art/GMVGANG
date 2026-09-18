export type CreatorPortalNetworkStatus =
  | "registered"
  | "profile_complete"
  | "qualified"
  | "invited"
  | "contracted"
  | "active"
  | "performing"
  | "rejected"
  | "paused";

export type CreatorNetworkStatusTone = "pending" | "ready" | "attention";

export type CreatorNetworkStatusPresentation = {
  label: string;
  description: string;
  tone: CreatorNetworkStatusTone;
};

export const CREATOR_NETWORK_STATUSES: readonly CreatorPortalNetworkStatus[] = [
  "registered",
  "profile_complete",
  "qualified",
  "invited",
  "contracted",
  "active",
  "performing",
  "rejected",
  "paused",
];

const PRESENTATION: Record<CreatorPortalNetworkStatus, CreatorNetworkStatusPresentation> = {
  registered: {
    label: "Profilaufbau",
    description: "Dein Creator-Profil befindet sich noch im Aufbau.",
    tone: "pending",
  },
  profile_complete: {
    label: "Freigabe ausstehend",
    description: "Die Profilphase ist abgeschlossen; die Netzwerkfreigabe ist noch nicht erteilt.",
    tone: "pending",
  },
  qualified: {
    label: "Qualifiziert",
    description: "Dein Creator-Profil ist für das GMVGANG Netzwerk qualifiziert.",
    tone: "ready",
  },
  invited: {
    label: "Opportunities freigegeben",
    description: "Du bist für passende Opportunities im Creator Network freigegeben.",
    tone: "ready",
  },
  contracted: {
    label: "Vertraglich aktiviert",
    description: "Dein Creator-Status ist vertraglich aktiviert.",
    tone: "ready",
  },
  active: {
    label: "Aktiv im Netzwerk",
    description: "Dein Creator-Account ist im GMVGANG Netzwerk aktiv.",
    tone: "ready",
  },
  performing: {
    label: "Aktiv · Performance",
    description: "Dein Creator-Account ist aktiv und befindet sich im Performance-Betrieb.",
    tone: "ready",
  },
  rejected: {
    label: "Nicht freigegeben",
    description: "Der Review ist abgeschlossen; aktuell besteht keine Netzwerkfreigabe.",
    tone: "attention",
  },
  paused: {
    label: "Pausiert",
    description: "Dein Creator-Status ist aktuell pausiert.",
    tone: "attention",
  },
};

export function creatorNetworkStatusPresentation(
  status: CreatorPortalNetworkStatus,
): CreatorNetworkStatusPresentation {
  return PRESENTATION[status];
}
