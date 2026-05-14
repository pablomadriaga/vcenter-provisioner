import React from 'react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
          <p className="text-sm text-gray-500">
            © {currentYear} Pablo Madriaga Engineering. All rights reserved.
          </p>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>vCenter Provisioner</span>
            <span className="text-gray-300">|</span>
            <span>Staff Grade</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
