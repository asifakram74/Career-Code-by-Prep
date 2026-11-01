/**
 * Navigation History Manager for Hierarchical Mobile & Browser Navigation.
 * 
 * Hierarchy:
 * - Level 0: Root Dashboard (Student Dashboard, Admin Analytics, or Super Overview)
 *   Back button at Level 0 -> Exits the application (no internal traps).
 * - Level 1: Sub-Tabs (New Query, Chats, History, Profile, etc.)
 *   Back button at Level 1 -> Returns directly to Level 0 (Root Dashboard).
 * - Level 2: Chat Conversation or Full Modals
 *   Back button at Level 2 -> Closes the chat/modal and returns to Level 1.
 * 
 * Guarantees:
 * 1. No circular tab history (switching between Level 1 tabs replaces history).
 * 2. Navigating to Root Dashboard pops back to Level 0, leaving no lingering states.
 * 3. Chat -> Back -> Chats list -> Back -> Dashboard -> Back -> Exit App.
 */

export interface NavState {
  level: 0 | 1 | 2;
  type: 'root' | 'tab' | 'chat' | 'modal' | 'drive_folder';
  tab: string;
  ticketId?: string;
  modalId?: string;
  driveFolderId?: string;
  driveFolderName?: string;
  driveBreadcrumbs?: { id: string; name: string }[];
  driveDepth?: number;
}

export const navigationHistory = {
  getState(): NavState | null {
    if (typeof window === 'undefined' || !window.history?.state) return null;
    return window.history.state as NavState;
  },

  getCurrentLevel(): number {
    const s = this.getState();
    return typeof s?.level === 'number' ? s.level : 0;
  },

  /**
   * Initializes Root Dashboard at Level 0 without pushing extra entries.
   */
  initRoot(rootTab: string): void {
    if (typeof window === 'undefined' || !window.history) return;
    const current = this.getState();
    if (!current || typeof current.level !== 'number') {
      try {
        window.history.replaceState({ level: 0, type: 'root', tab: rootTab }, '');
      } catch (e) {
        console.warn('[navigationHistory] initRoot failed:', e);
      }
    }
  },

  /**
   * Transitions to a tab hierarchically.
   * - If navigating to Root Dashboard: pops back down to Level 0.
   * - If navigating to a Sub-Tab from Root: pushes Level 1.
   * - If navigating between Sub-Tabs: replaces Level 1 (does not stack sibling tabs).
   */
  goToTab(targetTab: string, rootTab: string): void {
    if (typeof window === 'undefined' || !window.history) return;
    const current = this.getState();
    const currentLevel = typeof current?.level === 'number' ? current.level : 0;

    // Case 1: Target is Root Dashboard
    if (targetTab === rootTab) {
      try {
        window.history.replaceState({ level: 0, type: 'root', tab: rootTab }, '');
      } catch {}
      return;
    }

    // Case 2: Target is a Sub-Tab (Level 1)
    if (currentLevel === 0) {
      try {
        window.history.pushState({ level: 1, type: 'tab', tab: targetTab }, '');
      } catch {
        window.history.replaceState({ level: 1, type: 'tab', tab: targetTab }, '');
      }
    } else {
      // Sibling tab switch or switching from sub-levels: directly replace state
      // Avoids asynchronous popstate collisions that prematurely reverted to drive home
      try {
        window.history.replaceState({ level: 1, type: 'tab', tab: targetTab }, '');
      } catch {}
    }
  },

  /**
   * Opens a Chat conversation at Level 2.
   * Ensures that pressing Back will return to the Chats section (Level 1),
   * and a subsequent Back will return to Dashboard (Level 0).
   */
  openChat(ticketId: string, chatsTab: string, rootTab: string): void {
    if (typeof window === 'undefined' || !window.history) return;
    const current = this.getState();
    const currentLevel = typeof current?.level === 'number' ? current.level : 0;

    if (currentLevel === 0) {
      try {
        window.history.pushState({ level: 1, type: 'tab', tab: chatsTab }, '');
        window.history.pushState({ level: 2, type: 'chat', ticketId, tab: chatsTab }, '');
      } catch {
        window.history.replaceState({ level: 2, type: 'chat', ticketId, tab: chatsTab }, '');
      }
    } else if (currentLevel === 1) {
      try {
        window.history.pushState({ level: 2, type: 'chat', ticketId, tab: chatsTab }, '');
      } catch {
        window.history.replaceState({ level: 2, type: 'chat', ticketId, tab: chatsTab }, '');
      }
    } else if (currentLevel === 2) {
      try {
        window.history.replaceState({ level: 2, type: 'chat', ticketId, tab: chatsTab }, '');
      } catch {}
    }
  },

  /**
   * Closes the active chat / Level 2 view by popping back to Level 1.
   */
  closeChat(): void {
    if (typeof window === 'undefined' || !window.history) return;
    const current = this.getState();
    if (current?.level === 2 || current?.type === 'chat') {
      try {
        window.history.back();
      } catch {}
    }
  },

  /**
   * Standard back method.
   */
  back(): void {
    if (typeof window === 'undefined' || !window.history) return;
    try {
      window.history.back();
    } catch {}
  },
};
