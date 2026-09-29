import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

// A QA/build process must not overwrite the chunks used by the live dev server.
// Set LIVSKRAFT_QA=1 for isolated QA builds and servers (use the same flag to start).
export default function nextConfig(phase) {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  const qa = process.env.LIVSKRAFT_QA === "1";
  return {
    distDir: qa ? (development ? ".next-qa-dev" : ".next-qa") : (development ? ".next-dev" : ".next"),
  };
}
