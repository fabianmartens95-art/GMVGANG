import { createPlatformApiHandler as createAnalyticsPlatformApiHandler } from "./analytics-http.js";
import { handleTeamCreatorFunnel } from "./team-creator-funnel-http.js";
import type { PlatformApiDependencies } from "./types.js";

const TEAM_CREATOR_FUNNEL_ENDPOINT = "/api/team/creator-funnel";

export function createPlatformApiHandler(
  dependencies: PlatformApiDependencies,
): (request: Request) => Promise<Response> {
  const baseHandler = createAnalyticsPlatformApiHandler(dependencies);

  return async (request: Request): Promise<Response> => {
    if (new URL(request.url).pathname === TEAM_CREATOR_FUNNEL_ENDPOINT) {
      try {
        return await handleTeamCreatorFunnel(request, dependencies);
      } catch (error) {
        const code = error instanceof Error ? error.message.split(":", 1)[0] : "TEAM_CREATOR_FUNNEL_FAILED";
        console.error("GMVGANG_TEAM_CREATOR_FUNNEL_FAILED", { code });
        return new Response(JSON.stringify({ error: "internal_error" }), {
          status: 500,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
          },
        });
      }
    }

    return baseHandler(request);
  };
}
