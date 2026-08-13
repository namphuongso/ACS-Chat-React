import { chatService } from './chatService';
import { fetchBackend } from '../utils/apiClient';

export const uploadFile = async (file: File): Promise<string> => {
  const config = chatService.getConfig();
  if (!config) throw new Error('Chat is not initialized');
  if (!config.backendUrl) throw new Error('Backend URL is not configured');

  const { backendUrl } = config;
  const endpoint = `/api/files/uploads`;

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetchBackend<string[]>(
    {
      ...config,
      backendUrl,
    },
    endpoint,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (response.data && response.data.length > 0) {
    return response.data[0];
  }

  throw new Error('Upload failed: No data returned from server');
};

export const uploadFiles = async (files: File[]): Promise<string> => {
  const config = chatService.getConfig();
  if (!config) throw new Error('Chat is not initialized');
  if (!config.backendUrl) throw new Error('Backend URL is not configured');

  const { backendUrl } = config;
  const endpoint = `/api/files/uploads`;

  const formData = new FormData();

  files.forEach((file) => {
    formData.append('file', file);
  });

  const response = await fetchBackend<string[]>(
    {
      ...config,
      backendUrl,
    },
    endpoint,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (response.data && response.data.length > 0) {
    return response.data[0];
  }

  throw new Error('Upload failed: No data returned from server');
};
