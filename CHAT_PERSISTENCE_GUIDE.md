# Chat Persistence & Session Management Guide

## Overview

The chat persistence system ensures that biostatistics chat conversations are never lost, even when users experience logouts, page reloads, or network interruptions. Each tab maintains independent chat history while sharing session state across multiple browser tabs.

**Key Features:**
- **Persistent Storage:** IndexedDB with localStorage fallback
- **Session-Aware:** Auto-save/restore keyed by session ID
- **Multi-Tab Support:** Independent chat per tab, synchronized sessions
- **Graceful Logout:** Automatic save before logout
- **Session Refresh:** Seamless refresh without data loss
- **Activity Tracking:** Integrated with session timeout system
- **Cross-Browser:** Works on Chrome, Firefox, Safari, Edge

---

## Architecture

### 1. Persistent Storage Service (`client/src/lib/persistentStorage.ts`)

Provides abstraction over IndexedDB with localStorage fallback.

**Features:**
- IndexedDB for large data (primary)
- localStorage for fallback (secondary)
- Session ID keying for multi-user support
- TTL (time-to-live) for automatic cleanup
- Compression for large payloads
- Error handling and recovery

**Usage:**
```typescript
import { getPersistentStorage } from '@/lib/persistentStorage';

const storage = await getPersistentStorage({
  sessionId: 'user-123',
  debugMode: false,
});

// Save chat session
await storage.saveChatSession('tab-456', {
  tabId: 'tab-456',
  chatMessages: [...],
  uploadedData: {...},
  fullData: [...],
  conversationHistory: [...],
});

// Load chat session
const session = await storage.loadChatSession('tab-456');

// Delete chat session
await storage.deleteChatSession('tab-456');

// Get storage stats
const stats = await storage.getStats();
```

### 2. Session-Aware Storage Manager (`client/src/lib/sessionAwareStorage.ts`)

Manages auto-save/restore with session lifecycle integration.

**Features:**
- Auto-save at configurable intervals (default 5 seconds)
- Debounced saves to prevent excessive writes
- Restore on mount
- Session refresh/logout detection
- Graceful cleanup
- Network status awareness

**Usage:**
```typescript
import { getSessionAwareStorageManager } from '@/lib/sessionAwareStorage';

const manager = getSessionAwareStorageManager({
  sessionId: 'user-123',
  tabId: 'tab-456',
  autoSaveIntervalMs: 5000,
  debugMode: false,
});

// Initialize and restore state
const restoredState = await manager.initialize();

// Mark changes for auto-save
manager.markDirty({
  chatMessages: [...],
  uploadedData: {...},
});

// Force immediate save
await manager.forceSave({
  chatMessages: [...],
  uploadedData: {...},
  fullData: [...],
  conversationHistory: [...],
});

// Handle session events
await manager.onSessionRefresh();
await manager.onLogout();

// Get stats
const stats = await manager.getStats();
```

### 3. Multi-Tab Synchronization (`client/src/lib/multiTabSync.ts`)

Synchronizes session state across browser tabs while isolating chat data.

**Features:**
- BroadcastChannel API (primary)
- localStorage events fallback (secondary)
- Session state broadcasting
- Logout detection across tabs
- Tab lifecycle management
- Listener pattern for events

**Usage:**
```typescript
import { getMultiTabSync } from '@/lib/multiTabSync';

const sync = await getMultiTabSync({
  sessionId: 'user-123',
  tabId: 'tab-456',
  debugMode: false,
});

// Broadcast session update
sync.broadcastSessionUpdate({ userId: 'user-123' });

// Broadcast logout
sync.broadcastSessionLogout();

// Broadcast refresh
sync.broadcastSessionRefresh();

// Listen for events
sync.onBroadcast('session-logout', (broadcast) => {
  console.log('Another tab logged out');
});

sync.onBroadcast('session-refresh', (broadcast) => {
  console.log('Another tab refreshed session');
});

// Get stats
const stats = sync.getStats();
```

### 4. Session Event Handlers (`client/src/lib/useSessionEvents.ts`)

React hook for managing session lifecycle events.

**Features:**
- Logout detection and handling
- Session refresh detection
- Tab close detection
- Remote logout/refresh from other tabs
- Automatic cleanup
- Integration with storage manager and multi-tab sync

**Usage:**
```typescript
import { useSessionEvents } from '@/lib/useSessionEvents';

useSessionEvents({
  sessionId: 'user-123',
  tabId: 'tab-456',
  onLogout: async () => {
    console.log('Logged out');
  },
  onSessionRefresh: async () => {
    console.log('Session refreshed');
  },
  onTabClose: async () => {
    console.log('Tab closing');
  },
  onRemoteLogout: () => {
    console.log('Another tab logged out');
  },
  onRemoteSessionRefresh: () => {
    console.log('Another tab refreshed session');
  },
  debugMode: false,
});
```

### 5. Updated Chat Component (`client/src/components/biostat/AIBiostatisticsChatTabIntegrated.tsx`)

Integrates all persistence features into the chat component.

**Features:**
- Auto-restore chat on mount
- Auto-save on every message
- Session event integration
- Graceful error handling
- Loading states during restore
- User-friendly messages

---

## Integration Guide

### Step 1: Update Your Chat Component

The `AIBiostatisticsChatTabIntegrated` component is already fully integrated. Replace any references to `AIBiostatisticsChat`:

```typescript
// Before
import { AIBiostatisticsChat } from './AIBiostatisticsChat';

// After
import { AIBiostatisticsChatTabIntegrated } from './AIBiostatisticsChatTabIntegrated';
```

### Step 2: Ensure Session Management is Active

The component automatically uses the session from `useAuth()`:

```typescript
const { user, isAuthenticated } = useAuth();
const sessionId = String(user?.id || 'anonymous');
```

### Step 3: Configure Timeout Integration

The chat component integrates with the session timeout system:

```typescript
useSessionEvents({
  sessionId,
  tabId: activeTabId || 'default',
  onLogout: async () => {
    // Save final state before logout
  },
  onSessionRefresh: async () => {
    // Save state before refresh
  },
});
```

---

## Data Flow

### On Page Load
1. Component mounts
2. `useSessionEvents` initializes multi-tab sync
3. `SessionAwareStorageManager` restores chat state from storage
4. Chat messages are displayed
5. Auto-save timer starts

### On User Message
1. Message added to chat
2. `markDirty()` called with changes
3. Auto-save timer scheduled (debounced)
4. After debounce interval, `forceSave()` called
5. Data saved to IndexedDB/localStorage

### On Session Refresh
1. `useSessionEvents` detects refresh
2. `onSessionRefresh()` callback triggered
3. `forceSave()` called to save pending changes
4. Session continues with preserved chat

### On Logout
1. `useSessionEvents` detects logout
2. `onLogout()` callback triggered
3. `forceSave()` called to save final state
4. Storage manager cleaned up
5. Multi-tab sync notifies other tabs

### On Page Reload
1. Component mounts
2. `SessionAwareStorageManager.initialize()` called
3. Previous chat state loaded from storage
4. Chat history restored and displayed
5. User can continue conversation

### On Multi-Tab Logout
1. Tab A logs out
2. `broadcastSessionLogout()` called
3. Tab B receives broadcast via BroadcastChannel/storage events
4. `onRemoteLogout()` callback triggered in Tab B
5. Tab B can respond (e.g., show notification)

---

## Configuration

### Auto-Save Interval
Default: 5 seconds

```typescript
const manager = getSessionAwareStorageManager({
  sessionId,
  tabId,
  autoSaveIntervalMs: 10000, // 10 seconds
});
```

### Session TTL
Default: 7 days

```typescript
const storage = await getPersistentStorage({
  sessionId,
  ttlMs: 24 * 60 * 60 * 1000, // 1 day
});
```

### Debug Mode
Enable console logging:

```typescript
const manager = getSessionAwareStorageManager({
  sessionId,
  tabId,
  debugMode: true,
});
```

---

## Testing

### Run Tests
```bash
pnpm test chatPersistence
```

### Test Coverage
- ✅ 48 comprehensive tests
- ✅ Persistent storage tests (8 tests)
- ✅ Session-aware storage tests (10 tests)
- ✅ Multi-tab synchronization tests (10 tests)
- ✅ Session event handlers tests (8 tests)
- ✅ Multi-tab chat isolation tests (5 tests)
- ✅ Session stability tests (7 tests)

### Test Results
```
✓ server/chatPersistence.test.ts (48 tests) 30ms
Test Files  1 passed (1)
     Tests  48 passed (48)
```

---

## Troubleshooting

### Chat History Not Restoring

**Check:**
1. Verify `isAuthenticated` is true
2. Check browser DevTools > Application > IndexedDB/LocalStorage
3. Enable debug mode: `debugMode: true`
4. Check browser console for errors

**Debug:**
```typescript
const manager = getSessionAwareStorageManager({
  sessionId,
  tabId,
  debugMode: true,
});

const stats = await manager.getStats();
console.log('Storage stats:', stats);
```

### Auto-Save Not Working

**Check:**
1. Verify network is online
2. Check auto-save interval configuration
3. Verify `markDirty()` is called
4. Check storage quota

**Debug:**
```typescript
manager.markDirty({ chatMessages: [...] });
const stats = await manager.getStats();
console.log('Has pending changes:', stats.hasPendingChanges);
```

### Multi-Tab Sync Not Working

**Check:**
1. Verify BroadcastChannel is supported (Chrome 54+, Firefox 38+, Safari 15.4+)
2. Check if localStorage fallback is working
3. Verify tabs are on same domain
4. Check browser console for errors

**Debug:**
```typescript
const sync = await getMultiTabSync({ sessionId, tabId, debugMode: true });
const stats = sync.getStats();
console.log('Sync method:', stats.syncMethod); // 'broadcastchannel' or 'storage'
```

### Storage Quota Exceeded

**Solution:**
1. Cleanup old sessions: `storage.cleanupOldSessions()`
2. Clear specific tab: `manager.clearChatData()`
3. Clear all sessions: `manager.clearAllChatData()`
4. Increase TTL to cleanup faster

---

## Browser Compatibility

| Browser | IndexedDB | BroadcastChannel | localStorage |
|---------|-----------|------------------|--------------|
| Chrome  | ✅ 24+   | ✅ 54+           | ✅ All       |
| Firefox | ✅ 16+   | ✅ 38+           | ✅ All       |
| Safari  | ✅ 10+   | ✅ 15.4+         | ✅ All       |
| Edge    | ✅ 12+   | ✅ 79+           | ✅ All       |

**Fallback Strategy:**
- IndexedDB not available → Use localStorage
- BroadcastChannel not available → Use storage events
- Both unavailable → Single-tab mode (no cross-tab sync)

---

## Performance Optimization

### Debounced Auto-Save
Saves are debounced to prevent excessive writes:
```typescript
// Multiple changes within 5 seconds = 1 save
markDirty({ chatMessages: [...] });
markDirty({ uploadedData: {...} });
markDirty({ conversationHistory: [...] });
// Only one save after 5 seconds
```

### Compression
Large payloads are compressed using JSON stringification:
```typescript
// Threshold: 10KB
const compressed = JSON.stringify(largeData);
```

### Lazy Loading
Chat state is only restored when needed:
```typescript
// Restored on mount
const restoredState = await manager.initialize();
```

### Memory Management
Old sessions are automatically cleaned up:
```typescript
// Default TTL: 7 days
await storage.cleanupOldSessions();
```

---

## Security Considerations

1. **HttpOnly Cookies:** Session ID stored in HttpOnly cookies (not accessible via JavaScript)
2. **Secure Flag:** Cookies only transmitted over HTTPS
3. **SameSite=None:** Allows cross-domain requests with credentials
4. **No Sensitive Data:** Only chat messages and metadata stored locally
5. **Session Validation:** Server validates session on every request

---

## Analytics & Monitoring

### Track Storage Stats
```typescript
const stats = await manager.getStats();
console.log({
  sessionId: stats.sessionId,
  tabId: stats.tabId,
  lastSaveTime: new Date(stats.lastSaveTime),
  hasPendingChanges: stats.hasPendingChanges,
  isOnline: stats.isOnline,
  storageType: stats.storageStats?.storageType,
  sessionCount: stats.storageStats?.sessionCount,
  totalSize: stats.storageStats?.totalSize,
});
```

### Monitor Sync Events
```typescript
sync.onBroadcast('session-logout', (broadcast) => {
  // Log logout event
  analytics.track('session_logout_detected', {
    tabId: broadcast.tabId,
    timestamp: broadcast.timestamp,
  });
});
```

---

## Next Steps

1. **Monitor Session Events:** Track extension rates and timeout patterns
2. **Optimize Timeouts:** Adjust based on user behavior
3. **Add Analytics:** Integrate with your analytics platform
4. **User Education:** Inform users about session timeout feature
5. **Mobile Testing:** Test on iOS Safari and Chrome Mobile

---

## Support

For issues or questions:
1. Check troubleshooting section above
2. Enable debug mode for detailed logging
3. Review test cases for usage examples
4. Check browser console for error messages

---

## Version History

- **v1.0.0** - Initial release with persistent storage, session-aware management, and multi-tab synchronization
