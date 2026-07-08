import { DEMO_FALLBACK } from "@/constants/config";
import { useDemoStore } from "@/store/demo";
import { isNetworkError } from "./client";

/**
 * Runs a live API call; if the backend is unreachable (network error) and demo
 * fallback is enabled, returns bundled sample data and flips the demo flag so
 * the UI can show an honest "Demo data" banner. HTTP errors (4xx/5xx) are NOT
 * masked — those still throw so real backend problems stay visible.
 */
export async function withDemoFallback<T>(
  live: () => Promise<T>,
  demo: T,
): Promise<T> {
  try {
    const result = await live();
    return result;
  } catch (err) {
    if (DEMO_FALLBACK && isNetworkError(err)) {
      useDemoStore.getState().activate();
      return demo;
    }
    throw err;
  }
}
