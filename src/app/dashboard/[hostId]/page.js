'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

import {
  getFiles,
  getFileDownloadUrl,
  getRawFiles,
  verifySessionToken,
  addFiles,
  changePin,
  kickUsers,
  getSessionInfo,
} from '@/actions';
import JSZip from 'jszip';

export default function DashboardPage() {
  const { hostId } = useParams();
  const router = useRouter();
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
 
  const [fileTree, setFileTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [downloading, setDownloading] = useState(false);

  const [isHost, setIsHost] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [sessionInfo, setSessionInfo] = useState(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const [showHostControls, setShowHostControls] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const [kicking, setKicking] = useState(false);

  useEffect(() => {
    initDashboard();
  }, [hostId]);

  useEffect(() => {
    if (!authChecking && !error && isHost) {
      const interval = setInterval(loadSessionInfo, 10000);
      return () => clearInterval(interval);
    }
  }, [authChecking, error, isHost]);

  const initDashboard = async () => {
    try {
      const raw = localStorage.getItem('gc_auth');
      let token = null;
      if (raw) {
        const sessions = JSON.parse(raw);
        token = sessions[hostId] || null;
      }

      if (!token) {
        setAuthChecking(false);
        setError('Session expired. Please log in again.');
        return;
      }

      const result = await verifySessionToken(hostId, token);
      if (!result.valid) {
        setAuthChecking(false);
        setError('Session expired. Please log in again.');
        return;
      }

      setIsHost(result.isHost);
      setAuthChecking(false);
      loadFiles();
      loadSessionInfo();
    } catch (err) {
      setAuthChecking(false);
      setError('Failed to authenticate. Please log in again.');
    }
  };

  const loadFiles = async () => {
    try {
      const data = await getFiles(hostId);
      setFileTree(data.files || []);
    } catch (err) {
      if (err.message?.includes('NEXT_REDIRECT')) return;
    }
  };

  const loadSessionInfo = async () => {
    try {
      const info = await getSessionInfo(hostId);
      setSessionInfo(info);
    } catch {}
  };

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getIcon = (item) => {
    if (item.type === 'folder') return '📁';
    if (item.mimeType?.startsWith('image/')) return '🖼️';
    if (item.mimeType?.startsWith('video/')) return '🎬';
    if (item.mimeType?.startsWith('audio/')) return '🎵';
    if (item.mimeType?.startsWith('text/') || item.name?.endsWith('.pdf')) return '📄';
    return '📎';
  };

  const isPreviewable = (item) => {
    if (item.type === 'folder') return false;
    const mime = item.mimeType || '';
    const name = item.name || '';
    return (
      mime.startsWith('image/') ||
      mime.startsWith('text/') ||
      mime.startsWith('video/') ||
      mime.startsWith('audio/') ||
      name.endsWith('.pdf')
    );
  };

  const handlePreview = async (item) => {
    if (!isPreviewable(item)) return;
    try {
      const url = await getFileDownloadUrl(hostId, item.storagePath);
      setPreviewFile({ ...item, url });
    } catch (err) {
      console.error('Preview failed', err);
    }
  };

  const handleDownload = async (item) => {
    try {
      const url = await getFileDownloadUrl(hostId, item.storagePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      a.click();
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const allFiles = await getRawFiles(hostId);
      const zip = new JSZip();
      for (const file of allFiles) {
        const url = await getFileDownloadUrl(hostId, file.storagePath);
        const response = await fetch(url);
        const blob = await response.blob();
        zip.file(file.fullPath, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${hostId}-files.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('Download all failed', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = () => {
    loadFiles();
    loadSessionInfo();
  };

  const processUploadFiles = useCallback((fileList) => {
    const fileArray = Array.from(fileList);
    const mapped = fileArray.map((f) => ({
      file: f,
      relativePath: f.webkitRelativePath || f.name,
      name: f.name,
      size: f.size,
      type: f.type,
    }));
    setUploadFiles((prev) => [...prev, ...mapped]);
  }, []);

  const handleUploadDrop = useCallback(
    (e) => {
      e.preventDefault();
      setUploadDragging(false);
      if (e.dataTransfer.files.length > 0) processUploadFiles(e.dataTransfer.files);
    },
    [processUploadFiles]
  );

  const handleUploadSelect = (e) => {
    if (e.target.files.length > 0) processUploadFiles(e.target.files);
  };

  const removeUploadFile = (index) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');

    try {
      const metadata = [];
      let done = 0;

      for (const { file, relativePath } of uploadFiles) {
        const storagePath = `uploads/${hostId}/${relativePath}`;
        const fd = new FormData();
        fd.append('hostId', hostId);
        fd.append('file', file);
        fd.append('storagePath', storagePath);

        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const result = await res.json();

        if (!res.ok) {
          setUploadError(result.error || `Failed to upload "${relativePath}"`);
          return;
        }

        metadata.push({
          name: result.name,
          fullPath: relativePath,
          storagePath,
          size: result.size,
          mimeType: result.mimeType,
          downloadURL: result.downloadURL,
        });

        done++;
        setUploadProgress(Math.round((done / uploadFiles.length) * 100));
      }

      await addFiles(hostId, metadata);
      setUploadFiles([]);
      setShowUpload(false);
      loadFiles();
      loadSessionInfo();
    } catch (err) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleChangePin = async (e) => {
    e.preventDefault();
    setChangingPin(true);
    setPinError('');
    setPinSuccess('');

    try {
      const result = await changePin(hostId, currentPin, newPin);
      if (result.success) {
        setPinSuccess('PIN changed successfully!');
        setCurrentPin('');
        setNewPin('');
      } else {
        setPinError(result.error);
      }
    } catch {
      setPinError('Failed to change PIN');
    } finally {
      setChangingPin(false);
    }
  };

  const handleKickUsers = async () => {
    if (!confirm('Kick all users? They will need the PIN to re-join.')) return;
    setKicking(true);
    try {
      const result = await kickUsers(hostId);
      if (result.success) {
        alert('All users have been kicked. You (the host) can still access this room.');
      }
    } catch {
      alert('Failed to kick users');
    } finally {
      setKicking(false);
    }
  };

  const renderFileItem = (item, path = '') => {
    const currentPath = path ? `${path}/${item.name}` : item.name;

    if (item.type === 'folder') {
      const isOpen = expandedFolders[currentPath];
      return (
        <div key={currentPath} className="animate-fade-in">
          <button
            onClick={() => toggleFolder(currentPath)}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
          >
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-lg">{getIcon(item)}</span>
            <span className="font-medium">{item.name}</span>
            <span className="text-xs text-gray-500 ml-auto">{item.children?.length || 0} items</span>
          </button>
          {isOpen && (
            <div className="ml-6 border-l border-white/10 pl-2">
              {item.children?.map((child) => renderFileItem(child, currentPath))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={currentPath} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors group animate-fade-in">
        <span className="text-lg flex-shrink-0">{getIcon(item)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate">{item.name}</p>
          <p className="text-xs text-gray-500">{formatSize(item.size)}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isPreviewable(item) && (
            <button onClick={() => handlePreview(item)} className="glass-light !p-2 rounded-lg text-xs hover:bg-white/10 transition-colors" title="Preview">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
          <button onClick={() => handleDownload(item)} className="glass-light !p-2 rounded-lg text-xs hover:bg-white/10 transition-colors" title="Download">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>
    );
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const countFiles = (tree) => {
    let count = 0;
    for (const item of tree) {
      if (item.type === 'folder') count += countFiles(item.children || []);
      else count++;
    }
    return count;
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button onClick={() => router.push('/')} className="btn-primary w-full">
            Back to Home
          </button>
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

      <div className="max-w-5xl mx-auto relative z-10 space-y-4">
        <div className="glass rounded-2xl p-4 md:p-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-bold truncate">{hostId}</h1>
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 font-medium whitespace-nowrap">
                  {isHost ? 'Host' : 'Member'}
                </span>
              </div>
              <p className="text-gray-400 text-xs md:text-sm">
                {countFiles(fileTree)} shared file(s)
                {sessionInfo?.createdAt && ` · Created ${formatDate(sessionInfo.createdAt)}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={handleRefresh} className="btn-secondary !py-2 !px-3 text-sm" title="Refresh">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={() => setShowUpload(!showUpload)}
                className="btn-primary !py-2 !px-4 text-sm flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {showUpload ? 'Cancel' : 'Upload Files'}
              </button>
              <button
                onClick={handleDownloadAll}
                disabled={downloading || fileTree.length === 0}
                className="btn-primary !py-2 !px-4 text-sm flex items-center gap-1.5"
              >
                {downloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Zipping...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download All
                  </>
                )}
              </button>
              {isHost && (
                <button
                  onClick={() => setShowHostControls(!showHostControls)}
                  className="btn-secondary !py-2 !px-3 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              )}
              <button onClick={() => router.push('/')} className="btn-secondary !py-2 !px-3" title="Back to Home">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {showUpload && (
          <div className="glass rounded-2xl p-4 md:p-6 animate-fade-in">
            <h3 className="font-medium mb-4">Upload Files to Room</h3>
            <div
              className={`dropzone p-6 text-center mb-4 ${uploadDragging ? 'active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setUploadDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setUploadDragging(false); }}
              onDragOver={(e) => { e.preventDefault(); }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleUploadSelect}
              />
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={handleUploadSelect}
              />
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-sm">{uploadFiles.length > 0 ? `${uploadFiles.length} file(s) selected` : 'Drop files or folders here'}</p>
              </div>
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary !py-1.5 !px-3 text-xs">
                  Browse Files
                </button>
                <button type="button" onClick={() => folderInputRef.current?.click()} className="btn-secondary !py-1.5 !px-3 text-xs">
                  Browse Folders
                </button>
              </div>
            </div>

            {uploadFiles.length > 0 && (
              <div className="glass-light rounded-xl max-h-36 overflow-y-auto scrollbar-thin mb-4">
                {uploadFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm truncate">{f.relativePath}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{formatSize(f.size)}</span>
                    </div>
                    <button onClick={() => removeUploadFile(i)} className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0 ml-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploading && (
              <div className="space-y-1 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Uploading...</span>
                  <span className="text-indigo-400">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2 rounded-lg mb-3">
                {uploadError}
              </div>
            )}

            <button onClick={startUpload} disabled={uploading || uploadFiles.length === 0} className="btn-primary w-full text-sm">
              {uploading ? `Uploading ${uploadProgress}%` : `Upload ${uploadFiles.length} file(s)`}
            </button>
          </div>
        )}

        {isHost && showHostControls && (
          <div className="glass rounded-2xl p-4 md:p-6 animate-fade-in">
            <h3 className="font-medium mb-4">Host Controls</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-light rounded-xl p-4">
                <h4 className="text-sm font-medium mb-3">Change PIN</h4>
                <form onSubmit={handleChangePin} className="space-y-3">
                  <input
                    type="password"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value)}
                    placeholder="Current PIN"
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    required
                  />
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="New PIN"
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    required
                    minLength={4}
                  />
                  {pinError && <p className="text-red-400 text-xs">{pinError}</p>}
                  {pinSuccess && <p className="text-green-400 text-xs">{pinSuccess}</p>}
                  <button type="submit" disabled={changingPin || !currentPin || !newPin} className="btn-primary w-full text-sm !py-2">
                    {changingPin ? 'Changing...' : 'Change PIN'}
                  </button>
                </form>
              </div>
              <div className="glass-light rounded-xl p-4">
                <h4 className="text-sm font-medium mb-3">Kick All Users</h4>
                <p className="text-xs text-gray-400 mb-3">
                  This will revoke access for all receivers. They will need the PIN to re-join. You (the host) will remain connected.
                </p>
                <button onClick={handleKickUsers} disabled={kicking} className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors">
                  {kicking ? 'Kicking...' : 'Kick All Users'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="glass rounded-2xl p-4 md:p-6">
          {fileTree.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📂</div>
              <p className="text-gray-400 mb-4">No files in this room yet</p>
              <button onClick={() => setShowUpload(true)} className="btn-primary text-sm !py-2 !px-4">
                Upload Files
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {fileTree.map((item) => renderFileItem(item))}
            </div>
          )}
        </div>
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setPreviewFile(null)}>
          <div className="glass rounded-2xl p-4 max-w-3xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium truncate">{previewFile.name}</h3>
              <button onClick={() => setPreviewFile(null)} className="glass-light !p-2 rounded-lg hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black/20">
              {previewFile.mimeType?.startsWith('image/') && (
                <img src={previewFile.url} alt={previewFile.name} className="max-w-full max-h-[70vh] mx-auto object-contain" />
              )}
              {previewFile.mimeType?.startsWith('video/') && (
                <video controls className="w-full max-h-[70vh]">
                  <source src={previewFile.url} type={previewFile.mimeType} />
                </video>
              )}
              {previewFile.mimeType?.startsWith('audio/') && (
                <div className="p-8 text-center">
                  <div className="text-5xl mb-4">🎵</div>
                  <audio controls className="w-full">
                    <source src={previewFile.url} type={previewFile.mimeType} />
                  </audio>
                </div>
              )}
              {previewFile.mimeType?.startsWith('text/') && (
                <iframe src={previewFile.url} className="w-full h-[70vh]" title="Text preview" />
              )}
              {previewFile.name?.endsWith('.pdf') && (
                <iframe src={previewFile.url} className="w-full h-[70vh]" title="PDF preview" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
