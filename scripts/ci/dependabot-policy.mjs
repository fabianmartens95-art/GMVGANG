const DEPENDABOT_LOGIN = "dependabot[bot]";
const NPM_BRANCH_PREFIX = "dependabot/npm_and_yarn/";
const ACTIONS_BRANCH_PREFIX = "dependabot/github_actions/";

function classifyUpdate(text) {
  const pairs = [...String(text ?? "").matchAll(
    /\bfrom\s+v?(\d+)(?:\.\d+){0,2}(?:[-+][^\s<]+)?\s+to\s+v?(\d+)(?:\.\d+){0,2}(?:[-+][^\s<]+)?/gi,
  )];

  if (!pairs.length) return "unknown";

  for (const match of pairs) {
    const fromMajor = Number(match[1]);
    const toMajor = Number(match[2]);
    if (!Number.isInteger(fromMajor) || !Number.isInteger(toMajor) || toMajor < fromMajor) {
      return "unknown";
    }
    if (toMajor > fromMajor) return "major";
  }

  return "minor-or-patch";
}

function npmFileAllowed(file) {
  return file === "package.json"
    || file === "pnpm-lock.yaml"
    || file.endsWith("/package.json");
}

function actionsFileAllowed(file) {
  return /^\.github\/workflows\/.+\.ya?ml$/i.test(file);
}

export function evaluateDependabotPolicy(pullRequest, changedFiles = []) {
  const login = pullRequest?.user?.login ?? "";
  const branch = pullRequest?.head?.ref ?? "";
  const isDependabot = login === DEPENDABOT_LOGIN && branch.startsWith("dependabot/");

  if (!isDependabot) {
    return {
      isDependabot: false,
      supportedEcosystem: false,
      ecosystem: null,
      lane: null,
      safeFiles: false,
      updateClass: "unknown",
      autoContractEligible: false,
      unsafeFiles: [],
      reason: "not-dependabot",
    };
  }

  let ecosystem = null;
  let fileAllowed = () => false;

  if (branch.startsWith(NPM_BRANCH_PREFIX)) {
    ecosystem = "npm";
    fileAllowed = npmFileAllowed;
  } else if (branch.startsWith(ACTIONS_BRANCH_PREFIX)) {
    ecosystem = "github-actions";
    fileAllowed = actionsFileAllowed;
  }

  const supportedEcosystem = Boolean(ecosystem);
  const unsafeFiles = supportedEcosystem
    ? changedFiles.filter((file) => !fileAllowed(file))
    : [...changedFiles];
  const safeFiles = supportedEcosystem && changedFiles.length > 0 && unsafeFiles.length === 0;
  const updateClass = classifyUpdate(`${pullRequest?.title ?? ""}\n${pullRequest?.body ?? ""}`);
  const autoContractEligible = safeFiles && updateClass === "minor-or-patch";

  let reason = "eligible";
  if (!supportedEcosystem) reason = "unsupported-ecosystem";
  else if (!safeFiles) reason = changedFiles.length ? "unexpected-files" : "no-changed-files";
  else if (updateClass === "major") reason = "major-update-requires-explicit-contract";
  else if (updateClass === "unknown") reason = "update-classification-unknown";

  return {
    isDependabot: true,
    supportedEcosystem,
    ecosystem,
    lane: "devops",
    safeFiles,
    updateClass,
    autoContractEligible,
    unsafeFiles,
    reason,
  };
}
