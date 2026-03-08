import { useState } from 'react';
import { FolderPlus, Tag, Grid3x3, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';

export interface FileFolder {
  id: string;
  name: string;
  description?: string;
  fileCount: number;
  parentId?: string | null;
}

export interface FileTag {
  id: string;
  name: string;
  color: string;
  fileCount: number;
}

interface FileOrganizationProps {
  folders: FileFolder[];
  tags: FileTag[];
  onCreateFolder?: (name: string, description?: string) => void;
  onCreateTag?: (name: string, color: string) => void;
  onDeleteFolder?: (id: string) => void;
  onDeleteTag?: (id: string) => void;
  onSelectFolder?: (id: string | null) => void;
  onSelectTag?: (id: string | null) => void;
  onFolderSelect?: (id: string | null) => void;
  onTagSelect?: (id: string | null) => void;
  selectedFolderId?: string | null;
  selectedTagId?: string | null;
}

const TAG_COLORS = [
  { name: 'Red', value: 'bg-red-100 text-red-800' },
  { name: 'Orange', value: 'bg-orange-100 text-orange-800' },
  { name: 'Yellow', value: 'bg-yellow-100 text-yellow-800' },
  { name: 'Green', value: 'bg-green-100 text-green-800' },
  { name: 'Blue', value: 'bg-blue-100 text-blue-800' },
  { name: 'Purple', value: 'bg-purple-100 text-purple-800' },
  { name: 'Pink', value: 'bg-pink-100 text-pink-800' },
  { name: 'Gray', value: 'bg-gray-100 text-gray-800' },
];

export default function FileOrganization({
  folders,
  tags,
  onCreateFolder,
  onCreateTag,
  onDeleteFolder,
  onDeleteTag,
  onSelectFolder,
  onSelectTag,
  selectedFolderId,
  selectedTagId,
}: FileOrganizationProps) {
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [showTagForm, setShowTagForm] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0].value);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['folders', 'tags'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleCreateFolder = () => {
    if (!folderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    onCreateFolder?.(folderName, folderDescription);
    setFolderName('');
    setFolderDescription('');
    setShowFolderForm(false);
    toast.success('Folder created');
  };

  const handleCreateTag = () => {
    if (!tagName.trim()) {
      toast.error('Tag name is required');
      return;
    }

    onCreateTag?.(tagName, selectedColor);
    setTagName('');
    setSelectedColor(TAG_COLORS[0].value);
    setShowTagForm(false);
    toast.success('Tag created');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Folders Section */}
      <div>
        <button
          onClick={() => toggleSection('folders')}
          className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Grid3x3 className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-gray-900">Folders</span>
            <span className="text-xs text-gray-500">({folders.length})</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-600 transition-transform ${
              expandedSections.has('folders') ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expandedSections.has('folders') && (
          <div className="divide-y divide-gray-200">
            {/* Folder List */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => onSelectFolder?.(selectedFolderId === folder.id ? null : folder.id)}
                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                  selectedFolderId === folder.id
                    ? 'bg-blue-50 border-l-2 border-blue-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{folder.name}</p>
                  {folder.description && (
                    <p className="text-xs text-gray-500 truncate">{folder.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {folder.fileCount} file{folder.fileCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFolder?.(folder.id);
                    toast.success('Folder deleted');
                  }}
                  className="ml-3 p-1 text-gray-400 hover:text-red-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Create Folder Form */}
            {showFolderForm ? (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
                <input
                  type="text"
                  placeholder="Folder name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateFolder}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowFolderForm(false);
                      setFolderName('');
                      setFolderDescription('');
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowFolderForm(true)}
                className="w-full px-4 py-3 text-blue-600 hover:bg-blue-50 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                New Folder
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tags Section */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => toggleSection('tags')}
          className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-gray-600" />
            <span className="font-semibold text-gray-900">Tags</span>
            <span className="text-xs text-gray-500">({tags.length})</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-gray-600 transition-transform ${
              expandedSections.has('tags') ? 'rotate-180' : ''
            }`}
          />
        </button>

        {expandedSections.has('tags') && (
          <div className="divide-y divide-gray-200">
            {/* Tag List */}
            {tags.map((tag) => (
              <div
                key={tag.id}
                onClick={() => onSelectTag?.(selectedTagId === tag.id ? null : tag.id)}
                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                  selectedTagId === tag.id
                    ? 'bg-blue-50 border-l-2 border-blue-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${tag.color}`}>
                    {tag.name}
                  </span>
                  <p className="text-xs text-gray-500">
                    {tag.fileCount} file{tag.fileCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTag?.(tag.id);
                    toast.success('Tag deleted');
                  }}
                  className="ml-3 p-1 text-gray-400 hover:text-red-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Create Tag Form */}
            {showTagForm ? (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 space-y-3">
                <input
                  type="text"
                  placeholder="Tag name"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-700">Color</p>
                  <div className="grid grid-cols-4 gap-2">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color.value}
                        onClick={() => setSelectedColor(color.value)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          selectedColor === color.value
                            ? `${color.value} ring-2 ring-offset-2 ring-blue-500`
                            : color.value
                        }`}
                      >
                        {color.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateTag}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowTagForm(false);
                      setTagName('');
                      setSelectedColor(TAG_COLORS[0].value);
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 text-gray-900 rounded-lg text-sm font-medium hover:bg-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTagForm(true)}
                className="w-full px-4 py-3 text-blue-600 hover:bg-blue-50 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Tag className="w-4 h-4" />
                New Tag
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
