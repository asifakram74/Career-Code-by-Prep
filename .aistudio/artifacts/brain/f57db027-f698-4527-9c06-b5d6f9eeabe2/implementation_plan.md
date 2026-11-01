# Implementation Plan: Career Code Google Drive Resource Explorer

## 1. Overview & User Goals
Career Code maintains a centralized Google Drive containing academic and professional career guidance assets structured into field-specific folders, subfolders, PDFs, image guides, and voice note recordings.
The goal is to seamlessly integrate this Google Drive into the Career Code platform as a dedicated **Drive** section/tab for students and counselors:
- **Folder Tree & Field Navigation:** Replicate the Google Drive folder hierarchy (e.g. CA/ACCA, CS/IT, Engineering, MDCAT, Admissions, General Guidance) with breadcrumb navigation.
- **In-App Previews:** Preview PDF documents, play voice note recordings, and view infographics directly in the app without forcing downloads.
- **Direct Drive Access:** Provide a prominent **"Open in Google Drive"** button on each file and folder for native Google Drive viewing.
- **Automatic & Real-Time Sync:** Support dynamic synchronization via root Google Drive Folder ID, so updates made on Drive immediately reflect in Career Code without manual link editing.
- **Admin Configuration:** Super Admin can paste or update the Career Code Google Drive Root Folder link/ID and trigger instant sync from the management console.

---

## 2. Architecture & Technical Strategy

### A. Google Drive Access Strategy
Since the user confirmed the Career Code Google Drive folder is **Publicly Shared ("Anyone with the link can view")**:
1. **Public Drive API / Proxy Route:**
   - Client can fetch folder children (subfolders and files) via Google Drive API v3 (`files.list` with query `'<folderId>' in parents and trashed = false`).
   - Supports file metadata (name, mimeType, iconLink, webViewLink, webContentLink, size, thumbnailLink).
2. **Server-Side Proxy (`/api/drive/folders/:folderId`):**
   - Keeps API calls secure, handles rate limits, caching (5-minute in-memory cache to prevent redundant quota usage), and supports instant manual force-refresh.
   - Fallback structure provided if network or API key is unconfigured, ensuring the Drive Explorer is never blank.
3. **Configuration Storage in Firestore (`/settings/drive_config`):**
   - Stores `rootFolderId`, `rootFolderName`, `lastSyncedAt`, and `syncStatus`.
   - Super Admin can change the root folder ID at any time.

---

## 3. User Experience & Component Design

### A. Navigation Integration
- Add **"Drive"** to the primary navigation:
  - **Sidebar (Desktop):** Folder / Drive icon in the navigation menu.
  - **Bottom Navigation (Mobile):** "Drive" tab alongside Dashboard, New Query, Chats, and More.
  - Fully integrated with the browser history stack (`navigationHistory.ts`) so pressing "Back" navigates up one folder level before returning to the dashboard.

### B. Drive Explorer Interface (`DriveExplorer.tsx`)
1. **Top Header & Search:**
   - Search bar with live filtering across all loaded folders and files.
   - Breadcrumb navigation trail (`Drive > Engineering > Semester 1 > Syllabus.pdf`) with one-click jump to any parent level.
   - Sync status indicator with a manual **Refresh / Sync** button.
2. **Category / Discipline Quick Filters:**
   - Quick jump chips for primary disciplines (CA/ACCA, Medical, Engineering, CS/IT, Scholarships, General).
3. **Folder & File Grid / List View:**
   - **Folder Cards:** Distinctive folder icons with file counts and last modified time.
   - **File Items:** Color-coded badges by MIME type:
     - 📕 **PDF Documents:** Page count badge, file size, direct preview trigger.
     - 🎤 **Voice Notes / Audio:** Waveform icon, duration, instant audio player.
     - 🖼️ **Images / Infographics:** Visual thumbnail preview, dimension details.
     - 📁 **Subfolders:** Arrow indicator with subfolder count.
4. **File Action Menu:**
   - **"Preview"** (opens in-app modal).
   - **"Open in Google Drive"** (opens native Google Drive file viewer in a new tab).
   - **"Copy Link"** (copies direct shareable Drive link to clipboard).

### C. In-App File Viewer Modal (`DriveFilePreviewModal.tsx`)
- **PDF Viewer:** Embedded high-resolution Google Docs / Drive PDF viewer frame with zoom and page controls.
- **Audio Voice Note Player:** Sleek playback bar with timeline seeker, speed multiplier (1x, 1.5x, 2x), and volume control.
- **Image Previewer:** Responsive full-screen lightbox with pan and zoom.
- Floating action buttons: "Open in Drive" and "Download".

### D. Super Admin Drive Management (`SuperAdminDriveConfig.tsx`)
- Inside Super Admin settings:
  - Input field for Google Drive Root Folder URL or Folder ID.
  - Test connection button to validate folder accessibility.
  - One-click "Sync Entire Drive" button.

---

## 4. Implementation Steps

1. **Backend Proxy & Utilities:**
   - Add `/api/drive/browse` and `/api/drive/config` routes in `server.ts` or `src/lib/driveService.ts` to query Google Drive folder contents with caching.
   - Add Firestore settings document for Drive root configuration.
2. **Components Creation:**
   - `src/components/drive/DriveExplorer.tsx`: Main explorer with breadcrumbs, search, folder grid, and file list.
   - `src/components/drive/DriveFilePreviewModal.tsx`: In-app preview modal for PDFs, audio voice notes, and images.
   - `src/components/drive/SuperAdminDriveModal.tsx`: Admin folder configuration interface.
3. **Navigation Integration:**
   - Update `src/components/common/Sidebar.tsx` and `src/components/common/BottomNav.tsx` to include the Drive section.
   - Update `src/App.tsx` tab routing and navigation history stack.
4. **Verification & Edge Cases:**
   - Verify folder nesting and breadcrumb backtracking with mobile hardware back button.
   - Verify file preview responsiveness on mobile screens.
   - Verify error states when Drive folder ID is pending or empty.

---

## 5. Verification Plan
- [ ] Verify Drive tab is accessible from desktop sidebar and mobile bottom nav.
- [ ] Verify clicking folders drills down and breadcrumbs update accurately.
- [ ] Verify browser back button steps back through folder breadcrumbs cleanly.
- [ ] Verify PDF documents open in the preview modal with an "Open in Drive" button.
- [ ] Verify audio voice notes play cleanly.
- [ ] Verify Super Admin can update the Google Drive folder link/ID.
