import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useUserPreferences } from '@shared/features/user-preferences';

function PreferencesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('email');
  const [testingEmail, setTestingEmail] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const {
    preferences,
    emailStats,
    loading,
    saving,
    error,
    lastUpdated,
    updateEmail,
    updateProfile,
    testEmail,
    toggleEmailPreference,
    updateEmailFrequency,
    updateEmailFormat,
    refresh,
    clearError,
    isAuthenticated,
    hasEmailPreferences,
    totalEmailsSent,
  } = useUserPreferences({ includeStats: true });

  useEffect(() => {
    document.title = 'MARA - User Preferences';
  }, []);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleTestEmail = async (category) => {
    try {
      setTestingEmail(category);
      const result = await testEmail(category);
      if (result.success) {
        setSuccessMessage(`Test email sent successfully for ${category.replace('_', ' ')}`);
      }
    } catch (err) {
      console.error('Test email failed:', err);
    } finally {
      setTestingEmail(null);
    }
  };

  const handleTogglePreference = async (category, enabled) => {
    try {
      await toggleEmailPreference(category, enabled);
      setSuccessMessage(`${category.replace('_', ' ')} ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Failed to toggle preference:', err);
    }
  };

  const handleFrequencyChange = async (category, frequency) => {
    try {
      await updateEmailFrequency(category, frequency);
      setSuccessMessage(`${category.replace('_', ' ')} frequency updated`);
    } catch (err) {
      console.error('Failed to update frequency:', err);
    }
  };

  const handleFormatChange = async (category, format) => {
    try {
      await updateEmailFormat(category, format);
      setSuccessMessage(`${category.replace('_', ' ')} format updated`);
    } catch (err) {
      console.error('Failed to update format:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <Skeleton height={32} width={300} className="mb-2" />
            <Skeleton height={20} width={500} />
          </div>
          
          {/* Warning Message Skeleton */}
          <div className="mb-6">
            <Skeleton height={80} />
          </div>
          
          {/* Main Content Skeleton */}
          <div className="bg-white border border-gray-200 rounded-lg">
            {/* Tabs Skeleton */}
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex space-x-8">
                <Skeleton height={24} width={150} />
                <Skeleton height={24} width={120} />
                <Skeleton height={24} width={140} />
              </div>
            </div>
            
            {/* Tab Content Skeleton */}
            <div className="p-6">
              <div className="mb-6">
                <Skeleton height={24} width={200} className="mb-2" />
                <Skeleton height={16} width={400} />
              </div>
              
              {/* Email Categories Skeleton */}
              <div className="space-y-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-4 flex-1">
                        <Skeleton height={32} width={32} />
                        <div className="flex-1">
                          <Skeleton height={20} width={150} className="mb-2" />
                          <Skeleton height={16} width="100%" />
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <Skeleton height={16} width={80} />
                        <Skeleton height={24} width={44} />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Skeleton height={16} width={60} className="mb-2" />
                        <Skeleton height={40} />
                      </div>
                      <div>
                        <Skeleton height={16} width={50} className="mb-2" />
                        <Skeleton height={40} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading preferences</h3>
                <p className="mt-2 text-sm text-red-700">{error}</p>
                <div className="mt-4 flex space-x-4">
                  <button 
                    onClick={refresh} 
                    className="bg-red-100 text-red-800 px-4 py-2 rounded-md text-sm hover:bg-red-200"
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={() => navigate('/')} 
                    className="bg-gray-100 text-gray-800 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'email', name: 'Email Preferences', icon: '📧' },
    { id: 'profile', name: 'Profile Settings', icon: '👤' },
    { id: 'stats', name: 'Email Statistics', icon: '📊' },
  ];

  const emailCategories = [
    {
      id: 'weekly_report',
      name: 'Weekly Reports',
      description: 'Comprehensive weekly maritime security reports',
      icon: '📅',
    },
    {
      id: 'flash_report',
      name: 'Flash Reports',
      description: 'Urgent incident notifications and breaking news',
      icon: '⚡',
    },
    {
      id: 'platform_updates',
      name: 'Platform Updates',
      description: 'System updates, new features, and maintenance notices',
      icon: '🔧',
    },
    {
      id: 'marketing',
      name: 'Marketing Communications',
      description: 'Product announcements and promotional content',
      icon: '📢',
    },
  ];

  const frequencyOptions = [
    { value: 'immediate', label: 'Immediate' },
    { value: 'daily', label: 'Daily Digest' },
    { value: 'weekly', label: 'Weekly Summary' },
    { value: 'never', label: 'Never' },
  ];

  const formatOptions = [
    { value: 'html', label: 'HTML' },
    { value: 'text', label: 'Plain Text' },
    { value: 'both', label: 'Both' },
  ];

  return (
    <div className="bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">User Preferences</h1>
            <p className="text-gray-600 mt-1">
              Manage your email notifications and account settings
            </p>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Authentication Warning */}
        {!isAuthenticated && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Limited Functionality</h3>
                <p className="mt-2 text-sm text-yellow-700">
                  You're viewing preferences in legacy mode. Full preference management requires Supabase authentication.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white shadow-md rounded-lg">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'email' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4">Email Notifications</h2>
                  <p className="text-gray-600 mb-6">
                    Configure when and how you receive email notifications from MARA.
                  </p>
                </div>

                {emailCategories.map((category) => {
                  const pref = preferences?.email?.[category.id];
                  if (!pref) return null;

                  return (
                    <div key={category.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4">
                          <div className="text-2xl">{category.icon}</div>
                          <div>
                            <h3 className="font-medium text-gray-900">{category.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => handleTestEmail(category.id)}
                            disabled={testingEmail === category.id || !pref.enabled}
                            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                          >
                            {testingEmail === category.id ? 'Sending...' : 'Test Email'}
                          </button>
                          
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pref.enabled}
                              onChange={(e) => handleTogglePreference(category.id, e.target.checked)}
                              disabled={saving}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          </label>
                        </div>
                      </div>

                      {pref.enabled && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Frequency
                            </label>
                            <select
                              value={pref.frequency}
                              onChange={(e) => handleFrequencyChange(category.id, e.target.value)}
                              disabled={saving}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              {frequencyOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Format
                            </label>
                            <select
                              value={pref.format}
                              onChange={(e) => handleFormatChange(category.id, e.target.value)}
                              disabled={saving}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            >
                              {formatOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
                  <p className="text-gray-600 mb-6">
                    Manage your account information and display preferences.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={preferences?.user?.email || ''}
                      disabled
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={preferences?.user?.name || ''}
                      disabled={!isAuthenticated}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="Enter your display name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Timezone
                    </label>
                    <select
                      value={preferences?.ui?.timezone || ''}
                      disabled={!isAuthenticated}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">Eastern Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="Europe/London">London</option>
                      <option value="Europe/Paris">Paris</option>
                      <option value="Asia/Tokyo">Tokyo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date Format
                    </label>
                    <select
                      value={preferences?.ui?.date_format || 'MM/DD/YYYY'}
                      disabled={!isAuthenticated}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>

                {isAuthenticated && (
                  <div className="pt-4">
                    <button
                      disabled={saving}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4">Email Statistics</h2>
                  <p className="text-gray-600 mb-6">
                    View your email delivery history and statistics.
                  </p>
                </div>

                {isAuthenticated ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-6 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{totalEmailsSent}</div>
                      <div className="text-sm text-blue-800">Total Emails Sent</div>
                      <div className="text-xs text-blue-600 mt-1">Last 30 days</div>
                    </div>

                    <div className="bg-green-50 p-6 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {emailStats?.by_status?.delivered || 0}
                      </div>
                      <div className="text-sm text-green-800">Successfully Delivered</div>
                      <div className="text-xs text-green-600 mt-1">
                        {totalEmailsSent > 0 
                          ? `${Math.round(((emailStats?.by_status?.delivered || 0) / totalEmailsSent) * 100)}% success rate`
                          : 'No data'
                        }
                      </div>
                    </div>

                    <div className="bg-purple-50 p-6 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {Object.keys(emailStats?.by_category || {}).length}
                      </div>
                      <div className="text-sm text-purple-800">Active Categories</div>
                      <div className="text-xs text-purple-600 mt-1">Email types enabled</div>
                    </div>

                    {emailStats?.recent_emails?.length > 0 && (
                      <div className="md:col-span-3">
                        <h3 className="font-medium text-gray-900 mb-4">Recent Emails</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="space-y-3">
                            {emailStats.recent_emails.slice(0, 5).map((email, index) => (
                              <div key={index} className="flex justify-between items-center text-sm">
                                <div>
                                  <span className="font-medium">{email.category || 'Unknown'}</span>
                                  <span className="text-gray-500 ml-2">{email.subject || 'No subject'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    email.delivery_status === 'delivered' 
                                      ? 'bg-green-100 text-green-800'
                                      : email.delivery_status === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {email.delivery_status || 'pending'}
                                  </span>
                                  <span className="text-gray-500">
                                    {new Date(email.sent_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 text-6xl mb-4">📊</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Statistics Not Available</h3>
                    <p className="text-gray-600">
                      Email statistics are only available when using Supabase authentication.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {lastUpdated && (
            <p>Last updated: {lastUpdated.toLocaleString()}</p>
          )}
          <p className="mt-1">
            Changes are saved automatically. Test emails may take a few minutes to arrive.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PreferencesPage;
