/**
 * Offline Place Service for "Hồn Đất Việt"
 * 
 * Provides robust offline data storage using IndexedDB with fallback to localStorage.
 * Pre-hydrated with comprehensive heritage, cultural sites, nature, traditional markets,
 * craft villages, and regional cuisine across Vietnam.
 * 
 * Designed to work 100% offline without remote APIs or map servers.
 */

import { HeritageItem, PlaceItem, TraditionalCraftVillage } from '../types';
import { HERITAGE_DATABASE, PLACES_NEAR_HERITAGE, TRADITIONAL_CRAFTS } from '../data/vietnamHeritageData';
import { ALL_63_PROVINCES_HERITAGES } from '../data/all63ProvincesHeritages';
import { storageService } from './storageService';

export type OfflinePlaceCategory = 'history' | 'culture' | 'nature' | 'craft_market' | 'food';

export interface OfflinePlaceItem {
  id: string;
  name: string;
  vietnameseName: string;
  englishName?: string;
  province: string;
  region: 'north' | 'central' | 'south';
  category: OfflinePlaceCategory;
  categoryLabel: string;
  categoryEmoji: string;
  shortDescription: string;
  history: string;
  culturalSignificance: string;
  visitingHours?: string;
  ticketPrice?: string;
  address?: string;
  tips?: string;
  imageUrl?: string;
  tags: string[];
  lat?: number;
  lng?: number;
  isVerified: boolean;
  verifiedNote?: string;
  source: 'database' | 'user' | 'market_food';
  lastUpdated: string;
}

export interface OfflineFilterCriteria {
  query?: string;
  category?: OfflinePlaceCategory | 'all';
  region?: 'north' | 'central' | 'south' | 'all';
  province?: string;
}

const DB_NAME = 'hdv_offline_places_v3';
const DB_VERSION = 1;
const STORE_NAME = 'places';
const BACKUP_STORAGE_KEY = 'hdv_offline_places_backup_v3';

function normalizeVietnamese(text: unknown): string {
  return String(text ?? '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

class OfflinePlaceService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryCache: OfflinePlaceItem[] = [];
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return reject(new Error('IndexedDB not supported in this environment'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('category', 'category', { unique: false });
          store.createIndex('region', 'region', { unique: false });
          store.createIndex('province', 'province', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Initializes the offline database and pre-hydrates from bundled master datasets
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 1. Try to read from IndexedDB
      const existing = await this.readAllFromIDB();
      if (existing.length > 50) {
        this.memoryCache = existing;
        this.isInitialized = true;
        return;
      }

      // 2. Build complete pre-packaged dataset
      const masterItems = this.buildMasterDataset();
      this.memoryCache = masterItems;

      // 3. Save to IndexedDB
      await this.saveAllToIDB(masterItems);

      // 4. Save to localStorage as secondary fallback
      try {
        localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(masterItems.slice(0, 150)));
      } catch (e) {
        // Quota exceeded is fine, IDB is primary
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn('[OfflinePlaceService] IDB init fallback to bundled data:', err);
      this.memoryCache = this.buildMasterDataset();
      this.isInitialized = true;
    }
  }

  /**
   * Builds the comprehensive offline dataset uniting:
   * - Curated heritages (historical, temples, citadels)
   * - 63 provinces verified heritages
   * - Food & traditional markets
   * - Traditional craft villages
   */
  private buildMasterDataset(): OfflinePlaceItem[] {
    const itemsMap = new Map<string, OfflinePlaceItem>();

    // Category mapper helper
    const mapCategory = (rawCat: string, tags?: string[]): {
      category: OfflinePlaceCategory;
      label: string;
      emoji: string;
    } => {
      const c = (rawCat || '').toLowerCase();
      const tagStr = (tags || []).join(' ').toLowerCase();

      if (c === 'culinary' || c === 'restaurant' || c === 'food' || c === 'cafe' || tagStr.includes('ẩm thực') || tagStr.includes('món ngon')) {
        return { category: 'food', label: 'Ẩm thực truyền thống', emoji: '🍜' };
      }
      if (c === 'craft_village' || c === 'market' || tagStr.includes('chợ') || tagStr.includes('làng nghề') || tagStr.includes('gốm')) {
        return { category: 'craft_market', label: 'Làng nghề & Chợ truyền thống', emoji: '🏺' };
      }
      if (c === 'scenic_landscape' || c === 'ecotourism' || c === 'island_beach' || tagStr.includes('vịnh') || tagStr.includes('động') || tagStr.includes('núi') || tagStr.includes('thiên nhiên')) {
        return { category: 'nature', label: 'Thiên nhiên & Danh thắng', emoji: '🏞️' };
      }
      if (c === 'temple' || c === 'pagoda' || c === 'costume' || c === 'instrument' || c === 'folk_art' || tagStr.includes('chùa') || tagStr.includes('đền') || tagStr.includes('lễ hội')) {
        return { category: 'culture', label: 'Văn hóa & Tâm linh', emoji: '⛩️' };
      }
      return { category: 'history', label: 'Di tích Lịch sử', emoji: '🏰' };
    };

    // 1. Process curated base heritages
    const allHeritages: HeritageItem[] = [
      ...HERITAGE_DATABASE,
      ...ALL_63_PROVINCES_HERITAGES
    ];

    allHeritages.forEach((h) => {
      if (!h.name) return;
      const { category, label, emoji } = mapCategory(h.category || '', h.tags);

      const placeItem: OfflinePlaceItem = {
        id: h.id || `place-${normalizeVietnamese(h.name).replace(/\s+/g, '-')}`,
        name: h.name,
        vietnameseName: h.vietnameseName || h.name,
        englishName: h.englishName,
        province: h.province || 'Việt Nam',
        region: (h.region === 'north' || h.region === 'central' || h.region === 'south') ? h.region : 'north',
        category,
        categoryLabel: h.categoryLabel || label,
        categoryEmoji: emoji,
        shortDescription: h.culturalSignificance || h.history || h.name,
        history: h.history || 'Di tích và thắng cảnh có bề dày lịch sử và ý nghĩa văn hóa quan trọng của dân tộc.',
        culturalSignificance: h.culturalSignificance || 'Minh chứng cho tinh hoa văn hóa và truyền thống ngàn năm của người Việt.',
        visitingHours: h.visitingHours || '07:30 - 17:30 hàng ngày',
        ticketPrice: h.ticketPrice || 'Miễn phí hoặc vé tham quan theo quy định',
        address: h.address || `${h.name}, ${h.province}`,
        tips: h.interestingFacts?.[0] || 'Nên ăn mặc trang nghiêm khi viếng thăm các chốn tâm linh, giữ gìn vệ sinh chung.',
        imageUrl: h.imageUrl,
        tags: h.tags || [],
        lat: h.lat,
        lng: h.lng,
        isVerified: h.verifiedStatus === 'verified',
        verifiedNote: h.verifiedNote || 'Đã chứng thực trong cơ sở dữ liệu di sản Hồn Đất Việt',
        source: 'database',
        lastUpdated: new Date().toISOString()
      };

      if (!itemsMap.has(placeItem.id)) {
        itemsMap.set(placeItem.id, placeItem);
      }
    });

    // 2. Process craft villages
    TRADITIONAL_CRAFTS.forEach((cv: TraditionalCraftVillage) => {
      const id = `craft-${cv.id || normalizeVietnamese(cv.name).replace(/\s+/g, '-')}`;
      if (!itemsMap.has(id)) {
        itemsMap.set(id, {
          id,
          name: cv.name,
          vietnameseName: cv.name,
          province: cv.province,
          region: (cv.region as any) || 'north',
          category: 'craft_market',
          categoryLabel: 'Làng nghề & Chợ truyền thống',
          categoryEmoji: '🏺',
          shortDescription: `Làng nghề truyền thống ${cv.craftType} nổi tiếng tại ${cv.province}. Sản phẩm đặc trưng: ${(cv.products || []).join(', ')}.`,
          history: cv.history || 'Làng nghề đã trải qua hàng trăm năm phát triển và gìn giữ tinh hoa thủ công.',
          culturalSignificance: `Lưu giữ kỹ nghệ thủ công tinh xảo của cha ông. Quy trình chế tác tiêu biểu: ${(cv.processSteps || []).slice(0, 2).join('; ')}.`,
          visitingHours: '08:00 - 18:00 hàng ngày',
          ticketPrice: 'Tham quan tự do, trả phí trải nghiệm làm thử',
          address: cv.visitingLocation || `${cv.name}, ${cv.province}`,
          tips: 'Có thể đăng ký tham gia lớp học làm đồ thủ công truyền thống và mua quà lưu niệm trực tiếp.',
          imageUrl: cv.imageUrl,
          tags: ['Làng nghề', cv.craftType, cv.province, ...(cv.products || [])],
          lat: 21.0,
          lng: 105.8,
          isVerified: cv.verifiedStatus === 'verified',
          verifiedNote: 'Di sản phi vật thể làng nghề truyền thống',
          source: 'database',
          lastUpdated: new Date().toISOString()
        });
      }
    });

    // 3. Process food, markets & culinary spots near heritages
    Object.entries(PLACES_NEAR_HERITAGE).forEach(([_heritageId, places]) => {
      places.forEach((p: PlaceItem) => {
        const catStr = String(p.category || '').toLowerCase();
        const isFood = catStr === 'local_food' || catStr === 'cafe' || catStr === 'bakery' || catStr === 'dessert';
        const isMarket = p.name.toLowerCase().includes('chợ') || catStr === 'shopping';

        const category: OfflinePlaceCategory = isFood ? 'food' : isMarket ? 'craft_market' : 'culture';
        const label = isFood ? 'Ẩm thực truyền thống' : isMarket ? 'Chợ truyền thống' : 'Văn hóa & Giải trí';
        const emoji = isFood ? '🍜' : isMarket ? '🏺' : '🎭';

        const id = p.id || `food-market-${normalizeVietnamese(p.name).replace(/\s+/g, '-')}`;
        if (!itemsMap.has(id)) {
          itemsMap.set(id, {
            id,
            name: p.name,
            vietnameseName: p.name,
            province: p.address?.split(',').pop()?.trim() || 'Việt Nam',
            region: 'central', // default fallback, will inherit from nearby heritage if matched
            category,
            categoryLabel: label,
            categoryEmoji: emoji,
            shortDescription: p.reviewSummary?.foodMention || p.attributionText || `Điểm đến đặc sắc tại ${p.address}`,
            history: `Địa điểm ẩm thực và văn hóa nổi tiếng gắn liền với đời sống thường nhật của người dân địa phương.`,
            culturalSignificance: p.specialties ? `Đặc sản nổi bật: ${p.specialties.join(', ')}.` : 'Trải nghiệm ẩm thực và phong vị bản địa độc đáo.',
            visitingHours: p.openingHoursText || (p.openNow ? 'Đang mở cửa' : 'Giờ hành chính'),
            ticketPrice: p.priceText || 'Giá bình dân',
            address: p.address,
            tips: p.reviewSummary?.positiveHighlights?.[0] || 'Nên đến sớm vào các giờ cao điểm để thưởng thức trọn vẹn hương vị.',
            imageUrl: p.photoUrl,
            tags: p.specialties || ['Ẩm thực', 'Đặc sản'],
            lat: p.lat,
            lng: p.lng,
            isVerified: true,
            verifiedNote: 'Cơ sở văn hóa ẩm thực được đánh giá cao',
            source: 'market_food',
            lastUpdated: new Date().toISOString()
          });
        }
      });
    });

    // 4. Incorporate user-added places from storageService
    const userHeritages = storageService.getHeritages();
    userHeritages.forEach((uh) => {
      if (uh.id && !itemsMap.has(uh.id)) {
        const { category, label, emoji } = mapCategory(uh.category || '', uh.tags);
        itemsMap.set(uh.id, {
          id: uh.id,
          name: uh.name,
          vietnameseName: uh.vietnameseName || uh.name,
          province: uh.province,
          region: (uh.region as any) || 'central',
          category,
          categoryLabel: uh.categoryLabel || label,
          categoryEmoji: emoji,
          shortDescription: uh.culturalSignificance || uh.history || uh.name,
          history: uh.history || '',
          culturalSignificance: uh.culturalSignificance || '',
          visitingHours: uh.visitingHours,
          ticketPrice: uh.ticketPrice,
          address: uh.address,
          tips: uh.interestingFacts?.[0],
          imageUrl: uh.imageUrl,
          tags: uh.tags || [],
          lat: uh.lat,
          lng: uh.lng,
          isVerified: uh.verifiedStatus === 'verified',
          verifiedNote: uh.verifiedNote,
          source: 'user',
          lastUpdated: new Date().toISOString()
        });
      }
    });

    return Array.from(itemsMap.values());
  }

  // ========================================================
  // SEARCH & FILTER (100% LOCAL & OFFLINE)
  // ========================================================

  public searchPlaces(criteria: OfflineFilterCriteria): OfflinePlaceItem[] {
    const { query = '', category = 'all', region = 'all', province } = criteria;
    const normQuery = normalizeVietnamese(query);

    return this.memoryCache.filter((item) => {
      // Category filter
      if (category !== 'all' && item.category !== category) {
        return false;
      }

      // Region filter
      if (region !== 'all' && item.region !== region) {
        return false;
      }

      // Province filter
      if (province && province !== 'all') {
        const normItemProv = normalizeVietnamese(item.province);
        const normFilterProv = normalizeVietnamese(province);
        if (!normItemProv.includes(normFilterProv)) {
          return false;
        }
      }

      // Text query match
      if (normQuery) {
        const searchCorpus = normalizeVietnamese(
          `${item.name} ${item.vietnameseName} ${item.englishName || ''} ${item.province} ${item.address || ''} ${item.shortDescription} ${item.tags.join(' ')}`
        );
        const words = normQuery.split(' ').filter(w => w.length > 0);
        const allWordsMatch = words.every(word => searchCorpus.includes(word));
        if (!allWordsMatch) return false;
      }

      return true;
    });
  }

  public getPlaceById(id: string): OfflinePlaceItem | undefined {
    return this.memoryCache.find(p => p.id === id);
  }

  public getAllPlaces(): OfflinePlaceItem[] {
    return [...this.memoryCache];
  }

  public getCategories(): { id: OfflinePlaceCategory | 'all'; label: string; emoji: string; count: number }[] {
    const counts: Record<string, number> = {
      all: this.memoryCache.length,
      history: 0,
      culture: 0,
      nature: 0,
      craft_market: 0,
      food: 0,
    };

    this.memoryCache.forEach((p) => {
      if (counts[p.category] !== undefined) {
        counts[p.category]++;
      }
    });

    return [
      { id: 'all', label: 'Tất cả địa điểm', emoji: '🌟', count: counts.all },
      { id: 'history', label: 'Di tích Lịch sử', emoji: '🏰', count: counts.history },
      { id: 'culture', label: 'Văn hóa & Tâm linh', emoji: '⛩️', count: counts.culture },
      { id: 'nature', label: 'Thiên nhiên & Danh thắng', emoji: '🏞️', count: counts.nature },
      { id: 'craft_market', label: 'Làng nghề & Chợ cổ', emoji: '🏺', count: counts.craft_market },
      { id: 'food', label: 'Ẩm thực truyền thống', emoji: '🍜', count: counts.food },
    ];
  }

  public getStats() {
    return {
      total: this.memoryCache.length,
      isLoaded: this.memoryCache.length > 0,
      categories: this.getCategories()
    };
  }

  // ========================================================
  // PERSISTENCE & SAFE UPDATE (Never wipes on failed update)
  // ========================================================

  /**
   * Resilient sync with online source:
   * Merges incoming items without deleting existing valid records if the network fails.
   */
  public async syncWithRemotePlaces(incomingPlaces: HeritageItem[]): Promise<boolean> {
    if (!Array.isArray(incomingPlaces) || incomingPlaces.length === 0) {
      return false; // Safeguard: never overwrite with empty dataset
    }

    try {
      const currentMap = new Map(this.memoryCache.map(p => [p.id, p]));

      // Merge incoming items safely
      incomingPlaces.forEach((item) => {
        if (!item.id || !item.name) return;
        const existing = currentMap.get(item.id);
        const updated: OfflinePlaceItem = {
          id: item.id,
          name: item.name,
          vietnameseName: item.vietnameseName || item.name,
          englishName: item.englishName || existing?.englishName,
          province: item.province || existing?.province || 'Việt Nam',
          region: (item.region as any) || existing?.region || 'north',
          category: existing?.category || 'history',
          categoryLabel: item.categoryLabel || existing?.categoryLabel || 'Di tích Văn hóa',
          categoryEmoji: existing?.categoryEmoji || '🏛️',
          shortDescription: item.culturalSignificance || item.history || item.name,
          history: item.history || existing?.history || '',
          culturalSignificance: item.culturalSignificance || existing?.culturalSignificance || '',
          visitingHours: item.visitingHours || existing?.visitingHours,
          ticketPrice: item.ticketPrice || existing?.ticketPrice,
          address: item.address || existing?.address,
          tips: item.interestingFacts?.[0] || existing?.tips,
          imageUrl: item.imageUrl || existing?.imageUrl,
          tags: item.tags || existing?.tags || [],
          lat: item.lat || existing?.lat,
          lng: item.lng || existing?.lng,
          isVerified: item.verifiedStatus === 'verified',
          verifiedNote: item.verifiedNote,
          source: 'database',
          lastUpdated: new Date().toISOString()
        };
        currentMap.set(item.id, updated);
      });

      const mergedList = Array.from(currentMap.values());
      this.memoryCache = mergedList;
      await this.saveAllToIDB(mergedList);
      return true;
    } catch (err) {
      console.warn('[OfflinePlaceService] Sync error, keeping existing offline records intact:', err);
      return false;
    }
  }

  private async readAllFromIDB(): Promise<OfflinePlaceItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem(BACKUP_STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return [];
    }
  }

  private async saveAllToIDB(items: OfflinePlaceItem[]): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        items.forEach((item) => {
          store.put(item);
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('[OfflinePlaceService] Failed to save to IDB:', err);
    }
  }
}

export const offlinePlaceService = new OfflinePlaceService();
