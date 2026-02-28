import { useState } from 'react';
import { Trash2, FolderOpen, Tag, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { FileFolder, FileTag } from './FileOrganization';

interface BulkActionToolbarProps {
  selectedCount: number;
  folders?: FileFolder[];
  tags?: FileTag[];
  onMoveToFolder?: (folderId: string) => void;
  onAddTags?: (tagIds: string[]) => void;
  onDelete: () => void;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

export default function BulkActionToolbar({
  selectedCount,
  folders,
  tags,
  onMoveToFolder,
  onAddTags,
  onDelete,
  onClearSelection,
}: BulkActionToolbarProps) {
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedFolderForMove, setSelectedFolderForMove] = useState<string | null>(null);
  const [selectedTagsForAdd, setSelectedTagsForAdd] = useState<Set<string>>(new Set());

  const handleMoveToFolder = () => {
    if (!selectedFolderForMove) {
      toast.error('Please select a folder');
      return;
    }
    onMoveToFolder?.(selectedFolderForMove);
    setShowMoveModal(false);
    setSelectedFolderForMove(null);
    toast.success(`Moved ${selectedCount} file(s) to folder`);
  };

  const handleAddTags = () => {
    if (selectedTagsForAdd.size === 0) {
      toast.error('Please select at least one tag');
      return;
    }
    onAddTags?.(Array.from(selectedTagsForAdd));
    setShowTagModal(false);
    setSelectedTagsForAdd(new Set());
    toast.success(`Added tags to ${selectedCount} file(s)`);
  };

  const handleDeleteConfirm = () => {
    onDelete();
    setShowDeleteConfirm(false);
    toast.success(`Deleted ${selectedCount} file(s)`);
  };

  const toggleTag = (tagId: string) => {
    const newSelected = new Set(selectedTagsForAdd);
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId);
    } else {
      newSelected.add(tagId);
    }
    setSelectedTagsForAdd(newSelected);
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <>
      {/* Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg font-medium text-sm">
                {selectedCount} selected
              </div>
              <button
                onClick={onClearSelection}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Move to Folder Button */}
              <button
                onClick={() => setShowMoveModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
              >
                <FolderOpen className="w-4 h-4" />
                Move to Folder
              </button>

              {/* Add Tags Button */}
              <button
                onClick={() => setShowTagModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
              >
                <Tag className="w-4 h-4" />
                Add Tags
              </button>

              {/* Delete Button */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Move to Folder Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Move to Folder</h3>
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setSelectedFolderForMove(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {!folders || folders.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">No folders available</p>
              ) : (
                folders?.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolderForMove(folder.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedFolderForMove === folder.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{folder.name}</p>
                    {folder.description && (
                      <p className="text-xs text-gray-600 mt-1">{folder.description}</p>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setSelectedFolderForMove(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveToFolder}
                disabled={!selectedFolderForMove}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
              >
                Move
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tags Modal */}
      {showTagModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add Tags</h3>
              <button
                onClick={() => {
                  setShowTagModal(false);
                  setSelectedTagsForAdd(new Set());
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
              {!tags || tags.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">No tags available</p>
              ) : (
                tags?.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-between ${
                      selectedTagsForAdd.has(tag.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedTagsForAdd.has(tag.id)
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedTagsForAdd.has(tag.id) && (
                          <span className="text-white text-xs">✓</span>
                        )}
                      </div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${tag.color}`}>
                        {tag.name}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => {
                  setShowTagModal(false);
                  setSelectedTagsForAdd(new Set());
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTags}
                disabled={selectedTagsForAdd.size === 0}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium transition-colors"
              >
                Add Tags
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Delete Files</h3>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-700">
                Are you sure you want to delete {selectedCount} file{selectedCount !== 1 ? 's' : ''}?
                This action cannot be undone.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
