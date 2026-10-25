import React, { useState, useMemo } from 'react';
import { 
  Compass, 
  MapPin, 
  Search, 
  SlidersHorizontal, 
  Sparkles, 
  Volume2, 
  Utensils, 
  Clock, 
  Ticket, 
  ShieldCheck, 
  WifiOff, 
  RotateCcw, 
  ArrowRight, 
  X, 
  CheckCircle2, 
  ExternalLink,
  Info,
  Layers,
  ChevronRight,
  Database
} from 'lucide-react';
import { 
  offlinePlaceService, 
  OfflinePlaceItem, 
  OfflinePlaceCategory 
} from '../services/offlinePlaceService';
import { MapHealthState, mapHealthService } from '../services/mapHealthService';
import { languageService } from '../services/languageService';
import { HeritageItem, UserProfile } from '../types';

interface OfflineBasicExplorerProps {
  currentUser?: UserProfile;
  language?: string;
  mapHealth: MapHealthState;
  initialQuery?: string;
  initialCategory?: string;
  initialRegion?: string;
  onQueryChange?: (q: string) => void;
  onCategoryChange?: (cat: string) => void;
  onRegionChange?: (reg: string) => void;
  onNavigateToStory: (heritageName: string, history?: string, period?: string) => void;
  onNavigateToFood: (heritageId: string) => void;
  onSelectHeritage?: (heritage: HeritageItem) => void;
  onSwitchToOnlineMap?: () => void;
}

export const OfflineBasicExplorer: React.FC<OfflineBasicExplorerProps> = ({
  currentUser,
  language = 'vi',
  mapHealth,
  initialQuery = '',
  initialCategory = 'all',
  initialRegion = 'all',
  onQueryChange,
  onCategoryChange,
  onRegionChange,
  onNavigateToStory,
  onNavigateToFood,
  onSelectHeritage,
  onSwitchToOnlineMap
}) => {
  const [searchQuery, setSearchQuery] = useState<string>(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<OfflinePlaceCategory | 'all'>(
    (initialCategory as OfflinePlaceCategory) || 'all'
  );
  const [selectedRegion, setSelectedRegion] = useState<'all' | 'north' | 'central' | 'south'>(
    (initialRegion as any) || 'all'
  );
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [activeModalPlace, setActiveModalPlace] = useState<OfflinePlaceItem | null>(null);
  const [isRetryingMap, setIsRetryingMap] = useState<boolean>(false);

  // Sync internal search with parent
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    onQueryChange?.(val);
  };

  const handleCategorySelect = (cat: OfflinePlaceCategory | 'all') => {
    setSelectedCategory(cat);
    onCategoryChange?.(cat);
  };

  const handleRegionSelect = (reg: 'all' | 'north' | 'central' | 'south') => {
    setSelectedRegion(reg);
    onRegionChange?.(reg);
  };

  const handleRetryMap = async () => {
    setIsRetryingMap(true);
    await mapHealthService.probeMapHealth();
    setIsRetryingMap(false);
  };

  // Query offline places directly from local storage
  const filteredPlaces = useMemo(() => {
    return offlinePlaceService.searchPlaces({
      query: searchQuery,
      category: selectedCategory,
      region: selectedRegion,
      province: selectedProvince !== 'all' ? selectedProvince : undefined
    });
  }, [searchQuery, selectedCategory, selectedRegion, selectedProvince]);

  const categories = useMemo(() => offlinePlaceService.getCategories(), []);

  // Distinct province list for quick filter
  const provincesList = useMemo(() => {
    const all = offlinePlaceService.getAllPlaces();
    const set = new Set<string>();
    all.forEach(p => {
      if (p.province) set.add(p.province);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, []);

  // Convert OfflinePlaceItem to HeritageItem when detail or external story is requested
  const toHeritageItem = (place: OfflinePlaceItem): HeritageItem => {
    return {
      id: place.id,
      name: place.name,
      vietnameseName: place.vietnameseName,
      englishName: place.englishName,
      province: place.province,
      region: place.region,
      category: place.category as any,
      categoryLabel: place.categoryLabel,
      history: place.history,
      culturalSignificance: place.culturalSignificance,
      visitingHours: place.visitingHours,
      ticketPrice: place.ticketPrice,
      address: place.address || `${place.name}, ${place.province}`,
      interestingFacts: place.tips ? [place.tips] : [],
      imageUrl: place.imageUrl || '',
      tags: place.tags,
      lat: place.lat || 16.0,
      lng: place.lng || 108.0,
      period: 'Di sản & Văn hóa truyền thống',
      googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(place.name + ' ' + place.province)}`,
      suggestedQuestions: [
        `Ý nghĩa văn hóa đặc trưng của ${place.name} là gì?`,
        `Thời điểm nào tham quan ${place.name} đẹp nhất trong năm?`
      ],
      verifiedStatus: place.isVerified ? 'verified' : 'unverified',
      verifiedNote: place.verifiedNote
    };
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 🧭 DUAL-SYSTEM STATUS BANNER */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-stone-900 via-stone-900 to-amber-950/40 border border-amber-500/40 shadow-2xl backdrop-blur relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                <WifiOff className="w-3.5 h-3.5" />
                <span>{languageService.t('offline.activeBadge', language, 'Đang dùng chế độ offline (Offline Basic)')}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold">
                <Database className="w-3 h-3" />
                <span>{languageService.t('offline.storedCount', language, 'Đã lưu trên thiết bị')} ({filteredPlaces.length} địa điểm)</span>
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-100 flex items-center gap-2">
              <span>{languageService.t('offline.title', language, 'Khám Phá Địa Điểm Ngoại Tuyến')}</span>
            </h2>

            <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed">
              {mapHealth.networkStatus === 'offline' 
                ? languageService.t('offline.networkOfflineDesc', language, 'Thiết bị đang ngắt kết nối mạng. Ứng dụng tự động chuyển sang cơ sở dữ liệu đã lưu trên máy để bạn tra cứu di tích, văn hóa, danh thắng và ẩm thực mọi lúc mọi nơi.')
                : languageService.t('offline.mapFallbackDesc', language, 'Bản đồ tương tác trực tuyến đang tải hoặc tạm thời không khả dụng. Chế độ Offline Basic đang kích hoạt để bảo đảm trải nghiệm không bị gián đoạn.')}
            </p>
          </div>

          {/* Quick Actions / Retry Button */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              onClick={handleRetryMap}
              disabled={isRetryingMap}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              title={languageService.t('offline.retryTooltip', language, 'Kiểm tra lại kết nối và máy chủ bản đồ')}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRetryingMap ? 'animate-spin text-amber-400' : 'text-stone-400'}`} />
              <span>{isRetryingMap ? languageService.t('offline.checking', language, 'Đang kiểm tra...') : languageService.t('offline.checkMap', language, 'Thử tải lại bản đồ')}</span>
            </button>

            {onSwitchToOnlineMap && (
              <button
                onClick={onSwitchToOnlineMap}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Compass className="w-4 h-4 text-stone-950" />
                <span>{languageService.t('offline.switchMap', language, 'Xem bản đồ')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 🔍 SEARCH & FILTERS BAR */}
      <div className="p-4 sm:p-5 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-xl space-y-4">
        {/* Row 1: Search Input & Province selector */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-8 relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={languageService.t('offline.searchPlaceholder', language, 'Tìm kiếm di tích, văn hóa, danh thắng, làng nghề, ẩm thực (gõ không dấu hoặc có dấu)...')}
              className="w-full pl-10 pr-10 py-3 rounded-2xl bg-stone-950 border border-stone-800 text-stone-100 placeholder-stone-500 text-xs sm:text-sm focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-4 flex gap-2">
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="w-full py-3 px-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 text-xs sm:text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="all">🇻🇳 {languageService.t('offline.allProvinces', language, 'Tất cả 63 tỉnh thành')}</option>
              {provincesList.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Region Pills & Category Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-800/80">
          {/* Regions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-stone-400 font-serif mr-1">
              {languageService.t('offline.region', language, 'Vùng miền:')}
            </span>
            {[
              { id: 'all', label: languageService.t('offline.allRegions', language, 'Toàn quốc') },
              { id: 'north', label: languageService.t('offline.north', language, 'Bắc Bộ') },
              { id: 'central', label: languageService.t('offline.central', language, 'Trung Bộ') },
              { id: 'south', label: languageService.t('offline.south', language, 'Nam Bộ & Tây Nguyên') },
            ].map((reg) => (
              <button
                key={reg.id}
                onClick={() => handleRegionSelect(reg.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedRegion === reg.id
                    ? 'bg-amber-500 text-stone-950 font-bold shadow-md'
                    : 'bg-stone-950 text-stone-300 hover:bg-stone-800 hover:text-stone-100 border border-stone-800'
                }`}
              >
                {reg.label}
              </button>
            ))}
          </div>

          {/* Result Count Indicator */}
          <div className="text-xs text-stone-400">
            {languageService.t('offline.showing', language, 'Hiển thị')} <strong className="text-amber-400">{filteredPlaces.length}</strong> {languageService.t('offline.placesFound', language, 'kết quả')}
          </div>
        </div>

        {/* Row 3: Category Pills (Di tích lịch sử, Văn hóa, Thiên nhiên, Làng nghề & Chợ, Ẩm thực) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold shadow-md shadow-amber-950/40 scale-102'
                    : 'bg-stone-950 hover:bg-stone-800 text-stone-300 border border-stone-800 hover:border-amber-500/30'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-stone-950/30 text-stone-950' : 'bg-stone-800 text-stone-400'}`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 📦 CARDS GRID: DI TÍCH, VĂN HÓA, THIÊN NHIÊN, CHỢ TRUYỀN THỐNG, ẨM THỰC */}
      {filteredPlaces.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {filteredPlaces.map((item) => (
            <div
              key={item.id}
              className="bg-stone-900 border border-stone-800 hover:border-amber-500/50 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-amber-950/20 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {/* Card Content Body (No illustration image) */}
                <div 
                  onClick={() => setActiveModalPlace(item)}
                  className="p-4 sm:p-5 space-y-3 cursor-pointer"
                >
                  {/* Top Category & Offline Status Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] sm:text-[11px] px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1.5">
                      <span>{item.categoryEmoji}</span>
                      <span>{item.categoryLabel}</span>
                    </span>

                    <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>Offline</span>
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] text-red-400 font-medium flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.province}</span>
                    </div>

                    <h3 className="font-serif font-bold text-stone-100 text-base group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                      {item.name}
                    </h3>
                  </div>

                  <p className="text-xs text-stone-300 line-clamp-2 leading-relaxed">
                    {item.shortDescription}
                  </p>

                  {/* Quick visiting specs */}
                  <div className="space-y-1 pt-2 border-t border-stone-800/80 text-[11px] text-stone-400">
                    {item.visitingHours && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-400/80 shrink-0" />
                        <span className="truncate">{item.visitingHours}</span>
                      </div>
                    )}
                    {item.ticketPrice && (
                      <div className="flex items-center gap-1.5">
                        <Ticket className="w-3 h-3 text-emerald-400/80 shrink-0" />
                        <span className="truncate text-stone-300">{item.ticketPrice}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="p-4 pt-0 grid grid-cols-2 gap-2 border-t border-stone-800/80 mt-2">
                <button
                  onClick={() => setActiveModalPlace(item)}
                  className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer"
                  title="Xem thông tin chi tiết đầy đủ lưu trên máy"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>{languageService.t('offline.viewDetail', language, 'Chi tiết')}</span>
                </button>

                <button
                  onClick={() => onNavigateToStory(item.name, item.history, item.categoryLabel)}
                  className="py-2 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Nghe kể chuyện lịch sử & văn hóa"
                >
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>{languageService.t('offline.story', language, 'Kể chuyện')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 rounded-3xl bg-stone-900 border border-stone-800 text-center space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center">
            <Search className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-serif font-bold text-stone-100">
            {languageService.t('offline.emptyTitle', language, 'Không tìm thấy địa điểm phù hợp')}
          </h3>
          <p className="text-xs text-stone-400 leading-relaxed">
            {languageService.t('offline.emptyDesc', language, 'Không có địa điểm nào trong bộ nhớ ngoại tuyến khớp với từ khóa hoặc bộ lọc đã chọn.')}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedRegion('all');
              setSelectedProvince('all');
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
          >
            {languageService.t('offline.resetFilters', language, 'Đặt lại tất cả bộ lọc')}
          </button>
        </div>
      )}

      {/* 📖 FULL OFFLINE PLACE DETAIL MODAL (No remote API or map tile dependency) */}
      {activeModalPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-stone-900 border border-amber-500/40 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col relative text-stone-100">
            {/* Modal Header */}
            <div className="sticky top-0 z-20 bg-stone-950/90 backdrop-blur border-b border-stone-800 p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-bold">
                  {activeModalPlace.categoryEmoji} {activeModalPlace.categoryLabel}
                </span>
                <span className="text-xs text-stone-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-red-400" />
                  <span>{activeModalPlace.province}</span>
                </span>
              </div>

              <button
                onClick={() => setActiveModalPlace(null)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Title Banner (No illustration image) */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-stone-950 via-stone-900 to-amber-950/20 border-b border-stone-800 flex items-center gap-4">
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 text-3xl shadow">
                <span>{activeModalPlace.categoryEmoji}</span>
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-100">
                  {activeModalPlace.name}
                </h2>
                {activeModalPlace.englishName && (
                  <p className="text-xs text-stone-400 mt-0.5">
                    {activeModalPlace.englishName}
                  </p>
                )}
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5">
              {/* Visiting Quick Facts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-stone-950 border border-stone-800 text-xs">
                {activeModalPlace.address && (
                  <div className="space-y-1">
                    <span className="text-stone-500 block font-serif">Địa chỉ</span>
                    <span className="text-stone-200 font-medium flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{activeModalPlace.address}</span>
                    </span>
                  </div>
                )}

                {activeModalPlace.visitingHours && (
                  <div className="space-y-1">
                    <span className="text-stone-500 block font-serif">Giờ mở cửa / tham quan</span>
                    <span className="text-stone-200 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{activeModalPlace.visitingHours}</span>
                    </span>
                  </div>
                )}

                {activeModalPlace.ticketPrice && (
                  <div className="space-y-1">
                    <span className="text-stone-500 block font-serif">Giá vé / Phí tham quan</span>
                    <span className="text-stone-200 font-medium flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{activeModalPlace.ticketPrice}</span>
                    </span>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-stone-500 block font-serif">Nguồn xác thực</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>{activeModalPlace.verifiedNote || 'Đã kiểm định trong cơ sở dữ liệu di sản'}</span>
                  </span>
                </div>
              </div>

              {/* Cultural Significance & Value */}
              <div className="space-y-2">
                <h4 className="font-serif font-bold text-amber-300 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Ý Nghĩa Văn Hóa & Tinh Hoa Di Sản</span>
                </h4>
                <p className="text-xs sm:text-sm text-stone-200 leading-relaxed bg-stone-950/60 p-4 rounded-2xl border border-stone-800/80">
                  {activeModalPlace.culturalSignificance}
                </p>
              </div>

              {/* Historical Context */}
              {activeModalPlace.history && (
                <div className="space-y-2">
                  <h4 className="font-serif font-bold text-amber-300 text-sm uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-400" />
                    <span>Lịch Sử & Bối Cảnh Hình Thành</span>
                  </h4>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed whitespace-pre-line bg-stone-950/60 p-4 rounded-2xl border border-stone-800/80">
                    {activeModalPlace.history}
                  </p>
                </div>
              )}

              {/* Visiting Tips */}
              {activeModalPlace.tips && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs sm:text-sm text-amber-200">
                  <strong className="block font-serif text-amber-300 mb-1">💡 Lời khuyên khi tham quan:</strong>
                  <span>{activeModalPlace.tips}</span>
                </div>
              )}

              {/* Tags */}
              {activeModalPlace.tags && activeModalPlace.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {activeModalPlace.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 text-stone-300 text-[11px] border border-stone-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="sticky bottom-0 bg-stone-950/95 border-t border-stone-800 p-4 sm:p-5 flex flex-wrap items-center justify-end gap-2.5">
              <button
                onClick={() => {
                  const h = toHeritageItem(activeModalPlace);
                  setActiveModalPlace(null);
                  if (onSelectHeritage) onSelectHeritage(h);
                }}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold cursor-pointer"
              >
                Mở thẻ di sản toàn diện
              </button>

              <button
                onClick={() => {
                  onNavigateToStory(activeModalPlace.name, activeModalPlace.history, activeModalPlace.categoryLabel);
                  setActiveModalPlace(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-stone-950" />
                <span>Nghe kể chuyện</span>
              </button>

              <button
                onClick={() => {
                  onNavigateToFood(activeModalPlace.id);
                  setActiveModalPlace(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Utensils className="w-4 h-4 text-white" />
                <span>Ẩm thực lân cận</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
