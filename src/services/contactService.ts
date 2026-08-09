import { chatService } from './chatService';
import { fetchBackend } from '../utils/apiClient';

import { Contact } from '../types';

export const searchEmployees = async (
  keyword: string,
  pageIndex = 1,
  pageSize = 50
): Promise<Contact[]> => {
  const config = chatService.getConfig();
  if (!config) throw new Error('Chat is not initialized');
  if (!config.backendUrl) throw new Error('Backend URL is not configured');

  const { backendUrl } = config;
  const endpoint = `/api/chat/get-contacts?keyword=${encodeURIComponent(keyword)}&pageIndex=${pageIndex}&pageSize=${pageSize}`;

  const response = await fetchBackend<Contact[]>(
    {
      ...config,
      backendUrl,
    },
    endpoint
  );

  return response.data || [];
};
