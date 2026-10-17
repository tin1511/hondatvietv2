import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Compass, 
  Camera, 
  MessageSquareQuote, 
  Utensils, 
  CalendarDays, 
  Mic, 
  BookOpen, 
  Users, 
  ShieldCheck, 
  Info, 
  Heart, 
  Globe, 
  Menu, 
  X,
  User,
  History,
  LogIn,
  LogOut,
  Award,
  ArrowLeft,
  Database,
  WifiOff,
  Eye,
  Plus
} from 'lucide-react';
import { UserProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { storageService, DEFAULT_SITE_LOGO } from '../services/storageService';
import { languageService, SUPPORTED_LANGUAGES } from '../services/languageService';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  favoritesCount: number;
  userProfile: UserProfile;
  language: string;
  onLanguageChange: (lang: string) => void;
  onOpenAuthModal: (initialTab?: 'login' | 'register' | 'profile' | 'activity') => void;
  onOpenOfflineManager?: () => void;
  onLogout?: () => void;
  onPeekBackground?: () => void;
  onOpenAddHeritage?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  favoritesCount,
  userProfile,
  language,
  onLanguageChange,
  onOpenAuthModal,
  onOpenOfflineManager,
  onLogout,
  onPeekBackground,
  onOpenAddHeritage
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const [siteLogo, setSiteLogo] = useState<string>(() => storageService.getSiteLogo());

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) setMobileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleLogoChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setSiteLogo(customEvent.detail);
      }
    };
    window.addEventListener('hdv_site_logo_changed', handleLogoChange);
    return () => window.removeEventListener('hdv_site_logo_changed', handleLogoChange);
  }, []);

  const navItems = [
    { id: 'home', label: languageService.t('nav.home', language, 'Trang chủ'), icon: Compass },
    { id: 'map', label: languageService.t('nav.map', language, 'Bản đồ Việt Nam'), icon: Globe, badge: 'Chữ S 🇻🇳' },
    { id: 'recognizer', label: languageService.t('nav.recognizer', language, 'Nhận diện AI'), icon: Camera, badge: 'Vision' },
    { id: 'storyteller', label: languageService.t('nav.storyteller', language, 'Kể chuyện AI'), icon: Sparkles },
    { id: 'chat', label: languageService.t('nav.chat', language, 'Hướng Dẫn Viên AI'), icon: Compass, badge: 'HDV 3D' },
    { id: 'itinerary', label: languageService.t('nav.itinerary', language, 'Lịch trình'), icon: CalendarDays },
    { id: 'learning', label: languageService.t('nav.learning', language, 'Quiz & Lịch sử'), icon: Award },
    { id: 'profile', label: languageService.t('nav.profile', language, 'Hồ sơ & Danh hiệu'), icon: Award, badge: 'XP' },
    { id: 'community', label: languageService.t('nav.community', language, 'Cộng đồng'), icon: Users },
  ];

  return (
    <header ref={headerRef} className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-amber-900/30 text-stone-100 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Row 1: Brand & Right Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between min-h-16 py-2 gap-2 sm:gap-3">
          
          {/* Logo & Brand & Back Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {currentTab !== 'home' && (
              <button
                id="btn-nav-back-to-home"
                type="button"
                onClick={() => onSelectTab('home')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all group shrink-0 active:scale-95 shadow-sm whitespace-nowrap"
                title={languageService.t('nav.backToHome', language, 'Quay về Trang chủ')}
              >
                <ArrowLeft className="w-4 h-4 text-amber-400 group-hover:-translate-x-1 transition-transform shrink-0" />
                <span className="hidden sm:inline">{languageService.t('nav.home', language, 'Trang chủ')}</span>
              </button>
            )}

            <div 
              id="brand-logo"
              onClick={() => onSelectTab('home')}
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none shrink-0"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-lg shadow-amber-900/40 border border-amber-400/30 group-hover:scale-105 transition-transform duration-200 shrink-0 bg-stone-900 flex items-center justify-center">
                <img 
                  src={siteLogo || DEFAULT_SITE_LOGO} 
                  alt="Hồn Đất Việt" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.className = "w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-900/40 border border-amber-400/40 group-hover:scale-105 transition-transform duration-200 shrink-0";
                      const textSpan = document.createElement('span');
                      textSpan.className = "text-lg sm:text-xl font-serif font-bold text-amber-100";
                      textSpan.innerText = "H";
                      parent.appendChild(textSpan);
                    }
                  }}
                />
              </div>
              <div className="shrink-0 whitespace-nowrap">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="font-serif font-bold tracking-wide text-base sm:text-lg text-amber-100 group-hover:text-amber-300 transition-colors whitespace-nowrap">
                    HỒN ĐẤT <span className="text-amber-400">VIỆT</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium whitespace-nowrap">
                    VN 4.0
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-stone-400 hidden sm:block font-normal whitespace-nowrap">
                  {languageService.t('nav.brandTagline', language, 'Hiểu di sản. Khám phá Việt Nam.')}
                </p>
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-1.5 sm:gap-2 shrink-0 w-full sm:w-auto min-w-0">
            
            {/* 1. Authentication / Profile Status Button */}
            {userProfile.isLoggedIn ? (
              <button
                id="btn-profile"
                onClick={() => onSelectTab('profile')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800/90 hover:bg-stone-700/90 border border-amber-500/40 transition-all shrink-0 cursor-pointer"
                title={`Tài khoản: ${userProfile.displayName}`}
              >
                <User className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-stone-200 truncate max-w-[140px] sm:max-w-[185px]">
                  {userProfile.displayName}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                <button
                  id="btn-login"
                  onClick={() => onOpenAuthModal('login')}
                  className="flex items-center gap-1 p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-900/90 hover:bg-stone-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-bold transition-all shrink-0 shadow-sm cursor-pointer whitespace-nowrap"
                  title="Đăng nhập tài khoản"
                >
                  <LogIn className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden md:inline">{languageService.t('nav.login', language, 'Đăng nhập')}</span>
                </button>
                <button
                  id="btn-register"
                  onClick={() => onOpenAuthModal('register')}
                  className="flex items-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 text-xs font-extrabold shadow-md shadow-amber-950/40 transition-all shrink-0 active:scale-95 cursor-pointer border border-amber-300 whitespace-nowrap"
                  title="Tạo tài khoản mới"
                >
                  <User className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-stone-950 shrink-0" />
                  <span className="hidden md:inline">{languageService.t('nav.register', language, 'Đăng ký')}</span>
                </button>
              </div>
            )}

            {/* 2. "ĐỀ XUẤT MỚI" BUTTON (Hidden on very small mobile to prevent clutter) */}
            {onOpenAddHeritage && (
              <button
                id="btn-nav-add-heritage"
                onClick={onOpenAddHeritage}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs shadow-md shadow-amber-950/40 transition-all shrink-0 active:scale-95 cursor-pointer border border-amber-300"
                title="Đề xuất thêm di sản hoặc địa điểm mới ngay lập tức"
              >
                <img 
                  src={siteLogo || DEFAULT_SITE_LOGO} 
                  alt="Logo Hồn Đất Việt" 
                  className="w-4 h-4 rounded-full object-cover border border-amber-950/40 shrink-0" 
                />
                <span className="hidden md:inline">{languageService.t('nav.addHeritage', language, 'Đề Xuất Mới')}</span>
              </button>
            )}

            {/* 3. FAVORITES ICON */}
            <button
              id="btn-favorites"
              onClick={() => onSelectTab('favorites')}
              className="relative p-2 rounded-xl text-stone-300 hover:text-red-400 hover:bg-stone-800/80 transition-colors shrink-0"
              title="Danh sách di sản đã lưu"
            >
              <Heart className="w-4 h-4 text-red-400 fill-red-500/30" />
              {favoritesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {favoritesCount}
                </span>
              )}
            </button>

            {/* Quick Peek Background Icon */}
            {onPeekBackground && (
              <button
                id="btn-peek-background-nav"
                onClick={onPeekBackground}
                className="p-2 rounded-xl text-stone-300 hover:text-emerald-400 hover:bg-stone-800/80 transition-colors shrink-0 hidden sm:flex"
                title={languageService.t('floating.peekBackground', language, 'Ngắm trọn vẹn bức ảnh nền danh thắng')}
              >
                <Eye className="w-4 h-4 text-emerald-400" />
              </button>
            )}

            {/* Single Primary Language Selector (Góc trên bên phải thanh điều hướng) */}
            <div className="relative flex items-center">
              <label htmlFor="nav-primary-language-select" className="sr-only">
                {languageService.t('lang.selectInterface', language, 'Chọn ngôn ngữ')}
              </label>
              <div className="relative flex items-center">
                <Globe className="absolute left-2.5 w-3.5 h-3.5 text-amber-400 pointer-events-none" />
                <select
                  id="nav-primary-language-select"
                  value={language}
                  onChange={(e) => onLanguageChange(e.target.value)}
                  className="bg-stone-900/90 hover:bg-stone-850 text-stone-100 text-xs font-bold rounded-xl pl-7 pr-3 py-1.5 border border-amber-500/40 hover:border-amber-400/70 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 cursor-pointer shadow-md shadow-stone-950/40 transition-all select-none"
                  title="Chọn ngôn ngữ toàn website / Choose website language"
                  aria-label="Chọn ngôn ngữ website"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-stone-900 text-stone-100 font-semibold py-1">
                      {lang.flag} {lang.name} ({lang.code.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Offline Manager Button */}
            {onOpenOfflineManager && (
              <button
                id="btn-offline-mode"
                onClick={onOpenOfflineManager}
                className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors shrink-0"
                title="Quản lý Chế độ Ngoại tuyến & Service Worker"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>{languageService.t('nav.offline', language, 'Ngoại tuyến')}</span>
              </button>
            )}

            {/* PWA In-App Install Button */}
            <div className="hidden 2xl:block shrink-0">
              <PWAInstallButton variant="button" />
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 min-w-11 min-h-11 rounded-xl text-stone-300 hover:text-stone-100 hover:bg-stone-800 transition-colors shrink-0 inline-flex items-center justify-center"
              aria-label={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-primary-menu"
              title={mobileMenuOpen ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-amber-400" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Row 2: Desktop Primary Nav (All Items Visible in dedicated taskbar row) */}
        <nav className="hidden xl:flex items-center gap-1.5 py-2 px-1 overflow-x-auto scrollbar-none border-t border-amber-900/20">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`relative px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive 
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 shadow-sm font-bold' 
                    : 'text-stone-300 hover:text-amber-200 hover:bg-stone-800/80'
                }`}
                title={item.label}
              >
                <Icon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-500 text-stone-950 font-bold rounded shrink-0">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Responsive menu: every primary route and header action remains reachable below xl. */}
        <div
          id="mobile-primary-menu"
          className={`xl:hidden border-t border-amber-900/30 py-3 space-y-4 ${mobileMenuOpen ? 'block' : 'hidden'}`}
          aria-label="Tất cả mục điều hướng"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  id={`mobile-nav-link-${item.id}`}
                  onClick={() => {
                    onSelectTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isActive
                      ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                      : 'border-stone-800 bg-stone-900/80 text-stone-200 hover:border-amber-500/40 hover:bg-stone-800'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-amber-400" />
                  <span className="min-w-0 flex-1 whitespace-normal break-words">{item.label}</span>
                  {item.badge && <span className="shrink-0 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-stone-950">{item.badge}</span>}
                </button>
              );
            })}
          </div>

          <div className="border-t border-stone-800 pt-3">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">Tài khoản và tiện ích</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {userProfile.isLoggedIn ? (
                <button
                  type="button"
                  id="mobile-action-profile"
                  onClick={() => { onSelectTab('profile'); setMobileMenuOpen(false); }}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/30 bg-stone-900 px-3 py-2 text-left text-xs font-semibold text-stone-100 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <User className="h-4 w-4 shrink-0 text-amber-400" />
                  <span className="min-w-0 break-words">{userProfile.displayName || languageService.t('nav.profile', language, 'Hồ sơ')}</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    id="mobile-action-login"
                    onClick={() => { onOpenAuthModal('login'); setMobileMenuOpen(false); }}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/30 bg-stone-900 px-3 py-2 text-left text-xs font-semibold text-amber-200 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <LogIn className="h-4 w-4 shrink-0" />
                    <span>Đăng nhập</span>
                  </button>
                  <button
                    type="button"
                    id="mobile-action-register"
                    onClick={() => { onOpenAuthModal('register'); setMobileMenuOpen(false); }}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500 px-3 py-2 text-left text-xs font-bold text-stone-950 hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                  >
                    <User className="h-4 w-4 shrink-0" />
                    <span>Đăng ký</span>
                  </button>
                </>
              )}

              <button
                type="button"
                id="mobile-action-favorites"
                onClick={() => { onSelectTab('favorites'); setMobileMenuOpen(false); }}
                className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-800 bg-stone-900 px-3 py-2 text-left text-xs font-semibold text-stone-200 hover:border-amber-500/40 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Heart className="h-4 w-4 shrink-0 text-red-400" />
                <span>Yêu thích{favoritesCount > 0 ? ` (${favoritesCount})` : ''}</span>
              </button>

              {onOpenAddHeritage && (
                <button
                  type="button"
                  id="mobile-action-add-heritage"
                  onClick={() => { onOpenAddHeritage(); setMobileMenuOpen(false); }}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-xs font-semibold text-amber-200 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Đề xuất mới</span>
                </button>
              )}

              {onPeekBackground && (
                <button
                  type="button"
                  id="mobile-action-peek-background"
                  onClick={() => { onPeekBackground(); setMobileMenuOpen(false); }}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-800 bg-stone-900 px-3 py-2 text-left text-xs font-semibold text-stone-200 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Eye className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>Ngắm ảnh nền</span>
                </button>
              )}

              {onOpenOfflineManager && (
                <button
                  type="button"
                  id="mobile-action-offline"
                  onClick={() => { onOpenOfflineManager(); setMobileMenuOpen(false); }}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-stone-800 bg-stone-900 px-3 py-2 text-left text-xs font-semibold text-stone-200 hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Database className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>Ngoại tuyến</span>
                </button>
              )}

              <div className="min-w-0" onClick={() => setMobileMenuOpen(false)}>
                <PWAInstallButton variant="menuItem" className="min-h-11 border border-stone-800 bg-stone-900" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

  );
};
