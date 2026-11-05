import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each(["/", "/how-it-works", "/advocates", "/locations", "/contact", "/auth", "/appointment"])("provides the public page %s", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(path);
  });

  it.each(["/calendar", "/notifications", "/settings", "/settings/booking", "/change-password"])("keeps %s behind the existing authenticated layout", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).map((match) => match.routeId)).toContain("/_authenticated");
  });

  it.each(["/", "/auth", "/appointment", "/contact"])("keeps %s outside the dashboard layout", (path) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).map((match) => match.routeId)).not.toContain("/_authenticated");
  });
});
