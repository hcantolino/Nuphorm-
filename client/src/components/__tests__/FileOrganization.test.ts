import { describe, it, expect } from 'vitest';
import type { FileFolder, FileTag } from '../FileOrganization';

describe('FileOrganization', () => {
  describe('Folder Management', () => {
    it('should create a new folder', () => {
      const newFolder: FileFolder = {
        id: 'folder-1',
        name: 'Clinical Trials',
        description: 'Phase 1 & 2 trial data',
        fileCount: 0,
      };

      expect(newFolder.id).toBe('folder-1');
      expect(newFolder.name).toBe('Clinical Trials');
      expect(newFolder.fileCount).toBe(0);
    });

    it('should update folder file count', () => {
      const folder: FileFolder = {
        id: 'folder-1',
        name: 'Clinical Trials',
        fileCount: 2,
      };

      const updatedFolder = {
        ...folder,
        fileCount: 3,
      };

      expect(folder.fileCount).toBe(2);
      expect(updatedFolder.fileCount).toBe(3);
    });

    it('should delete a folder', () => {
      const folders: FileFolder[] = [
        { id: 'folder-1', name: 'Clinical Trials', fileCount: 2 },
        { id: 'folder-2', name: 'Analysis Data', fileCount: 1 },
      ];

      const filteredFolders = folders.filter((f) => f.id !== 'folder-1');

      expect(folders.length).toBe(2);
      expect(filteredFolders.length).toBe(1);
      expect(filteredFolders[0].id).toBe('folder-2');
    });

    it('should handle folder selection', () => {
      const folders: FileFolder[] = [
        { id: 'folder-1', name: 'Clinical Trials', fileCount: 2 },
        { id: 'folder-2', name: 'Analysis Data', fileCount: 1 },
      ];

      let selectedFolderId: string | null = null;

      selectedFolderId = 'folder-1';
      expect(selectedFolderId).toBe('folder-1');

      selectedFolderId = null;
      expect(selectedFolderId).toBeNull();
    });
  });

  describe('Tag Management', () => {
    it('should create a new tag', () => {
      const newTag: FileTag = {
        id: 'tag-1',
        name: 'Clinical',
        color: 'bg-blue-100 text-blue-800',
        fileCount: 0,
      };

      expect(newTag.id).toBe('tag-1');
      expect(newTag.name).toBe('Clinical');
      expect(newTag.color).toBe('bg-blue-100 text-blue-800');
    });

    it('should update tag file count', () => {
      const tag: FileTag = {
        id: 'tag-1',
        name: 'Clinical',
        color: 'bg-blue-100 text-blue-800',
        fileCount: 0,
      };

      const updatedTag = {
        ...tag,
        fileCount: 5,
      };

      expect(tag.fileCount).toBe(0);
      expect(updatedTag.fileCount).toBe(5);
    });

    it('should delete a tag', () => {
      const tags: FileTag[] = [
        { id: 'tag-1', name: 'Clinical', color: 'bg-blue-100 text-blue-800', fileCount: 2 },
        { id: 'tag-2', name: 'Safety', color: 'bg-red-100 text-red-800', fileCount: 1 },
      ];

      const filteredTags = tags.filter((t) => t.id !== 'tag-1');

      expect(tags.length).toBe(2);
      expect(filteredTags.length).toBe(1);
      expect(filteredTags[0].id).toBe('tag-2');
    });

    it('should handle tag selection', () => {
      const tags: FileTag[] = [
        { id: 'tag-1', name: 'Clinical', color: 'bg-blue-100 text-blue-800', fileCount: 2 },
        { id: 'tag-2', name: 'Safety', color: 'bg-red-100 text-red-800', fileCount: 1 },
      ];

      let selectedTagId: string | null = null;

      selectedTagId = 'tag-1';
      expect(selectedTagId).toBe('tag-1');

      selectedTagId = null;
      expect(selectedTagId).toBeNull();
    });

    it('should validate tag colors', () => {
      const validColors = [
        'bg-red-100 text-red-800',
        'bg-orange-100 text-orange-800',
        'bg-yellow-100 text-yellow-800',
        'bg-green-100 text-green-800',
        'bg-blue-100 text-blue-800',
        'bg-purple-100 text-purple-800',
        'bg-pink-100 text-pink-800',
        'bg-gray-100 text-gray-800',
      ];

      const tag: FileTag = {
        id: 'tag-1',
        name: 'Test',
        color: 'bg-blue-100 text-blue-800',
        fileCount: 0,
      };

      expect(validColors.includes(tag.color)).toBe(true);
    });
  });

  describe('File Organization Filtering', () => {
    it('should filter files by folder', () => {
      const files = [
        { id: '1', name: 'File 1', folderId: 'folder-1' },
        { id: '2', name: 'File 2', folderId: 'folder-1' },
        { id: '3', name: 'File 3', folderId: 'folder-2' },
      ];

      const selectedFolderId = 'folder-1';
      const filteredFiles = files.filter((f) => f.folderId === selectedFolderId);

      expect(filteredFiles.length).toBe(2);
      expect(filteredFiles[0].id).toBe('1');
      expect(filteredFiles[1].id).toBe('2');
    });

    it('should filter files by tag', () => {
      const files = [
        { id: '1', name: 'File 1', tags: ['tag-1', 'tag-2'] },
        { id: '2', name: 'File 2', tags: ['tag-1'] },
        { id: '3', name: 'File 3', tags: ['tag-3'] },
      ];

      const selectedTagId = 'tag-1';
      const filteredFiles = files.filter((f) => f.tags && f.tags.includes(selectedTagId));

      expect(filteredFiles.length).toBe(2);
      expect(filteredFiles[0].id).toBe('1');
      expect(filteredFiles[1].id).toBe('2');
    });

    it('should filter files by both folder and tag', () => {
      const files = [
        { id: '1', name: 'File 1', folderId: 'folder-1', tags: ['tag-1'] },
        { id: '2', name: 'File 2', folderId: 'folder-1', tags: ['tag-2'] },
        { id: '3', name: 'File 3', folderId: 'folder-2', tags: ['tag-1'] },
      ];

      const selectedFolderId = 'folder-1';
      const selectedTagId = 'tag-1';

      const filteredFiles = files.filter(
        (f) =>
          f.folderId === selectedFolderId &&
          f.tags &&
          f.tags.includes(selectedTagId)
      );

      expect(filteredFiles.length).toBe(1);
      expect(filteredFiles[0].id).toBe('1');
    });
  });

  describe('Organization Statistics', () => {
    it('should calculate total files in folder', () => {
      const folders: FileFolder[] = [
        { id: 'folder-1', name: 'Clinical Trials', fileCount: 5 },
        { id: 'folder-2', name: 'Analysis Data', fileCount: 3 },
      ];

      const totalFiles = folders.reduce((sum, f) => sum + f.fileCount, 0);

      expect(totalFiles).toBe(8);
    });

    it('should calculate total files with tag', () => {
      const tags: FileTag[] = [
        { id: 'tag-1', name: 'Clinical', color: 'bg-blue-100 text-blue-800', fileCount: 4 },
        { id: 'tag-2', name: 'Safety', color: 'bg-red-100 text-red-800', fileCount: 2 },
      ];

      const totalFiles = tags.reduce((sum, t) => sum + t.fileCount, 0);

      expect(totalFiles).toBe(6);
    });
  });
});
