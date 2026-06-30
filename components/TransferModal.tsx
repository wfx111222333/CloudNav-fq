import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Image, Paperclip, Trash2, Download, Copy } from 'lucide-react';
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

export default function TransferModal({ isOpen, onClose, authToken }: TransferModalProps) {
  const [messages, setMessages] = useState<TransferMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && authToken) {
      fetchMessages();
    }
  }, [isOpen, authToken]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/transfer/messages', {
        headers: { 'x-auth-password': authToken },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.sort((a: TransferMessage, b: TransferMessage) => a.createdAt - b.createdAt));
      }
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
    setIsLoading(false);
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
        setMessages([...messages, newMessage]);
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

      const response = await fetch('/api/transfer/upload', {
        method: 'POST',
        headers: { 'x-auth-password': authToken },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const newMessage: TransferMessage = {
          id: Date.now().toString(),
          type: result.isImage ? 'image' : 'file',
          content: result.fileUrl,
          fileName: result.fileName,
          fileSize: result.message?.fileSize || 0,
          createdAt: Date.now(),
          sender: 'user',
        };

        setMessages(prev => [...prev, newMessage]);
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
        const filename = message.content.split('/').pop();
        await fetch(`/api/transfer/file/${filename}`, {
          method: 'DELETE',
          headers: { 'x-auth-password': authToken },
        });
      }

      setMessages(messages.filter(m => m.id !== message.id));
    } catch (error) {
      console.error('Failed to delete message', error);
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
      await navigator.clipboard.writeText(url);
      alert('链接已复制到剪贴板');
    } catch (error) {
      console.error('Failed to copy', error);
    }
  };

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
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
              {messages.length} 条消息
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto p-4 space-y-4"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
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
                <div
                  key={message.id}
                  className="flex gap-3 group"
                >
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
                          <div className="absolute top-2 right-2 flex gap-1">
                            <button
                              onClick={() => copyLink(message.content)}
                              className="p-1.5 bg-black/50 rounded-lg text-white opacity-0 hover:opacity-100 transition-opacity"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteMessage(message)}
                              className="p-1.5 bg-black/50 rounded-lg text-white opacity-0 hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <a
                          href={message.content}
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
                <Image className="w-5 h-5" />
              </button>
            </div>

            <input
              id="file-input"
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              id="image-input"
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />

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
