'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createSession, addFiles } from '@/actions';

export default function HostPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [pin, setPin] = useState('');
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hostId, setHostId] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const processFiles = useCallback((fileList) => {
    const fileArray = Array.from(fileList);
    const mapped = fileArray.map((f) => ({
      file: f,
      relativePath: f.webkitRelativePath || f.name,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setFiles((prev) => [...prev, ...mapped]);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type, name) => {
    if (type?.startsWith('image/')) return '🖼️';
    if (type?.startsWith('video/')) return '🎬';
    if (type?.startsWith('audio/')) return '🎵';
    if (type?.startsWith('text/') || name?.endsWith('.pdf')) return '📄';
    if (name?.endsWith('.zip') || name?.endsWith('.rar')) return '📦';
    return '📁';
  };

  const storeHost = (sid, hostTok, authTok) => {
    try {
      const raw = localStorage.getItem('gc_host');
      const hosts = raw ? JSON.parse(raw) : {};
      hosts[sid] = hostTok;
      localStorage.setItem('gc_host', JSON.stringify(hosts));

      const rawAuth = localStorage.getItem('gc_auth');
      const sessions = rawAuth ? JSON.parse(rawAuth) : {};
      sessions[sid] = authTok;
      localStorage.setItem('gc_auth', JSON.stringify(sessions));
    } catch {}
  };

  const handleUpload = async () => {
    if (!pin || files.length === 0) {
      setError('Please enter a PIN and select files');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      const { hostId: newHostId, hostToken, accessToken } = await createSession(pin);
      setHostId(newHostId);
      storeHost(newHostId, hostToken, accessToken);

      const fileMetadata = [];
      let completed = 0;

      for (const { file, relativePath } of files) {
        const storagePath = `uploads/${newHostId}/${relativePath}`;
        const formData = new FormData();
        formData.append('hostId', newHostId);
        formData.append('file', file);
        formData.append('storagePath', storagePath);

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const result = await res.json();

        if (!res.ok) throw new Error(result.error || `Failed to upload "${relativePath}"`);

        fileMetadata.push({
          name: result.name,
          fullPath: relativePath,
          storagePath,
          size: result.size,
          mimeType: result.mimeType,
          downloadURL: result.downloadURL,
        });

        completed++;
        setProgress(Math.round((completed / files.length) * 100));
      }

      await addFiles(newHostId, fileMetadata);
      setProgress(100);
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setHostId(null);
    } finally {
      setUploading(false);
    }
  };

  const copyHostId = () => {
    navigator.clipboard.writeText(hostId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (hostId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        </div>

        <div className="glass rounded-2xl p-8 md:p-12 w-full max-w-lg animate-fade-in relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h2 className="text-2xl font-bold mb-2">Room Created!</h2>
          <p className="text-gray-400 mb-6">
            Share this Host ID with others along with your PIN
          </p>

          <div className="glass-light rounded-xl p-6 mb-6">
            <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
              Your Host ID
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-black/30 rounded-lg px-4 py-3 font-mono text-xl tracking-wider text-indigo-400 font-bold">
                {hostId}
              </div>
              <button
                onClick={copyHostId}
                className="btn-secondary !p-3 !px-4"
                title="Copy Host ID"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push(`/dashboard/${hostId}`)}
              className="btn-primary w-full"
            >
              Go to Dashboard
            </button>
            <button onClick={() => router.push('/')} className="btn-secondary w-full">
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/')}
            className="glass-light rounded-xl p-2.5 hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold">Create a Room</h1>
            <p className="text-gray-400 text-sm">Upload files and generate a secure share link</p>
          </div>
        </div>

        <div className="glass rounded-2xl p-6 md:p-8 space-y-6">
          <div
            className={`dropzone p-8 md:p-12 text-center ${dragging ? 'active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-medium">
                  {files.length > 0 ? `${files.length} file(s) selected` : 'Drop files or folders here'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Drag & drop anywhere on this area
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary !py-2 !px-4 text-sm">
                  Browse Files
                </button>
                <button type="button" onClick={() => folderInputRef.current?.click()} className="btn-secondary !py-2 !px-4 text-sm">
                  Browse Folders
                </button>
              </div>
            </div>
          </div>

          {files.length > 0 && (
            <div className="glass-light rounded-xl max-h-48 overflow-y-auto scrollbar-thin">
              {files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0">{getFileIcon(f.type, f.name)}</span>
                    <div className="min-w-0">
                      <p className="text-sm truncate">{f.relativePath}</p>
                      <p className="text-xs text-gray-500">{formatSize(f.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Set a PIN for secure access
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter a PIN to protect your room"
              className="glass-input w-full px-4 py-3 rounded-xl text-sm"
              minLength={4}
              maxLength={20}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Uploading...</span>
                <span className="text-indigo-400">{progress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0 || !pin}
            className="btn-primary w-full"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading {progress}%
              </span>
            ) : (
              'Create Room & Upload'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
