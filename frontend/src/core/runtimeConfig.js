export function resolveRuntimeConfig(search = window.location.search) {
  const params = new URLSearchParams(search);
  const backendHost = params.get("backendHost") || window.location.hostname || "localhost";
  const backendPort = params.get("backendPort") || "3000";
  return {
    backendHost,
    backendPort,
    backendWsUrl: `ws://${backendHost}:${backendPort}`
  };
}
