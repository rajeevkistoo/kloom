'use client';

import { useState, useEffect, useCallback } from 'react';

interface Settings {
  driveFolderId: string;
  defaultQuality: '720p' | '1080p';
  defaultMicEnabled: boolean;
  defaultWebcamEnabled: boolean;
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings>({
    driveFolderId: '',
    defaultQuality: '1080p',
    defaultMicEnabled: true,
    defaultWebcamEnabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [folderInput, setFolderInput] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      if (data.settings) {
        setSettings(data.settings);
        setFolderInput(data.settings.driveFolderId || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          driveFolderId: folderInput,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        setSettings(data.settings);
        setFolderInput(data.settings.driveFolderId);
      } else {
        setMessage({
          type: 'error',
          text: data.error || 'Failed to save settings',
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Google Drive Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.01-.027-1.708-3.008-3.774-6.627L15.77 1.532c-.02-.027-1.704-.047-3.76-.047zM4.242 7.532L.5 14.106l1.867 3.268 3.754 6.573h7.517l-1.867-3.268-3.754-6.573-1.867-3.268L4.242 7.532zm5.623 6.574l-1.868 3.268 1.868 3.268 1.867 3.268h7.517l1.867-3.268-3.755-6.573h-7.517.021z"/>
          </svg>
          <span>Google Drive</span>
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Drive Folder ID or URL
            </label>
            <input
              type="text"
              value={folderInput}
              onChange={(e) => setFolderInput(e.target.value)}
              placeholder="Paste folder ID or full URL (e.g., https://drive.google.com/drive/folders/...)"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <p className="mt-2 text-sm text-gray-500">
              Create a folder in Google Drive and share it with your Cloud Run service account email.
              Then paste the folder ID or URL here.
            </p>
          </div>

          {settings.driveFolderId && (
            <div className="flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Folder configured: {settings.driveFolderId}</span>
            </div>
          )}
        </div>
      </div>

      {/* Recording Defaults Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border dark:border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Recording Defaults</h2>

        <div className="space-y-4">
          {/* Quality */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Default Video Quality
            </label>
            <select
              value={settings.defaultQuality}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  defaultQuality: e.target.value as '720p' | '1080p',
                }))
              }
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="720p">720p (HD)</option>
              <option value="1080p">1080p (Full HD)</option>
            </select>
          </div>

          {/* Microphone default */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
            <span className="flex items-center space-x-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span>Microphone enabled by default</span>
            </span>
            <input
              type="checkbox"
              checked={settings.defaultMicEnabled}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  defaultMicEnabled: e.target.checked,
                }))
              }
              className="w-5 h-5 rounded"
            />
          </label>

          {/* Webcam default */}
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer">
            <span className="flex items-center space-x-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Webcam enabled by default</span>
            </span>
            <input
              type="checkbox"
              checked={settings.defaultWebcamEnabled}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  defaultWebcamEnabled: e.target.checked,
                }))
              }
              className="w-5 h-5 rounded"
            />
          </label>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={saving}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </form>
  );
}
