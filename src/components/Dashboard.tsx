'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Recording {
  id: string;
  title: string;
  driveFileId: string;
  duration: number;
  status: 'processing' | 'uploading' | 'ready' | 'error';
  createdAt: string;
  viewCount: number;
  fileSize: number;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRecordings = useCallback(async () => {
    try {
      const response = await fetch('/api/recordings');
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setRecordings(data.recordings || []);
      }
    } catch (err) {
      setError('Failed to load recordings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  const handleCopyLink = async (id: string) => {
    const url = `${window.location.origin}/v/${id}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRename = async (id: string) => {
    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });

      if (response.ok) {
        setRecordings((prev) =>
          prev.map((r) => (r.id === id ? { ...r, title: editTitle } : r))
        );
        setEditingId(null);
      }
    } catch (err) {
      console.error('Error renaming:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) {
      return;
    }

    try {
      const response = await fetch(`/api/recordings/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRecordings((prev) => prev.filter((r) => r.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredRecordings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecordings.map((r) => r.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    if (!confirm(`Are you sure you want to delete ${count} recording${count !== 1 ? 's' : ''}?`)) {
      return;
    }

    setIsDeleting(true);

    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/recordings/${id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      setRecordings((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error deleting recordings:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredRecordings = recordings.filter((r) =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (recording: Recording) => {
    // If processing/uploading for more than 10 minutes, show as failed
    const createdAt = new Date(recording.createdAt).getTime();
    const now = Date.now();
    const isStuck = (recording.status === 'processing' || recording.status === 'uploading') &&
                    (now - createdAt > 10 * 60 * 1000);

    if (isStuck) {
      return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">Failed</span>;
    }

    switch (recording.status) {
      case 'ready':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full">Ready</span>;
      case 'uploading':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full">Uploading</span>;
      case 'processing':
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">Processing</span>;
      case 'error':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">Error</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchRecordings}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar and bulk actions */}
      <div className="flex items-center space-x-4">
        {/* Select All checkbox */}
        {filteredRecordings.length > 0 && (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredRecordings.length && filteredRecordings.length > 0}
              onChange={handleSelectAll}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">Select All</span>
          </label>
        )}

        {/* Delete Selected button */}
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>{isDeleting ? 'Deleting...' : `Delete (${selectedIds.size})`}</span>
          </button>
        )}

        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search recordings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filteredRecordings.length} recording{filteredRecordings.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Recording list */}
      {filteredRecordings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
            No recordings yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating a new recording.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredRecordings.map((recording) => (
            <div
              key={recording.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 hover:shadow-md transition-shadow"
            >
              {/* Left side - checkbox, thumbnail and info */}
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(recording.id)}
                  onChange={() => handleSelectOne(recording.id)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />

                {/* Thumbnail placeholder */}
                <Link
                  href={`/v/${recording.id}`}
                  className="flex-shrink-0 w-24 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editingId === recording.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(recording.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => handleRename(recording.id)}
                        className="px-2 py-1 bg-blue-600 text-white text-sm rounded"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 bg-gray-300 dark:bg-gray-600 text-sm rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <Link
                      href={`/v/${recording.id}`}
                      className="font-medium text-gray-900 dark:text-white truncate block hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {recording.title}
                    </Link>
                  )}
                  <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                    <span>{formatDate(recording.createdAt)}</span>
                    <span>{formatDuration(recording.duration)}</span>
                    <span>{formatFileSize(recording.fileSize)}</span>
                    <span>{recording.viewCount} view{recording.viewCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {/* Right side - status and actions */}
              <div className="flex items-center space-x-4 ml-4">
                {getStatusBadge(recording)}

                {/* Copy link button */}
                <button
                  onClick={() => handleCopyLink(recording.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    copiedId === recording.id
                      ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  title="Copy link"
                >
                  {copiedId === recording.id ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  )}
                </button>

                {/* Rename button */}
                <button
                  onClick={() => {
                    setEditingId(recording.id);
                    setEditTitle(recording.title);
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Rename"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(recording.id)}
                  className="p-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
