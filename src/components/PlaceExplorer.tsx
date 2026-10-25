import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  WifiOff, 
  CheckCircle2, 
  RotateCcw, 
  Sparkles, 
  LayoutGrid, 
  Compass, 
  ShieldCheck, 
  AlertTriangle,
  Layers,
  ArrowRight
} from 'lucide-react';
import { CulturalMap } from './CulturalMap';
import { OfflineBasicExplorer } from './OfflineBasicExplorer';
import { 
  mapHealthService, 
  MapHealthState, 
  MapDisplayMode 
} from '../services/mapHealthService';
import { languageService } from '../services/languageService';
import { HeritageItem, UserProfile } from '../types';

interface PlaceExplorerProps {
  currentUser?: UserProfile;
  language?: string;
  onNavigateToStory: (heritageName: string, history?: string, period?: string) => void;
  onNavigateToFood: (heritageId: string) => void;
  onSelectHeritage?: (heritage: HeritageItem) => void;
}

export const PlaceExplorer: React.FC<PlaceExplorerProps> = ({
  currentUser,
  language = 'vi',
  onNavigateToStory,
  onNavigateToFood,
  onSelectHeritage
}) => {
  const [mapHealth, setMapHealth] = useState<MapHealthState>(() => mapHealthService.getState());
  
  // Shared exploration state preserved across view switches
  const [sharedQuery, setSharedQuery] = useState<string>('');
  const [sharedCategory, setSharedCategory] = useState<string>('all');
  const [sharedRegion, setSharedRegion] = useState<'all' | 'north' | 'central' | 'south'>('all');
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = mapHealthService.subscribe((state) => {
      setMapHealth(state);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSwitch = (targetMode: MapDisplayMode) => {
    mapHealthService.setManualMode(targetMode);
  };

  const handleResetToAuto = () => {
    mapHealthService.resetToAutomatic();
  };

  const handleRetryMap = async () => {
    setIsRetrying(true);
    await mapHealthService.probeMapHealth();
    setIsRetrying(false);
  };

  const isOnlineMode = mapHealth.mode === 'online_map';

  return (
    <div className="space-y-4">
      {/* 🧭 DUAL-SYSTEM UNIFIED MODE HEADER & AUTO-SWITCH CONTROLLER */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-3xl p-3 sm:p-4 shadow-xl backdrop-blur flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Left: Current Active Mode Indicator */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
            isOnlineMode
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
          }`}>
            {isOnlineMode ? <Globe className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                isOnlineMode
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnlineMode ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>
                  {isOnlineMode 
                    ? languageService.t('explorer.onlineMapMode', language, 'Đang dùng bản đồ tương tác trực tuyến')
                    : languageService.t('explorer.offlineBasicMode', language, 'Đang dùng chế độ offline (Offline Basic)')}
                </span>
              </span>

              {mapHealth.networkStatus === 'offline' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-500/30 font-semibold">
                  Mất kết nối mạng
                </span>
              )}

              {mapHealth.userManualOverride && (
                <button
                  onClick={handleResetToAuto}
                  className="text-[10px] text-stone-400 hover:text-amber-300 underline cursor-pointer"
                  title="Khôi phục chế độ tự động chuyển đổi theo mạng"
                >
                  (Đã chọn thủ công • Khôi phục tự động)
                </button>
              )}
            </div>

            <p className="text-xs text-stone-400 mt-0.5 truncate">
              {isOnlineMode
                ? languageService.t('explorer.onlineHint', language, 'Bản đồ vector 34 tỉnh/thành & di sản sẵn sàng • Tự động chuyển sang Offline khi mất mạng.')
                : languageService.t('explorer.offlineHint', language, 'Cơ sở dữ liệu trên thiết bị sẵn sàng • Tự động khôi phục bản đồ khi mạng ổn định.')}
            </p>
          </div>
        </div>

        {/* Right: Quick Switch Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          {mapHealth.mode === 'offline_basic' && (
            <button
              onClick={handleRetryMap}
              disabled={isRetrying}
              className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Kiểm tra lại tài nguyên và máy chủ bản đồ"
            >
              <RotateCcw className={`w-3 h-3 ${isRetrying ? 'animate-spin text-amber-400' : 'text-stone-400'}`} />
              <span>{isRetrying ? 'Đang kiểm tra...' : 'Thử tải lại bản đồ'}</span>
            </button>
          )}

          {isOnlineMode ? (
            <button
              onClick={() => handleManualSwitch('offline_basic')}
              className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white border border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Xem danh sách ô địa điểm di sản (tiết kiệm dữ liệu hoặc chuẩn bị offline)"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
              <span>Xem dạng thẻ Offline</span>
            </button>
          ) : (
            <button
              onClick={() => handleManualSwitch('online_map')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-stone-950" />
              <span>Mở Bản đồ</span>
            </button>
          )}
        </div>
      </div>

      {/* ⚠️ MAP FAILURE FALLBACK ADVISORY NOTICE (If online but map assets failed) */}
      {!isOnlineMode && mapHealth.networkStatus === 'online' && mapHealth.failureReason && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Bản đồ tạm thời gặp sự cố tải tài nguyên:</strong> {mapHealth.failureReason}. Ứng dụng đã chuyển sang giao diện Basic để tránh gián đoạn.
            </span>
          </div>
          <button
            onClick={handleRetryMap}
            disabled={isRetrying}
            className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shrink-0 cursor-pointer"
          >
            {isRetrying ? 'Đang thử lại...' : 'Thử lại'}
          </button>
        </div>
      )}

      {/* VIEW SWITCHER: ONLINE MAP OR OFFLINE BASIC */}
      {isOnlineMode ? (
        <div className="animate-fadeIn">
          <CulturalMap
            currentUser={currentUser}
            language={language}
            onNavigateToStory={onNavigateToStory}
            onNavigateToFood={onNavigateToFood}
            onSelectHeritage={onSelectHeritage}
            initialSearchQuery={sharedQuery}
            initialCategory={sharedCategory}
            initialRegion={sharedRegion}
            onSearchQueryChange={setSharedQuery}
            onCategoryChange={setSharedCategory}
            onRegionChange={setSharedRegion}
            onMapError={(err) => {
              mapHealthService.reportMapFailure(err);
            }}
            onMapReady={() => {
              mapHealthService.reportMapSuccess();
            }}
          />
        </div>
      ) : (
        <div className="animate-fadeIn">
          <OfflineBasicExplorer
            currentUser={currentUser}
            language={language}
            mapHealth={mapHealth}
            initialQuery={sharedQuery}
            initialCategory={sharedCategory}
            initialRegion={sharedRegion}
            onQueryChange={setSharedQuery}
            onCategoryChange={setSharedCategory}
            onRegionChange={(reg) => setSharedRegion(reg as any)}
            onNavigateToStory={onNavigateToStory}
            onNavigateToFood={onNavigateToFood}
            onSelectHeritage={onSelectHeritage}
            onSwitchToOnlineMap={() => handleManualSwitch('online_map')}
          />
        </div>
      )}
    </div>
  );
};
