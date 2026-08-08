import { useState, useCallback } from 'react';
import { searchEmployees } from '../services/contactService';
import { Contact } from '../types';

export const useContactSearch = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const search = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setContacts([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await searchEmployees(keyword);
      setContacts(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    contacts,
    loading,
    error,
    search,
  };
};
