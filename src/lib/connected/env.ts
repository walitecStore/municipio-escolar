import "server-only";
import { parseIntegrationConfig } from "./policy";
export function integrationConfig() {
  return parseIntegrationConfig(process.env);
}
