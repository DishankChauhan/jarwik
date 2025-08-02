'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, LayoutDashboard, History, Settings, User, LogOut, type LucideIcon } from 'lucide-react';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';

interface NavTab {
  title: string;
  icon: LucideIcon;
  href: string;
  requiresAuth: boolean;
}

interface NavSeparator {
  type: 'separator';
}

export default function Navbar() {
  const [user, loading] = useAuthState(auth);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setIsProfileMenuOpen(false);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProtectedNavigation = (href: string) => {
    if (!user && href !== '/') {
      router.push(`/login?redirect=${encodeURIComponent(href)}`);
    } else {
      router.push(href);
    }
  };

  const navTabs: (NavTab | NavSeparator)[] = [
    { title: 'Home', icon: Home, href: '/', requiresAuth: false },
    { title: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', requiresAuth: true },
    { title: 'History', icon: History, href: '/history', requiresAuth: true },
    { type: 'separator' as const },
    { title: 'Settings', icon: Settings, href: '/settings', requiresAuth: true },
  ];

  const handleTabClick = (tab: { href?: string }) => {
    if (tab.href) {
      handleProtectedNavigation(tab.href);
    }
  };

  return (
    <nav className="fixed top-4 left-4 right-4 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100/50 px-4 py-2">
          <Image 
            src="/jarwik logo.png" 
            alt="Jarwik Logo" 
            width={32}
            height={32}
            className="w-8 h-8 object-contain"
          />
          <span className="text-lg font-semibold text-gray-900">
            Jarwik
          </span>
        </Link>

        {/* Navigation Tabs */}
        <div className="hidden md:block">
          <ExpandableTabs 
            tabs={navTabs.filter((tab): tab is NavTab => 'href' in tab)}
            onTabClick={handleTabClick}
            activeTab={pathname}
          />
        </div>

        {/* Auth Section */}
        <div className="flex items-center space-x-4">
          {loading ? (
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100/50 px-4 py-2">
              <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
            </div>
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center space-x-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100/50 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors duration-200"
              >
                {user.photoURL ? (
                  <Image
                    className="h-8 w-8 rounded-full"
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    width={32}
                    height={32}
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <User size={16} className="text-gray-700" />
                  </div>
                )}
                <span className="hidden lg:block text-sm">{user.displayName || user.email}</span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-lg border border-gray-200 py-2 z-20">
                    <button
                      onClick={() => handleProtectedNavigation('/settings')}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-black text-white px-5 py-2 rounded-2xl text-sm font-medium hover:bg-gray-800 transition-colors duration-200 shadow-lg"
            >
              Claim Invite!
            </Link>
          )}

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100/50 p-2 text-gray-600 hover:text-gray-900 transition-colors duration-200">
              <svg
                className="h-6 w-6"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Simple fallback */}
      <div className="md:hidden mt-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-100/50 mx-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          {navTabs.filter((tab): tab is NavTab => !('type' in tab)).map((tab) => (
              <button
                key={tab.title}
                onClick={() => handleTabClick(tab)}
                className={`flex items-center space-x-2 p-3 rounded-xl text-sm font-medium transition-colors duration-200 ${
                  pathname === tab.href
                    ? "bg-gray-100 text-orange-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <tab.icon size={18} />
                <span>{tab.title}</span>
              </button>
            ))}        </div>
        
        {/* Mobile Auth Section */}
        {!loading && !user && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              href="/login"
              className="block bg-black text-white px-5 py-3 rounded-xl text-sm font-medium text-center hover:bg-gray-800 transition-colors duration-200"
            >
              Claim Invite!
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}