/**
 * Map Health and Network Connectivity Service for "Hồn Đất Việt"
 * 
 * Provides dual-signal detection:
 * 1. Browser online/offline network events
 * 2. Active health checks for map assets (GeoJSON boundary data & tile server availability)
 * 
 * Anti-flap debouncing and automatic fallback to Offline Basic mode.
 */

export type MapDisplayMode = 'online_map' | 'offline_basic';
export type MapAssetStatus = 'ready' | 'loading' | 'failed';
export type NetworkStatus = 'online' | 'offline';

export interface MapHealthState {
  mode: MapDisplayMode;
  networkStatus: NetworkStatus;
  mapAssetStatus: MapAssetStatus;
  failureReason: string | null;
  lastCheckedAt: number;
  isAutoSwitchEnabled: boolean;
  userManualOverride: MapDisplayMode | null;
}

type Listener = (state: MapHealthState) => void;

class MapHealthService {
  private state: MapHealthState = {
    mode: typeof navigator !== 'undefined' && navigator.onLine ? 'online_map' : 'offline_basic',
    networkStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
    mapAssetStatus: 'loading',
    failureReason: null,
    lastCheckedAt: Date.now(),
    isAutoSwitchEnabled: true,
    userManualOverride: null,
  };

  private listeners = new Set<Listener>();
  private probeTimeoutId: number | null = null;
  private autoRetryCount = 0;
  private readonly MAX_AUTO_RETRIES = 3;
  private isProbing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);

      // Initial probe on startup
      setTimeout(() => {
        this.probeMapHealth();
      }, 500);
    }
  }

  public getState(): MapHealthState {
    return { ...this.state };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (err) {
        console.warn('[MapHealthService] Listener error:', err);
      }
    });
  }

  private handleOnline = () => {
    this.state.networkStatus = 'online';
    this.state.failureReason = null;
    
    // Anti-flap debounce: wait 1200ms for connection to stabilize before probing map assets
    if (this.probeTimeoutId) {
      window.clearTimeout(this.probeTimeoutId);
    }
    this.probeTimeoutId = window.setTimeout(() => {
      this.probeMapHealth();
    }, 1200);

    this.notify();
  };

  private handleOffline = () => {
    if (this.probeTimeoutId) {
      window.clearTimeout(this.probeTimeoutId);
      this.probeTimeoutId = null;
    }
    this.state.networkStatus = 'offline';
    this.state.mapAssetStatus = 'failed';
    this.state.failureReason = 'Thiết bị mất kết nối Internet. Tự động chuyển sang chế độ ngoại tuyến.';
    
    // Auto-switch immediately to offline basic if not manually locked
    if (this.state.userManualOverride !== 'online_map') {
      this.state.mode = 'offline_basic';
    }
    this.state.lastCheckedAt = Date.now();
    this.notify();
  };

  /**
   * Probe actual reachability of map assets (GeoJSON boundaries / tile server)
   */
  public async probeMapHealth(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Fast check: if browser is offline, map is immediately unavailable
    if (!navigator.onLine) {
      this.state.networkStatus = 'offline';
      this.state.mapAssetStatus = 'failed';
      this.state.failureReason = 'Không có kết nối mạng';
      this.updateEffectiveMode();
      this.notify();
      return false;
    }

    if (this.isProbing) return this.state.mapAssetStatus === 'ready';
    this.isProbing = true;

    try {
      // 1. Probe local GeoJSON boundary asset (or verify cache reachability)
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 4000);

      const probeUrl = '/data/vietnam-provinces.geojson?v=' + Date.now();
      const res = await fetch(probeUrl, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache',
      }).catch(async () => {
        // Fallback: try GET with small range or standard fetch
        return fetch('/data/vietnam-provinces.geojson', {
          method: 'GET',
          signal: controller.signal,
        });
      });

      window.clearTimeout(timer);

      if (res && res.ok) {
        this.state.networkStatus = 'online';
        this.state.mapAssetStatus = 'ready';
        this.state.failureReason = null;
        this.autoRetryCount = 0;
        this.updateEffectiveMode();
        this.notify();
        return true;
      } else {
        throw new Error('Không thể tải tài nguyên ranh giới bản đồ');
      }
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError';
      const msg = isTimeout 
        ? 'Kết nối quá chậm hoặc không tải được tài nguyên bản đồ.' 
        : 'Máy chủ bản đồ hoặc tài nguyên không phản hồi.';
      
      this.state.mapAssetStatus = 'failed';
      this.state.failureReason = msg;

      // Check if we should auto-retry or switch to Offline Basic
      if (this.autoRetryCount < this.MAX_AUTO_RETRIES) {
        this.autoRetryCount++;
        // Schedule next retry with exponential backoff
        const delay = this.autoRetryCount * 2500;
        if (this.probeTimeoutId) window.clearTimeout(this.probeTimeoutId);
        this.probeTimeoutId = window.setTimeout(() => {
          this.probeMapHealth();
        }, delay);
      } else {
        // Switch to offline basic
        this.updateEffectiveMode();
      }

      this.notify();
      return false;
    } finally {
      this.isProbing = false;
      this.state.lastCheckedAt = Date.now();
    }
  }

  /**
   * Called by CulturalMap when a Leaflet, Tile, or GeoJSON failure occurs
   */
  public reportMapFailure(reason: string) {
    console.warn('[MapHealthService] Map error reported:', reason);
    this.state.mapAssetStatus = 'failed';
    this.state.failureReason = reason;

    // Switch to offline basic
    this.updateEffectiveMode();
    this.notify();
  }

  /**
   * Called by CulturalMap when map initializes and loads successfully
   */
  public reportMapSuccess() {
    this.state.mapAssetStatus = 'ready';
    this.state.failureReason = null;
    this.autoRetryCount = 0;
    this.updateEffectiveMode();
    this.notify();
  }

  /**
   * User manually switches mode or requests retry
   */
  public setManualMode(mode: MapDisplayMode | null) {
    this.state.userManualOverride = mode;
    this.updateEffectiveMode();
    this.notify();

    if (mode === 'online_map') {
      this.probeMapHealth();
    }
  }

  public resetToAutomatic() {
    this.state.userManualOverride = null;
    this.updateEffectiveMode();
    this.probeMapHealth();
  }

  private updateEffectiveMode() {
    if (this.state.userManualOverride) {
      this.state.mode = this.state.userManualOverride;
      return;
    }

    // Automatic rule:
    // Only use 'online_map' if network is online AND map assets are ready or loading initially
    if (this.state.networkStatus === 'offline' || this.state.mapAssetStatus === 'failed') {
      this.state.mode = 'offline_basic';
    } else {
      this.state.mode = 'online_map';
    }
  }
}

export const mapHealthService = new MapHealthService();
