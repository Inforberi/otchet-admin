import { useState, useEffect } from 'react';

export type UserRole = 'admin' | 'viewer' | null;

export function useUserRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then((data) => {
        setRole(data?.role || null);
      })
      .catch(() => {
        setRole(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const isAdmin = role === 'admin';
  const isViewer = role === 'viewer';

  return { role, loading, isAdmin, isViewer };
}
