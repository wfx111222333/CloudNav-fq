import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Pin, Palette, Edit3, Check, XCircle } from 'lucide-react';
import { NoteItem } from '../types';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
}

const NOTE_COLORS = [
  '#fef3c7',
  '#dbeafe',
  '#d1fae5',
  '#fce7f3',
  '#ede9fe',
  '#f3e8ff',
];

export default function NotesModal({ isOpen, onClose, authToken }: NotesModalProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState('#fef3c7');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteColor, setNewNoteColor] = useState('#fef3c7');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && authToken) {
      fetchNotes();
    }
  }, [isOpen, authToken]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notes', {
        headers: { 'x-auth-password': authToken },
      });
      if (response.ok) {
        const data = await response.json();
        setNotes(data.sort((a: NoteItem, b: NoteItem) => {
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;
          return b.updatedAt - a.updatedAt;
        }));
      }
    } catch (error) {
      console.error('Failed to fetch notes', error);
    }
    setIsLoading(false);
  };

  const createNote = async () => {
    if (!newNoteContent.trim()) return;

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify({
          content: newNoteContent,
          color: newNoteColor,
          pinned: false,
        }),
      });

      if (response.ok) {
        const newNote = await response.json();
        setNotes([newNote, ...notes]);
        setNewNoteContent('');
        setNewNoteColor('#fef3c7');
      }
    } catch (error) {
      console.error('Failed to create note', error);
    }
  };

  const startEdit = (note: NoteItem) => {
    setEditingNote(note);
    setEditContent(note.content);
    setEditColor(note.color);
  };

  const saveEdit = async () => {
    if (!editingNote) return;

    try {
      const response = await fetch(`/api/notes/${editingNote.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify({
          ...editingNote,
          content: editContent,
          color: editColor,
        }),
      });

      if (response.ok) {
        setNotes(notes.map(n => n.id === editingNote.id ? { ...n, content: editContent, color: editColor } : n));
        cancelEdit();
      }
    } catch (error) {
      console.error('Failed to update note', error);
    }
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setEditContent('');
    setEditColor('#fef3c7');
  };

  const deleteNote = async (noteId: string) => {
    if (!window.confirm('确定要删除这个便签吗？')) return;

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: { 'x-auth-password': authToken },
      });

      if (response.ok) {
        setNotes(notes.filter(n => n.id !== noteId));
        if (editingNote?.id === noteId) {
          cancelEdit();
        }
      }
    } catch (error) {
      console.error('Failed to delete note', error);
    }
  };

  const togglePin = async (note: NoteItem) => {
    const updatedNote = { ...note, pinned: !note.pinned };
    try {
      const response = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': authToken,
        },
        body: JSON.stringify(updatedNote),
      });

      if (response.ok) {
        setNotes(notes.map(n => n.id === note.id ? updatedNote : n));
      }
    } catch (error) {
      console.error('Failed to update note', error);
    }
  };

  const pinnedNotes = notes.filter(n => n.pinned);
  const normalNotes = notes.filter(n => !n.pinned);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">便签</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
              {notes.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12">
              <Palette className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">暂无便签，点击下方添加</p>
            </div>
          ) : (
            <div className="space-y-6">
              {pinnedNotes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <Pin className="w-3 h-3" />
                    置顶
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pinnedNotes.map(note => (
                      <div
                        key={note.id}
                        className="relative rounded-xl p-4 shadow-sm transition-all hover:shadow-md"
                        style={{ backgroundColor: note.color }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={() => togglePin(note)}
                            className="p-1 rounded transition-colors text-amber-600"
                          >
                            <Pin className="w-4 h-4 fill-current" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(note)}
                              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteNote(note.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.content}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-1">
                            {NOTE_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  const updated = { ...note, color };
                                  setNotes(notes.map(n => n.id === note.id ? updated : n));
                                  fetch(`/api/notes/${note.id}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-auth-password': authToken,
                                    },
                                    body: JSON.stringify(updated),
                                  });
                                }}
                                className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${
                                  note.color === color ? 'border-slate-600 scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(note.updatedAt).toLocaleString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {normalNotes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase mb-3">
                    所有便签
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {normalNotes.map(note => (
                      <div
                        key={note.id}
                        className="relative rounded-xl p-4 shadow-sm transition-all hover:shadow-md"
                        style={{ backgroundColor: note.color }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={() => togglePin(note)}
                            className="p-1 rounded transition-colors text-slate-400 hover:text-amber-600"
                          >
                            <Pin className="w-4 h-4" />
                          </button>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(note)}
                              className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteNote(note.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.content}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-1">
                            {NOTE_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => {
                                  const updated = { ...note, color };
                                  setNotes(notes.map(n => n.id === note.id ? updated : n));
                                  fetch(`/api/notes/${note.id}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-auth-password': authToken,
                                    },
                                    body: JSON.stringify(updated),
                                  });
                                }}
                                className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${
                                  note.color === color ? 'border-slate-600 scale-110' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">
                            {new Date(note.updatedAt).toLocaleString('zh-CN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
          {editingNote ? (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">编辑便签</h3>
                <button
                  onClick={cancelEdit}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                rows={4}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        editColor === color ? 'border-blue-500 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={cancelEdit}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={!editContent.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                  >
                    <Check className="w-4 h-4 inline-block mr-1" />
                    保存
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    createNote();
                  }
                }}
                placeholder="输入便签内容... (Ctrl+Enter 创建)"
                className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                rows={4}
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewNoteColor(color)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        newNoteColor === color ? 'border-blue-500 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  onClick={createNote}
                  disabled={!newNoteContent.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                >
                  <Plus className="w-4 h-4 inline-block mr-1" />
                  添加
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
