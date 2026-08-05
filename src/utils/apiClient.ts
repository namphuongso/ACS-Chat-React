import type { ChatConfig } from '../types/config.types';
import { AcsChatError } from '../types/errors.types';

export interface BackendResponse<T = unknown> {
  statusCode: number;
  message: string;
  totalRecord: number;
  data: T;
}

/**
 * Utility function to make API requests to the backend.
 * Automatically injects headers and handles standard JSON responses.
 *
 * @param config The current chat configuration
 * @param endpoint The API endpoint (e.g. '/api/conversations')
 * @param options Standard fetch options
 * @returns Parsed JSON response from backend
 */
export async function fetchBackend<T>(
  config: ChatConfig,
  endpoint: string,
  options?: RequestInit
): Promise<BackendResponse<T>> {
  if (!config.backendUrl) {
    throw new AcsChatError('INVALID_INPUT', 'Backend URL is not configured.', {
      operation: 'fetchBackend',
    });
  }

  // Construct full URL, handling slashes
  const baseUrl = config.backendUrl.endsWith('/')
    ? config.backendUrl.slice(0, -1)
    : config.backendUrl;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${path}`;

  // Merge headers
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // Inject authorization if provided via token/headers, assuming token might be used for backend as well
  // We'll rely on backendHeaders for explicit auth like Authorization: Bearer ...
  if (config.backendHeaders) {
    Object.entries(config.backendHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AcsChatError(
        'NETWORK_ERROR',
        `Backend API error: ${response.status} ${response.statusText}`,
        { cause: errorText, operation: 'fetchBackend' }
      );
    }

    const data: BackendResponse<T> = await response.json();
    
    if (data.statusCode !== 200 && data.statusCode !== 201) {
      throw new AcsChatError(
        'NETWORK_ERROR',
        `Backend returned error code: ${data.statusCode}. Message: ${data.message}`,
        { cause: data, operation: 'fetchBackend' }
      );
    }
    
    return data;
  } catch (error) {
    if (error instanceof AcsChatError) {
      throw error;
    }
    throw new AcsChatError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Unknown network error occurred.',
      { cause: error, operation: 'fetchBackend' }
    );
  }
}
