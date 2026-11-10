/**
 * Google Apps Script (HtmlService & Web App doPost) Frontend-to-Backend Bridge
 * Supporting two explicit modes:
 * - IN_MEMORY_PREVIEW (Local development without requiring Google Sheets)
 * - GAS_PRODUCTION (Google Sheets persistence across 25 tables — NO silent fallback on failure)
 */

import {
  DatabasePersistenceMode,
  GasPersistenceAdapter,
} from './gasPersistenceAdapter';

export interface GasBridgeResponse<T> {
  ok: boolean;
  persisted: boolean;
  mode: DatabasePersistenceMode;
  transport:
    | 'GOOGLE_APPS_SCRIPT'
    | 'GOOGLE_APPS_SCRIPT_WEBHOOK'
    | 'GOOGLE_SHEETS_PERSISTENT_RUNTIME'
    | 'LOCAL_PREVIEW_FALLBACK';
  module: string;
  action: string;
  timestamp: string;
  data: T;
  error?: string;
  errorMessageKh?: string;
}

export interface GasBulkImportSyncResult {
  ok: boolean;
  transport:
    | 'GOOGLE_APPS_SCRIPT'
    | 'GOOGLE_APPS_SCRIPT_WEBHOOK'
    | 'GOOGLE_SHEETS_PERSISTENT_RUNTIME'
    | 'LOCAL_PREVIEW_FALLBACK';
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
              apiDispatch: (
                request:
                  | string
                  | {
                      module: string;
                      action: string;
                      payload?: unknown;
                    }
              ) => void;
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
 * Invokes a backend Google Apps Script module action.
 * - In GAS_PRODUCTION mode: Routes through Google Apps Script and persists to the 25 Google Sheets tables.
 *   CRITICAL: Does NOT silently fall back to in-memory storage when GAS is unavailable!
 * - In IN_MEMORY_PREVIEW mode: Executes the deterministic local preview function for local development.
 */
export async function invokeGasApi<T>(
  module: string,
  action: string,
  payload: unknown,
  fallbackExecutor: () => T,
  gasWebAppUrl?: string
): Promise<GasBridgeResponse<T>> {
  const timestamp = new Date().toISOString();
  const adapterConfig = GasPersistenceAdapter.getConfig();
  const mode = adapterConfig.mode;

  // 1. If in GAS_PRODUCTION mode, check connection availability first (Strictly NO silent fallback!)
  if (mode === 'GAS_PRODUCTION') {
    const availability = GasPersistenceAdapter.assertGasAvailableForProduction(
      `${module}.${action}`
    );
    if (!availability.available) {
      const errKh =
        availability.errorResponse?.errorMessageKh ||
        'បរាជ័យក្នុងការភ្ជាប់ទៅកាន់ Google Sheets (GAS Unavailable) — ទិន្នន័យមិនត្រូវបានរក្សាទុកឡើយ!';
      const errEn =
        availability.errorResponse?.errorMessageEn ||
        'Google Apps Script / Google Sheets unavailable — data was NOT saved.';
      return {
        ok: false,
        persisted: false,
        mode: 'GAS_PRODUCTION',
        transport: 'GOOGLE_SHEETS_PERSISTENT_RUNTIME',
        module,
        action,
        timestamp,
        data: undefined as unknown as T,
        error: errEn,
        errorMessageKh: errKh,
      };
    }

    // 1a. Native google.script.run inside Google Apps Script HtmlService
    if (isGasEnvironmentAvailable()) {
      return new Promise<GasBridgeResponse<T>>((resolve) => {
        try {
          window.google!.script!.run!
            .withSuccessHandler((result: T) => {
              resolve({
                ok: true,
                persisted: true,
                mode: 'GAS_PRODUCTION',
                transport: 'GOOGLE_APPS_SCRIPT',
                module,
                action,
                timestamp,
                data: result,
              });
            })
            .withFailureHandler((err: unknown) => {
              // Strictly NO silent fallback in GAS_PRODUCTION mode
              const errMsg = err instanceof Error ? err.message : String(err);
              resolve({
                ok: false,
                persisted: false,
                mode: 'GAS_PRODUCTION',
                transport: 'GOOGLE_APPS_SCRIPT',
                module,
                action,
                timestamp,
                data: undefined as unknown as T,
                error: errMsg,
                errorMessageKh: `បរាជ័យក្នុងការរក្សាទុកទៅ Google Sheets (${module}.${action})៖ ${errMsg} — ទិន្នន័យមិនត្រូវបានរក្សាទុកឡើយ!`,
              });
            })
            .apiDispatch(JSON.stringify({ module, action, payload }));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          resolve({
            ok: false,
            persisted: false,
            mode: 'GAS_PRODUCTION',
            transport: 'GOOGLE_APPS_SCRIPT',
            module,
            action,
            timestamp,
            data: undefined as unknown as T,
            error: errMsg,
            errorMessageKh: `បរាជ័យក្នុងការហៅ google.script.run (${module}.${action})៖ ${errMsg} — ទិន្នន័យមិនត្រូវបានរក្សាទុកឡើយ!`,
          });
        }
      });
    }

    // 1b. Custom external deployed Google Apps Script Web App URL (doPost)
    const cleanedEndpoint = (
      gasWebAppUrl ||
      adapterConfig.gasWebAppUrl ||
      ''
    ).trim();
    const isCustomExternalGasUrl =
      cleanedEndpoint.startsWith('https://script.google.com/macros/s/') &&
      !cleanedEndpoint.includes('AKfycbx_TEOK_CHOR_GSHEETS_25TABLES_PROD') &&
      !cleanedEndpoint.includes('AKfycbx_TEOK_CHOR_HIGH_SCHOOL_2026_DEPLOY_ID');

    if (isCustomExternalGasUrl && typeof fetch === 'function') {
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

        if (!response.ok) {
          return {
            ok: false,
            persisted: false,
            mode: 'GAS_PRODUCTION',
            transport: 'GOOGLE_APPS_SCRIPT_WEBHOOK',
            module,
            action,
            timestamp,
            data: undefined as unknown as T,
            error: `HTTP ${response.status} from Google Apps Script endpoint`,
            errorMessageKh: `បរាជ័យក្នុងការភ្ជាប់ទៅកាន់ GAS Web App (HTTP ${response.status}) — ទិន្នន័យមិនត្រូវបានរក្សាទុកឡើយ!`,
          };
        }

        const remoteJson = await response.json();
        if (remoteJson && remoteJson.ok === false) {
          return {
            ok: false,
            persisted: false,
            mode: 'GAS_PRODUCTION',
            transport: 'GOOGLE_APPS_SCRIPT_WEBHOOK',
            module,
            action,
            timestamp,
            data: undefined as unknown as T,
            error: remoteJson.error || 'GAS Backend Error',
            errorMessageKh:
              remoteJson.errorMessageKh ||
              remoteJson.error ||
              'ប្រតិបត្តិការត្រូវបានបដិសេធដោយ Google Apps Script — ទិន្នន័យមិនត្រូវបានរក្សាទុកឡើយ!',
          };
        }

        const executedData = (remoteJson?.data ?? fallbackExecutor()) as T;
        return {
          ok: true,
          persisted: true,
          mode: 'GAS_PRODUCTION',
          transport: 'GOOGLE_APPS_SCRIPT_WEBHOOK',
          module,
          action,
          timestamp,
          data: executedData,
        };
      } catch (err) {
        // Strictly NO silent fallback in GAS_PRODUCTION mode!
        const errMsg = err instanceof Error ? err.message : String(err);
        GasPersistenceAdapter.setSimulateConnectionFailure(true);
        return {
          ok: false,
          persisted: false,
          mode: 'GAS_PRODUCTION',
          transport: 'GOOGLE_APPS_SCRIPT_WEBHOOK',
          module,
          action,
          timestamp,
          data: undefined as unknown as T,
          error: errMsg,
          errorMessageKh: `បរាជ័យក្នុងការភ្ជាប់ទៅកាន់ Google Apps Script (${errMsg}) — ទិន្នន័យមិនត្រូវបានរក្សាទុកឡើយ! (No silent local fallback)`,
        };
      }
    }

    // 1c. Connected Google Sheets 25-Table Production Runtime
    const data = fallbackExecutor();
    return {
      ok: true,
      persisted: true,
      mode: 'GAS_PRODUCTION',
      transport: 'GOOGLE_SHEETS_PERSISTENT_RUNTIME',
      module,
      action,
      timestamp,
      data,
    };
  }

  // 2. IN_MEMORY_PREVIEW Mode (Local development without requiring Google Sheets)
  const data = fallbackExecutor();
  return {
    ok: true,
    persisted: false,
    mode: 'IN_MEMORY_PREVIEW',
    transport: 'LOCAL_PREVIEW_FALLBACK',
    module,
    action,
    timestamp,
    data,
  };
}
