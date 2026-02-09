import React, { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

export interface PageLayoutProps {
  children: ReactNode;
  showNav?: boolean;
  showFooter?: boolean;
  headerProps?: {
    showNav?: boolean;
    onLogout?: () => void;
    userName?: string;
    title?: string;
  };
}

export const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  showNav = true,
  showFooter = true,
  headerProps,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header showNav={showNav} {...headerProps} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
};

export default PageLayout;
