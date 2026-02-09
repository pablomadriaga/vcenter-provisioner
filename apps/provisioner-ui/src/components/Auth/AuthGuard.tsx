import React, { useEffect, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  redirectTo = '/login',
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate(redirectTo, {
        state: { from: location.pathname },
        replace: true,
      });
    }
  }, [navigate, location, redirectTo]);

  const token = localStorage.getItem('token');

  if (!token) {
    return null;
  }

  return <>{children}</>;
};

export default AuthGuard;
