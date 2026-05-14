'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getFiles, getFileDownloadUrl, getRawFiles } from '@/actions';
import JSZip from 'jszip';

export default function DashboardPage() {
  const { hostId } = useParams();
  const router = useRouter();
  const [fileTree, setFileTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [hostId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const tree = await getFiles(hostId);
      setFileTree(tree);
    } catch (err) {
      if (err.message?.includes('NEXT_REDIRECT')) return;
      setError('Failed to load files. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const formatDate = () => {
    return new Date().toLocaleDateString('en-US', {
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
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-lg">{getIcon(item)}</span>
            <span className="font-medium">{item.name}</span>
            <span className="text-xs text-gray-500 ml-auto">
              {item.children?.length || 0} items
            </span>
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
      <div
        key={currentPath}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors group animate-fade-in"
      >
        <span className="text-lg flex-shrink-0">{getIcon(item)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm truncate">{item.name}</p>
          <p className="text-xs text-gray-500">{formatSize(item.size)}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isPreviewable(item) && (
            <button
              onClick={() => handlePreview(item)}
              className="glass-light !p-2 rounded-lg text-xs hover:bg-white/10 transition-colors"
              title="Preview"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => handleDownload(item)}
            className="glass-light !p-2 rounded-lg text-xs hover:bg-white/10 transition-colors"
            title="Download"
          >
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 text-indigo-400 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400">Loading files...</p>
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

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="glass rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{hostId}</h1>
                <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 font-medium">
                  Active
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                {countFiles(fileTree)} shared files &middot; {formatDate()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadAll}
                disabled={downloading || fileTree.length === 0}
                className="btn-primary !py-2 !px-4 text-sm flex items-center gap-2"
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
                    Download All (ZIP)
                  </>
                )}
              </button>
              <button
                onClick={() => router.push('/')}
                className="btn-secondary !py-2 !px-3"
                title="Back to Home"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-4 md:p-6">
          {fileTree.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📂</div>
              <p className="text-gray-400">No files in this share</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {fileTree.map((item) => renderFileItem(item))}
            </div>
          )}
        </div>
      </div>

      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="glass rounded-2xl p-4 max-w-3xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium truncate">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="glass-light !p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
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
