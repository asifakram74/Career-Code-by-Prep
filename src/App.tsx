import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { AuthPage } from './components/auth/AuthPage';
import { LandingPage } from './components/landing/LandingPage';
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';
import { BottomNav } from './components/common/BottomNav';
import { StudentDashboard } from './components/student/StudentDashboard';
import { NewQueryForm } from './components/student/NewQueryForm';
import { RepliesSection } from './components/student/RepliesSection';
import { HistorySection } from './components/student/HistorySection';
import { SavedAnswersSection } from './components/student/SavedAnswersSection';
import { NormalAdminDashboard } from './components/admin/NormalAdminDashboard';
import { AdminAnalyticsDashboard } from './components/admin/AdminAnalyticsDashboard';
import { SuperAdminDashboard } from './components/admin/SuperAdminDashboard';
import { AdminManagement } from './components/admin/AdminManagement';
import { StudentManagement } from './components/admin/StudentManagement';
import { CategoryManagement } from './components/admin/CategoryManagement';
import { AllQueriesDirectory } from './components/admin/AllQueriesDirectory';
import { AuditLogsSection } from './components/admin/AuditLogsSection';
import { UserProfileSection } from './components/common/UserProfileSection';
import { NotificationsPage } from './components/common/NotificationsPage';
import { ConversationView } from './components/common/ConversationView';
import { DriveExplorer } from './components/drive/DriveExplorer';
import { ArticlesSection } from './components/articles/ArticlesSection';
import { ReviewsAnalyticsDashboard } from './components/admin/ReviewsAnalyticsDashboard';
import { CareerCodeLogo } from './components/common/CareerCodeLogo';
import { QuotaNoticeBanner } from './components/common/QuotaNoticeBanner';
import { QueryTicket } from './types';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { navigationHistory, NavState } from './lib/navigationHistory';

function MainApp() {
  const { currentUser, userProfile, loading } = useAuth();
  const { markNotificationsForQueryAsRead } = useNotifications();
  const [currentTab, setCurrentTab] = useState<string>('');
  const [activeTicket, setActiveTicket] = useState<QueryTicket | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);
  const [viewLanding, setViewLanding] = useState(false);

  // Set default initial tab and chats tab based on role
  const role = userProfile?.role;
  const getDefaultTab = (r?: string) => {
    if (r === 'student') return 'dashboard';
    if (r === 'normal_admin') return 'admin-dashboard';
    return 'super-overview';
  };
  const getChatsTab = (r?: string) => {
    if (r === 'student') return 'replies';
    if (r === 'normal_admin') return 'assigned-queries';
    return 'all-queries';
  };
  const rootTab = getDefaultTab(role);
  const effectiveTab = currentTab || rootTab;

  const handleNavigateTab = (tab: string) => {
    setActiveTicket(null);
    if (tab === effectiveTab && !activeTicket) return;
    setCurrentTab(tab);
    navigationHistory.goToTab(tab, rootTab);
  };

  const handleOpenTicket = (ticket: QueryTicket) => {
    markNotificationsForQueryAsRead(ticket.id);
    const chatsTab = getChatsTab(role);
    setCurrentTab(chatsTab);
    setActiveTicket(ticket);
    navigationHistory.openChat(ticket.id, chatsTab, rootTab);
  };

  const handleCloseTicket = () => {
    setActiveTicket(null);
    navigationHistory.closeChat();
  };

  const handleSetAuthMode = (mode: 'login' | 'register' | null) => {
    setAuthMode(mode);
    if (mode !== null) {
      if (typeof window !== 'undefined') {
        window.history.pushState({ level: 1, type: 'modal', modalId: `auth_${mode}` }, '');
      }
    }
  };

  const handleViewLanding = (view: boolean) => {
    setViewLanding(view);
    if (view) {
      if (typeof window !== 'undefined') {
        window.history.pushState({ level: 1, type: 'modal', modalId: 'landing' }, '');
      }
    }
  };

  // Initialize Root Dashboard at Level 0 on load
  useEffect(() => {
    if (typeof window !== 'undefined' && userProfile) {
      navigationHistory.initRoot(rootTab);
    }
  }, [userProfile, rootTab]);

  // Global browser back button / popstate event listener
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      // 1. If chat activeTicket is open, close it
      if (activeTicket) {
        setActiveTicket(null);
      }
      // Broadcast to any subcomponents (RepliesSection, etc.) to close their chats
      window.dispatchEvent(new CustomEvent('app:close-chat'));

      // 2. If viewing landing page while authenticated, close it
      if (viewLanding) {
        setViewLanding(false);
        return;
      }
      // 3. If login/register screen is open, close back to landing
      if (authMode !== null) {
        setAuthMode(null);
        return;
      }

      // 4. Tab navigation back
      const state = e.state as NavState | null;
      if (state && typeof state.level === 'number') {
        if (state.level === 0) {
          // Returned to Root Dashboard
          setCurrentTab(rootTab);
        } else if (state.level === 1 && state.tab) {
          // Returned to Sub-Tab
          setCurrentTab(state.tab);
        } else if (state.level === 2 && state.tab) {
          // Sub-level (Drive subfolder, active chat, etc.) - keep active tab in sync
          setCurrentTab(state.tab);
        }
      } else if (!state) {
        // Popped to base (root dashboard)
        setCurrentTab(rootTab);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTicket, viewLanding, authMode, rootTab]);

  // Handle push notification clicks (from both system notification clicks and in-app toasts)
  useEffect(() => {
    const handleOpenQueryEvent = async (e: Event) => {
      const customEvent = e as CustomEvent<{ queryId?: string }>;
      const qId = customEvent.detail?.queryId;
      if (!qId) return;
      markNotificationsForQueryAsRead(qId);

      try {
        const docRef = doc(db, 'queries', qId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          handleOpenTicket({ id: docSnap.id, ...docSnap.data() } as QueryTicket);
        } else {
          handleNavigateTab(userProfile?.role === 'student' ? 'replies' : 'personal-queries');
        }
      } catch {
        handleNavigateTab(userProfile?.role === 'student' ? 'replies' : 'personal-queries');
      }
    };

    window.addEventListener('app:open-query-notification', handleOpenQueryEvent);
    (window as any).__onPushNotificationClick = (queryId: string) => {
      window.dispatchEvent(
        new CustomEvent('app:open-query-notification', { detail: { queryId } })
      );
    };

    return () => {
      window.removeEventListener('app:open-query-notification', handleOpenQueryEvent);
      delete (window as any).__onPushNotificationClick;
    };
  }, [userProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50/30 flex flex-col items-center justify-center p-4">
        <CareerCodeLogo size="xl" className="animate-pulse mb-3 shadow-md" />
        <p className="text-sm font-bold text-slate-800">Career Code by Prep Titans</p>
        <p className="text-xs text-slate-400 mt-1">Connecting to secure guidance network...</p>
      </div>
    );
  }

  // Unauthenticated visitors: show public landing page by default
  // When they click Sign In or Get Started, open AuthPage in the corresponding mode.
  if (!userProfile) {
    if (authMode !== null) {
      return (
        <div className="animate-fade-up min-h-screen">
          <AuthPage
            initialMode={authMode}
            onBackToLanding={() => setAuthMode(null)}
            onSuccessRole={(newRole) => {
              setAuthMode(null);
              if (newRole === 'student') setCurrentTab('dashboard');
              else if (newRole === 'normal_admin') setCurrentTab('admin-dashboard');
              else setCurrentTab('super-overview');
            }}
          />
        </div>
      );
    }

    return (
      <div className="animate-fade-in min-h-screen">
        <QuotaNoticeBanner />
        <LandingPage
          onSignIn={() => handleSetAuthMode('login')}
          onGetStarted={() => handleSetAuthMode('register')}
        />
      </div>
    );
  }

  // Authenticated visitors who explicitly choose to browse the public landing page
  if (viewLanding) {
    return (
      <div className="animate-fade-in min-h-screen">
        <QuotaNoticeBanner />
        <LandingPage
          onSignIn={() => setViewLanding(false)}
          onGetStarted={() => setViewLanding(false)}
          onGoToDashboard={() => setViewLanding(false)}
        />
      </div>
    );
  }

  const renderContent = () => {
    // If a specific ticket was opened directly from a dashboard card
    if (activeTicket) {
      return (
        <div className="fixed inset-0 z-50 xl:relative xl:inset-auto xl:z-auto h-[100dvh] xl:h-[calc(100vh-140px)] xl:min-h-[600px] xl:max-w-5xl xl:mx-auto bg-[#efeae2] xl:bg-white xl:rounded-2xl xl:shadow-sm xl:border xl:border-slate-300 overflow-hidden flex flex-col animate-slide-in-right shadow-2xl">
          <ConversationView
            ticket={activeTicket}
            onClose={handleCloseTicket}
            onUpdateTicketStatus={async (newStatus) => {
              const ref = doc(db, 'queries', activeTicket.id);
              const updates: any = { status: newStatus, updatedAt: Date.now() };
              if (newStatus === 'resolved') {
                updates.rating = null;
                updates.ratingFeedback = '';
                updates.ratingTags = [];
                updates.ratedAt = null;
              }
              await updateDoc(ref, updates);
              setActiveTicket((prev) => (prev ? { ...prev, ...updates } : null));
            }}
          />
        </div>
      );
    }

    // STUDENT VIEWS
    if (role === 'student') {
      switch (effectiveTab) {
        case 'dashboard':
          return (
            <StudentDashboard
              onNavigateTab={handleNavigateTab}
              onOpenTicket={handleOpenTicket}
            />
          );
        case 'new-query':
          return (
            <NewQueryForm
              onSuccessTicket={(ticket) => {
                handleOpenTicket(ticket);
              }}
              onCancel={() => handleNavigateTab('dashboard')}
            />
          );
        case 'replies':
          return <RepliesSection />;
        case 'history':
          return (
            <HistorySection
              onOpenTicket={handleOpenTicket}
              onNavigateTab={handleNavigateTab}
            />
          );
        case 'saved-answers':
          return <SavedAnswersSection onOpenQueryDetail={() => handleNavigateTab('replies')} />;
        case 'drive':
          return <DriveExplorer />;
        case 'articles':
          return <ArticlesSection onNavigateTab={handleNavigateTab} />;
        case 'reviews-analytics':
          return (
            <ReviewsAnalyticsDashboard
              onOpenTicket={undefined}
              onNavigateTab={handleNavigateTab}
            />
          );
        case 'profile':
          return <UserProfileSection />;
        case 'notifications':
          return <NotificationsPage onOpenQuery={() => handleNavigateTab('replies')} />;
        default:
          return (
            <StudentDashboard
              onNavigateTab={handleNavigateTab}
              onOpenTicket={handleOpenTicket}
            />
          );
      }
    }

    // NORMAL ADMIN VIEWS
    if (role === 'normal_admin') {
      switch (effectiveTab) {
        case 'admin-dashboard':
          return (
            <AdminAnalyticsDashboard
              onNavigateTab={handleNavigateTab}
              onOpenTicket={handleOpenTicket}
            />
          );
        case 'new-queries':
        case 'pending-replies':
        case 'replied-queries':
        case 'assigned-queries':
        case 'admin-history':
          return (
            <NormalAdminDashboard
              currentTab={effectiveTab}
              onNavigateTab={handleNavigateTab}
            />
          );
        case 'drive':
          return <DriveExplorer />;
        case 'articles':
          return <ArticlesSection onNavigateTab={handleNavigateTab} />;
        case 'reviews-analytics':
          return (
            <ReviewsAnalyticsDashboard
              onOpenTicket={handleOpenTicket}
              onNavigateTab={handleNavigateTab}
            />
          );
        case 'profile':
          return <UserProfileSection />;
        case 'notifications':
          return <NotificationsPage onOpenQuery={() => handleNavigateTab('assigned-queries')} />;
        default:
          return (
            <AdminAnalyticsDashboard
              onNavigateTab={handleNavigateTab}
              onOpenTicket={handleOpenTicket}
            />
          );
      }
    }

    // SUPER ADMIN & EXPERT ADMIN VIEWS
    switch (effectiveTab) {
      case 'super-overview':
        return (
          <SuperAdminDashboard
            onNavigateTab={handleNavigateTab}
            onOpenTicket={handleOpenTicket}
          />
        );
      case 'mentor-dashboard':
      case 'admin-dashboard':
        return (
          <AdminAnalyticsDashboard
            onNavigateTab={handleNavigateTab}
            onOpenTicket={handleOpenTicket}
          />
        );
      case 'all-queries':
        return <AllQueriesDirectory />;
      case 'admin-management':
        return <AdminManagement />;
      case 'student-management':
        return <StudentManagement />;
      case 'category-management':
        return <CategoryManagement />;
      case 'reviews-analytics':
        return (
          <ReviewsAnalyticsDashboard
            onOpenTicket={handleOpenTicket}
            onNavigateTab={handleNavigateTab}
          />
        );
      case 'drive':
        return <DriveExplorer />;
      case 'articles':
        return <ArticlesSection onNavigateTab={handleNavigateTab} />;
      case 'personal-queries':
        return (
          <NormalAdminDashboard
            currentTab="assigned-queries"
            onNavigateTab={handleNavigateTab}
          />
        );
      case 'audit-logs':
        return <AuditLogsSection />;
      case 'profile':
        return <UserProfileSection />;
      case 'notifications':
        return <NotificationsPage onOpenQuery={() => handleNavigateTab('all-queries')} />;
      default:
        return (
          <SuperAdminDashboard
            onNavigateTab={handleNavigateTab}
            onOpenTicket={handleOpenTicket}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-pink-50/25 flex flex-col font-sans text-slate-900 antialiased">
      <QuotaNoticeBanner />
      <Navbar
        onNavigateTab={handleNavigateTab}
        currentTab={effectiveTab}
        onViewLanding={() => handleViewLanding(true)}
      />

      {(() => {
        const isChatTab = ['replies', 'assigned-queries', 'personal-queries', 'all-queries'].includes(effectiveTab);
        return (
          <div className={`flex-1 flex w-full mx-auto min-w-0 ${isChatTab ? 'max-w-full xl:max-w-7xl' : 'max-w-7xl'}`}>
            <Sidebar
              currentTab={effectiveTab}
              onSelectTab={handleNavigateTab}
            />

            <main
              className={`flex-1 min-w-0 w-full ${
                isChatTab
                  ? 'p-0 sm:p-0 xl:p-6 pb-0 sm:pb-0 xl:pb-6 overflow-hidden'
                  : 'p-3.5 sm:p-6 lg:p-8 pb-24 sm:pb-28 xl:pb-8 overflow-y-auto'
              }`}
            >
              <div key={activeTicket ? `ticket-${activeTicket.id}` : effectiveTab} className="w-full h-full">
                {renderContent()}
              </div>
            </main>
          </div>
        );
      })()}

      {/* WhatsApp-Style Fixed Bottom Navigation Bar for Mobile and Tablet */}
      {!activeTicket && (
        <BottomNav
          currentTab={effectiveTab}
          onSelectTab={handleNavigateTab}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MainApp />
      </NotificationProvider>
    </AuthProvider>
  );
}
