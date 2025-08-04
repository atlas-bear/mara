import React from 'react';
import { useLocation } from 'react-router-dom';

const TopBar = ({ onMenuToggle }) => {
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    
    if (path.startsWith('/weekly-report')) return 'Weekly Reports';
    if (path.startsWith('/flash')) return 'Flash Reports';
    if (path.startsWith('/incident')) return 'Incident Details';
    if (path.startsWith('/preferences')) return 'Preferences';
    if (path.startsWith('/system/health')) return 'System Health';
    if (path.startsWith('/incidents')) return 'Incident Search';
    if (path === '/') return 'Dashboard';
    
    return 'MARA';
  };

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    if (path === '/') return [];
    
    const breadcrumbs = [];
    
    if (path.startsWith('/weekly-report')) {
      breadcrumbs.push({ label: 'Reports', path: '/weekly-report' });
      if (segments.length > 1) {
        breadcrumbs.push({ label: `Week ${segments[1]}`, path: path });
      }
    } else if (path.startsWith('/incident/')) {
      breadcrumbs.push({ label: 'Incidents', path: '/incidents' });
      if (segments[1]) {
        breadcrumbs.push({ label: `Incident ${segments[1]}`, path: path });
      }
    } else if (path.startsWith('/system/')) {
      breadcrumbs.push({ label: 'System', path: '/system' });
      if (segments[1] === 'health') {
        breadcrumbs.push({ label: 'Health', path: path });
      }
    }
    
    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - Menu button and breadcrumbs */}
        <div className="flex items-center space-x-4">
          {/* Menu toggle button - visible on all screen sizes */}
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-2 text-sm">
            {breadcrumbs.length > 0 ? (
              <>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.path}>
                    {index > 0 && (
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    <span className={index === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'}>
                      {crumb.label}
                    </span>
                  </React.Fragment>
                ))}
              </>
            ) : (
              <h1 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h1>
            )}
          </nav>
        </div>

        {/* Right side - Actions and user menu */}
        <div className="flex items-center space-x-3">
          {/* Search button */}
          <button className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Notifications */}
          <button className="p-2 rounded-md hover:bg-gray-100 transition-colors relative">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM10.97 4.97a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 01-1.06-1.06L13.44 8.5H3a.75.75 0 010-1.5h10.44L10.97 4.97z" />
            </svg>
            {/* Notification dot */}
            <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
          </button>

          {/* Help */}
          <button className="p-2 rounded-md hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* System status indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-green-700">All Systems Operational</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
