/**
 * Google Apps Script (HtmlService & Web App doPost) Frontend-to-Backend Bridge
 * with Automatic Preview Fallback and Real-Time Google Sheets Sync.
 */

export interface GasBridgeResponse<T> {
  ok: boolean;
  transport: 'GOOGLE_APPS_SCRIPT' | 'GOOGLE_APPS_SCRIPT_WEBHOOK' | 'LOCAL_PREVIEW_FALLBACK';
  module: string;
  action: string;
  timestamp: string;
  data: T;
  error?: string;
}

export interface GasBulkImportSyncResult {
  ok: boolean;
  transport: 'GOOGLE_APPS_SCRIPT' | 'GOOGLE_APPS_SCRIPT_WEBHOOK' | 'LOCAL_PREVIEW_FALLBACK';
  syncedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  provisionedAccountsCount: number;
  updatedSheets: string[];
  spreadsheetEndpoint: string;
  timestamp: string;
  messageKh: string;
}

declare global {
  interface Window {
    google?: {
      script?: {
        run?: {
          withSuccessHandler: <R>(callback: (result: R) => void) => {
            withFailureHandler: (errorCallback: (err: unknown) => void) => {
              apiDispatch: (request: string | {
                module: string;
                action: string;
                payload?: unknown;
              }) => void;
            };
          };
        };
      };
    };
  }
}

export function isGasEnvironmentAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.google?.script?.run?.withSuccessHandler === 'function'
  );
}

/**
 * Invokes a backend Google Apps Script module action if running inside HtmlService,
 * or via a deployed Google Apps Script Web App URL (doPost), or executes the deterministic
 * local fallback function when running in AI Studio preview.
 */
export async function invokeGasApi<T>(
  module: string,
  action: string,
  payload: unknown,
  fallbackExecutor: () => T,
  gasWebAppUrl?: string
): Promise<GasBridgeResponse<T>> {
  const timestamp = new Date().toISOString();

  // 1. Native google.script.run inside Google Apps Script HtmlService
  if (isGasEnvironmentAvailable()) {
    return new Promise<GasBridgeResponse<T>>((resolve) => {
      try {
        window.google!.script!.run!
          .withSuccessHandler((result: T) => {
            resolve({
              ok: true,
              transport: 'GOOGLE_APPS_SCRIPT',
              module,
              action,
              timestamp,
              data: result,
            });
          })
          .withFailureHandler((err: unknown) => {
            const fallbackData = fallbackExecutor();
            resolve({
              ok: true,
              transport: 'LOCAL_PREVIEW_FALLBACK',
              module,
              action,
              timestamp,
              data: fallbackData,
              error: err instanceof Error ? err.message : String(err),
            });
          })
          .apiDispatch(JSON.stringify({ module, action, payload }));
      } catch {
        const fallbackData = fallbackExecutor();
        resolve({
          ok: true,
          transport: 'LOCAL_PREVIEW_FALLBACK',
          module,
          action,
          timestamp,
          data: fallbackData,
        });
      }
    });
  }

  // 2. Deployed Google Apps Script Web App URL (doPost) via text/plain CORS-safe POST
  const cleanedEndpoint = (gasWebAppUrl || '').trim();
  const isRealGasUrl =
    cleanedEndpoint.startsWith('https://script.google.com/macros/s/') &&
    !cleanedEndpoint.includes('AKfycbx_TEOK_CHOR_HIGH_SCHOOL_2026_DEPLOY_ID');

  if (isRealGasUrl && typeof fetch === 'function') {
    try {
      const response = await fetch(cleanedEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          module,
          action,
          payload,
          timestamp,
        }),
      });

      const localData = fallbackExecutor();
      if (response.ok) {
        try {
          const remoteJson = await response.json();
          return {
            ok: true,
            transport: 'GOOGLE_APPS_SCRIPT_WEBHOOK',
            module,
            action,
            timestamp,
            data: (remoteJson?.data ?? localData) as T,
          };
        } catch {
          return {
            ok: true,
            transport: 'GOOGLE_APPS_SCRIPT_WEBHOOK',
            module,
            action,
            timestamp,
            data: localData,
          };
        }
      }
    } catch {
      // Fallback to local execution if offline or blocked by browser CORS policy
    }
  }

  const data = fallbackExecutor();
  return {
    ok: true,
    transport: 'LOCAL_PREVIEW_FALLBACK',
    module,
    action,
    timestamp,
    data,
  };
}
