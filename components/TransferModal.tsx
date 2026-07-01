import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Image as ImageIcon, Paperclip, Trash2, Download, Copy, Folder, FolderPlus, Search, Grid, List, Move } from 'lucide-react';
import { TransferMessage } from '../types';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
}

const isImageUrl = (url: string): boolean => {
  const ext = url.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '');
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const compressImage = (file: File, maxSize: number = 300, quality: number = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Compression failed'));
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function TransferModal({ isOpen, onClose, authToken }: TransferModalProps) {
  const [messages, setMessages] = useState<TransferMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'messages' | 'files'>('messages');

  const [searchTerm, setSearchTerm] = useState('');
  const [currentFolder, setCurrentFolder] = useState<string>('');
  const [fileViewMode, setFileViewMode] = useState<'grid' | 'list'>('grid');
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);

  const [allMessages, setAllMessages] = useState<TransferMessage[]>([]);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [filePage, setFilePage] = useState(1);
  const FILES_PER_PAGE = 6;

  useEffect(() => {
    if (isOpen && authToken) {
      fetchMessages();
    }
  }, [isOpen, authToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (activeTab === 'messages') {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!showMoveMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-move-menu]')) {
        setShowMoveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoveMenu]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
        loadMoreMessages();
      }
    };
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [hasMoreMessages, isLoadingMore]);

  useEffect(() => {
    setFilePage(1);
  }, [searchTerm, currentFolder]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/transfer/messages', {
        headers: { 'x-auth-password': authToken },
      });
      if (response.ok) {
        const data = await response.json();
        const sorted = data.sort((a: TransferMessage, b: TransferMessage) => a.createdAt - b.createdAt);
        setAllMessages(sorted);
        setMessageOffset(0);
        setHasMoreMessages(true);
        updateDisplayMessages(sorted, 0);
      }
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
    setIsLoading(false);
  };

  const updateDisplayMessages = (all: TransferMessage[], offset: number) => {
    const PAGE_SIZE = 5;
    const start = Math.max(0, all.length - offset - PAGE_SIZE);
    const end = all.length - offset;
    setMessages(all.slice(start, end));
    setHasMoreMessages(start > 0);
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    setIsLoadingMore(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    const newOffset = messageOffset + 5;
    setMessageOffset(newOffset);
    updateDisplayMessages(allMessages, newOffset);
    setIsLoadingMore(false);
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    try {
      const response = await fetch('/api/transfer/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify({
          type: 'text',
          content: inputValue,
          sender: 'user',
        }),
      });

      if (response.ok) {
        const newMessage = await response.json();
        setAllMessages(prev => [...prev, newMessage]);
        updateDisplayMessages([...allMessages, newMessage], messageOffset);
        setInputValue('');
      }
    } catch (error) {
      console.error('Failed to send message', error);
    }
  };

  const uploadFile = async (file: File) => {
    if (!authToken) {
      alert('请先登录后再上传文件');
      return;
    }

    const fileId = `${file.name}-${Date.now()}`;
    setUploadingFiles(prev => new Set([...prev, fileId]));

    try {
      const formData = new FormData();
      formData.append('file', file);

      // 图片文件：客户端生成缩略图同时上传，原图用于下载
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        try {
          const thumbBlob = await compressImage(file, 300, 0.7);
          formData.append('thumbnail', thumbBlob, 'thumb.jpg');
        } catch (compressErr) {
          console.warn('Thumbnail compression failed, uploading original only', compressErr);
        }
      }

      if (currentFolder) {
        formData.append('folder', currentFolder);
      }

      const response = await fetch('/api/transfer/upload', {
        method: 'POST',
        headers: { 'x-auth-password': authToken },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const newMessage: TransferMessage = {
          id: result.message?.id || Date.now().toString(),
          type: result.isImage ? 'image' : 'file',
          // 显示用缩略图（若有），否则用原图
          content: result.thumbnailUrl || result.fileUrl,
          fileName: result.fileName,
          fileSize: result.message?.fileSize || 0,
          createdAt: result.message?.createdAt || Date.now(),
          sender: 'user',
          folder: currentFolder || '',
          // 原图URL用于下载
          originalUrl: result.thumbnailUrl ? result.fileUrl : undefined,
        };

        setAllMessages(prev => [...prev, newMessage]);
        updateDisplayMessages([...allMessages, newMessage], messageOffset);
      } else {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          alert('认证失败，请重新登录');
        } else if (response.status === 500) {
          alert(`上传失败: ${errorData.error || '服务器错误，请检查R2存储桶是否已配置'}`);
        } else {
          alert(`上传失败: ${errorData.error || response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Failed to upload file', error);
      alert('网络错误，上传失败');
    }

    setUploadingFiles(prev => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
  };

  const deleteMessage = async (message: TransferMessage) => {
    if (!window.confirm('确定要删除这条消息吗？')) return;

    try {
      await fetch(`/api/transfer/messages/${message.id}`, {
        method: 'DELETE',
        headers: { 'x-auth-password': authToken },
      });

      if (message.type !== 'text') {
        // 删除显示用文件（缩略图或原图）
        const displayFilename = message.content.split('/').pop();
        if (displayFilename) {
          await fetch(`/api/transfer/file/${displayFilename}`, {
            method: 'DELETE',
            headers: { 'x-auth-password': authToken },
          });
        }
        // 若存在原图URL（说明显示用的是缩略图），还需删除原图
        if (message.originalUrl) {
          const originalFilename = message.originalUrl.split('/').pop();
          if (originalFilename && originalFilename !== displayFilename) {
            await fetch(`/api/transfer/file/${originalFilename}`, {
              method: 'DELETE',
              headers: { 'x-auth-password': authToken },
            });
          }
        }
      }

      setAllMessages(prev => prev.filter(m => m.id !== message.id));
      updateDisplayMessages(allMessages.filter(m => m.id !== message.id), messageOffset);
    } catch (error) {
      console.error('Failed to delete message', error);
    }
  };

  const moveFile = async (message: TransferMessage, folder: string) => {
    try {
      await fetch(`/api/transfer/messages/${message.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify({ folder }),
      });

      setAllMessages(prev => prev.map(m => m.id === message.id ? { ...m, folder } : m));
      setShowMoveMenu(null);
    } catch (error) {
      console.error('Failed to move file', error);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files as FileList).forEach((file: File) => uploadFile(file));
    }
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files) {
      Array.from(files as FileList).forEach((file: File) => uploadFile(file));
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const copyLink = async (url: string) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      alert('链接已复制到剪贴板');
    } catch (error) {
      console.error('Failed to copy', error);
    }
  };

  const fileMessages = allMessages.filter(m => m.type !== 'text');
  const folders: string[] = Array.from(new Set(fileMessages.map(m => m.folder || '').filter(f => f !== '')));
  const filteredFiles = fileMessages.filter(m => {
    const folderMatch = currentFolder === '' ? true : (m.folder || '') === currentFolder;
    const searchMatch = !searchTerm || (m.fileName || '').toLowerCase().includes(searchTerm.toLowerCase());
    return folderMatch && searchMatch;
  });
  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / FILES_PER_PAGE));
  const paginatedFiles = filteredFiles.slice((filePage - 1) * FILES_PER_PAGE, filePage * FILES_PER_PAGE);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">文件传输助手</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('messages')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'messages'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            消息 ({allMessages.length})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'files'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            文件管理 ({fileMessages.length})
          </button>
        </div>

        {activeTab === 'messages' ? (
          <>
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {hasMoreMessages && messages.length > 0 && (
                <div className="flex items-center justify-center py-2">
                  <button
                    onClick={loadMoreMessages}
                    disabled={isLoadingMore}
                    className="flex items-center gap-1 px-3 py-1 text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span>加载中...</span>
                      </>
                    ) : (
                      <>
                        <span>↓</span>
                        <span>刷新更多消息</span>
                      </>
                    )}
                  </button>
                </div>
              )}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <Paperclip className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">暂无消息</p>
                  <p className="text-sm text-slate-400 mt-2">拖拽文件到此处或点击下方按钮上传</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map(message => (
                    <div key={message.id} className="flex gap-3 group">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-300 text-xs font-bold">我</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-slate-500">我</span>
                          <span className="text-xs text-slate-400">{formatTime(message.createdAt)}</span>
                        </div>

                        <div className="relative">
                          {message.type === 'text' ? (
                            <p className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-slate-800 dark:text-slate-100 text-sm max-w-md">
                              {message.content}
                            </p>
                          ) : message.type === 'image' ? (
                            <div className="relative">
                              <img
                                src={message.content}
                                alt={message.fileName}
                                onClick={() => setPreviewImage(message.content)}
                                className="max-w-sm max-h-64 object-contain rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
                              />
                              <div className="flex gap-1 mt-1">
                                <button
                                  onClick={() => copyLink(message.content)}
                                  className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => deleteMessage(message)}
                                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <a
                              href={message.originalUrl || message.content}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <Paperclip className="w-5 h-5 text-blue-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {message.fileName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatFileSize(message.fileSize || 0)}
                                </p>
                              </div>
                              <Download className="flex-shrink-0 w-4 h-4 text-slate-400" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}

              {uploadingFiles.size > 0 && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-blue-600 dark:text-blue-300">
                    正在上传 {uploadingFiles.size} 个文件...
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => document.getElementById('file-input')?.click()}
                    className="p-2.5 text-slate-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    title="选择文件"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => document.getElementById('image-input')?.click()}
                    className="p-2.5 text-slate-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    title="选择图片"
                  >
                    <ImageIcon className="w-5 h-5" />
                  </button>
                </div>

                <input id="file-input" type="file" multiple onChange={handleFileSelect} className="hidden" />
                <input id="image-input" type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />

                <div className="flex-1 relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim()}
                  className="flex-shrink-0 p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                  title="发送"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center">
                支持拖拽文件上传 | 图片自动生成图床链接
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-hide">
                  <button
                    onClick={() => setCurrentFolder('')}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      currentFolder === ''
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    全部文件
                  </button>
                  {folders.map(folder => (
                    <button
                      key={folder}
                      onClick={() => setCurrentFolder(folder)}
                      className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        currentFolder === folder
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Folder className="w-3 h-3" />
                      <span className="max-w-[80px] truncate">{folder}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {showNewFolderInput ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="名称"
                        className="w-20 px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          if (newFolderName.trim()) {
                            setCurrentFolder(newFolderName.trim());
                            setNewFolderName('');
                          }
                          setShowNewFolderInput(false);
                        }}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded-lg"
                      >
                        确定
                      </button>
                      <button
                        onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }}
                        className="px-2 py-1 text-xs text-slate-500 rounded-lg"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowNewFolderInput(true)}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="新建文件夹"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
                    <button
                      onClick={() => setFileViewMode('grid')}
                      className={`p-1.5 rounded ${fileViewMode === 'grid' ? 'bg-white dark:bg-slate-600 text-blue-500' : 'text-slate-400'}`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setFileViewMode('list')}
                      className={`p-1.5 rounded ${fileViewMode === 'list' ? 'bg-white dark:bg-slate-600 text-blue-500' : 'text-slate-400'}`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索文件..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredFiles.length === 0 ? (
                <div className="text-center py-12">
                  <Paperclip className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {searchTerm ? '未找到匹配文件' : currentFolder ? '该文件夹为空' : '暂无文件'}
                  </p>
                  <p className="text-sm text-slate-400 mt-2">点击下方按钮上传文件</p>
                </div>
              ) : fileViewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {paginatedFiles.map(message => (
                    <div
                      key={message.id}
                      className="relative group bg-slate-50 dark:bg-slate-800 rounded-xl p-3 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col items-center gap-2">
                        {message.type === 'image' ? (
                          <img
                            src={message.content}
                            alt={message.fileName}
                            onClick={() => setPreviewImage(message.originalUrl || message.content)}
                            className="w-16 h-16 object-cover rounded-lg cursor-pointer"
                          />
                        ) : (
                          <div
                            className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors"
                            onClick={() => window.open(message.content, '_blank')}
                          >
                            <Paperclip className="w-6 h-6 text-blue-500" />
                          </div>
                        )}
                        <p className="text-xs text-slate-700 dark:text-slate-200 w-full text-center break-words" title={message.fileName} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {message.fileName}
                        </p>
                        <p className="text-xs text-slate-400">{formatFileSize(message.fileSize || 0)}</p>
                      </div>

                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          data-move-menu
                          onClick={() => setShowMoveMenu(showMoveMenu === message.id ? null : message.id)}
                          className="p-1 bg-black/50 rounded text-white hover:bg-black/70"
                          title="移动"
                        >
                          <Move className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => copyLink(message.content)}
                          className="p-1 bg-black/50 rounded text-white hover:bg-green-500"
                          title="复制链接"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <a
                          href={message.originalUrl || message.content}
                          download
                          className="p-1 bg-black/50 rounded text-white hover:bg-blue-500"
                          title="下载"
                        >
                          <Download className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => deleteMessage(message)}
                          className="p-1 bg-black/50 rounded text-white hover:bg-red-500"
                          title="删除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {showMoveMenu === message.id && (
                        <div data-move-menu className="absolute top-8 right-1 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 z-10 min-w-[120px]">
                          <button
                            onClick={() => moveFile(message, '')}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-600 rounded-t-lg"
                          >
                            根目录
                          </button>
                          {folders.map(folder => (
                            <button
                              key={folder}
                              onClick={() => moveFile(message, folder)}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-600"
                            >
                              {folder}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedFiles.map(message => (
                    <div
                      key={message.id}
                      className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      {message.type === 'image' ? (
                        <img
                          src={message.content}
                          alt={message.fileName}
                          onClick={() => setPreviewImage(message.originalUrl || message.content)}
                          className="w-10 h-10 object-cover rounded-lg cursor-pointer flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors"
                          onClick={() => window.open(message.content, '_blank')}
                        >
                          <Paperclip className="w-5 h-5 text-blue-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                          {message.fileName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(message.fileSize || 0)} · {formatTime(message.createdAt)}
                          {message.folder && ` · ${message.folder}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="relative">
                          <button
                            data-move-menu
                            onClick={() => setShowMoveMenu(showMoveMenu === message.id ? null : message.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                            title="移动"
                          >
                            <Move className="w-4 h-4" />
                          </button>
                          {showMoveMenu === message.id && (
                            <div data-move-menu className="absolute top-8 right-0 bg-white dark:bg-slate-700 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 z-10 min-w-[120px]">
                              <button
                                onClick={() => moveFile(message, '')}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-600 rounded-t-lg"
                              >
                                根目录
                              </button>
                              {folders.map(folder => (
                                <button
                                  key={folder}
                                  onClick={() => moveFile(message, folder)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-600"
                                >
                                  {folder}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => copyLink(message.content)}
                          className="p-1.5 text-slate-400 hover:text-green-500 transition-colors"
                          title="复制链接"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={message.originalUrl || message.content}
                          download
                          className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                          title="下载"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => deleteMessage(message)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {uploadingFiles.size > 0 && (
                <div className="flex items-center gap-2 p-3 mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-blue-600 dark:text-blue-300">
                    正在上传 {uploadingFiles.size} 个文件...
                  </span>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-2 px-3 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-50 dark:bg-slate-800/50">
                <button
                  onClick={() => setFilePage(p => Math.max(1, p - 1))}
                  disabled={filePage === 1}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded"
                >
                  上一页
                </button>
                <span className="text-xs text-slate-400">
                  第 {filePage} / {totalPages} 页
                </span>
                <button
                  onClick={() => setFilePage(p => Math.min(totalPages, p + 1))}
                  disabled={filePage === totalPages}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed rounded"
                >
                  下一页
                </button>
              </div>
            )}

            <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <button
                onClick={() => document.getElementById('file-mgr-input')?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Paperclip className="w-4 h-4" />
                上传文件{currentFolder ? `到 "${currentFolder}"` : ''}
              </button>
              <input id="file-mgr-input" type="file" multiple onChange={handleFileSelect} className="hidden" />
            </div>
          </div>
        )}
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="预览"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}
