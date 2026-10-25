import { 
  TourismKnowledgePlace, 
  KnowledgeVerificationStatus, 
  KnowledgeSource,
  KnowledgeVisitorInfo,
  HeritageItem
} from '../types';
import { INITIAL_34_KNOWLEDGE_PLACES } from '../data/tourismKnowledge34';
import { ALL_63_PROVINCES_HERITAGES } from '../data/all63ProvincesHeritages';
import { db, auth } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  writeBatch, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { storageService } from './storageService';

const DB_NAME = 'hdv_tourism_knowledge_db';
const DB_VERSION = 2;
const STORE_PLACES = 'places';
const STORE_META = 'sync_metadata';
const FIRESTORE_COLLECTION = 'tourism_knowledge';

/**
 * Converts a curated heritage item into the TourismKnowledgePlace schema
 */
export function convertHeritageToKnowledgePlace(item: HeritageItem): TourismKnowledgePlace {
  const normProv = normalizeVi(item.province || 'vn').replace(/\s+/g, '-');
  return {
    id: `vn-place-${normProv}-${item.id || normalizeVi(item.name).replace(/\s+/g, '-')}`,
    name: item.name,
    aliases: [
      item.vietnameseName,
      item.englishName,
      ...(item.tags || [])
    ].filter(Boolean) as string[],
    provinceCode: normProv,
    provinceName: item.province,
    category: item.category || 'monument',
    description: item.culturalSignificance || item.history || item.name,
    history: item.history || 'Di sản văn hóa có giá trị lịch sử lâu đời.',
    culturalValue: item.culturalSignificance || 'Minh chứng cho tinh hoa văn hóa truyền thống Việt Nam.',
    address: item.address || `${item.name}, ${item.province}`,
    coordinates: {
      lat: item.lat || 16.0,
      lng: item.lng || 108.0
    },
    visitorInfo: {
      ticketPrice: item.ticketPrice,
      openingHours: item.visitingHours,
      tips: item.interestingFacts?.[0]
    },
    relatedPlaces: [],
    sources: [
      {
        title: item.verifiedNote || 'Kho dữ liệu di sản Hồn Đất Việt & UNESCO',
        verified: item.verifiedStatus === 'verified',
        publisher: 'Cục Di sản Văn hóa Việt Nam'
      }
    ],
    verificationStatus: (item.verifiedStatus as KnowledgeVerificationStatus) || 'verified',
    lastVerifiedAt: '2026-04-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString(),
    imageUrl: item.imageUrl,
    tags: item.tags || []
  };
}

/**
 * Returns complete master dataset covering all 63 provinces of Vietnam
 */
export function getMasterBundledPlaces(): TourismKnowledgePlace[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const results: TourismKnowledgePlace[] = [];

  // 1. Initial 34 verified administrative units
  for (const p of INITIAL_34_KNOWLEDGE_PLACES) {
    seenIds.add(p.id);
    seenNames.add(normalizeVi(p.name));
    results.push(p);
  }

  // 2. Expand across 63 provinces
  for (const h of ALL_63_PROVINCES_HERITAGES) {
    const norm = normalizeVi(h.name);
    if (!seenNames.has(norm)) {
      seenNames.add(norm);
      const place = convertHeritageToKnowledgePlace(h);
      if (!seenIds.has(place.id)) {
        seenIds.add(place.id);
        results.push(place);
      }
    }
  }

  return results;
}

// In-memory fallback cache seeded with 63 provinces dataset
let memoryPlacesCache: TourismKnowledgePlace[] = getMasterBundledPlaces();

/**
 * Open local IndexedDB instance
 */
function openLocalDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PLACES)) {
        const placeStore = db.createObjectStore(STORE_PLACES, { keyPath: 'id' });
        placeStore.createIndex('provinceCode', 'provinceCode', { unique: false });
        placeStore.createIndex('verificationStatus', 'verificationStatus', { unique: false });
        placeStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Text normalizer for Vietnamese search
 */
export function normalizeVi(text: unknown): string {
  return String(text ?? '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Stable slugify ID generator
 */
export function generateStablePlaceId(provinceCode: string, name: string): string {
  const normProvince = normalizeVi(provinceCode || 'vn').replace(/\s+/g, '-');
  const normName = normalizeVi(name).replace(/\s+/g, '-').slice(0, 40);
  return `vn-place-${normProvince}-${normName}`;
}

export interface BatchValidationResult {
  valid: TourismKnowledgePlace[];
  invalid: { item: any; errors: string[] }[];
  existingIds: string[];
}

export class KnowledgeBaseService {
  private isInitialized = false;

  /**
   * Initialize local cache and hydrate from 63 provinces master dataset if empty
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const places = await this.getAllFromIndexedDB();
      const masterList = getMasterBundledPlaces();
      if (places.length < masterList.length) {
        // Hydrate from complete master dataset covering 63 provinces
        await this.savePlacesToIndexedDB(masterList);
        memoryPlacesCache = [...masterList];
        await this.setMetadata('lastSyncTimestamp', new Date().toISOString());
        await this.setMetadata('source', 'bundled_63_provinces');
      } else {
        memoryPlacesCache = places;
      }
      this.isInitialized = true;
    } catch (err) {
      console.warn('IndexedDB initialization failed, falling back to bundled memory dataset:', err);
      memoryPlacesCache = getMasterBundledPlaces();
      this.isInitialized = true;
    }
  }

  // ==========================================
  // INDEXEDDB CRUD OPERATIONS
  // ==========================================

  private async getAllFromIndexedDB(): Promise<TourismKnowledgePlace[]> {
    try {
      const idb = await openLocalDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE_PLACES, 'readonly');
        const store = tx.objectStore(STORE_PLACES);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return memoryPlacesCache;
    }
  }

  private async savePlacesToIndexedDB(places: TourismKnowledgePlace[]): Promise<void> {
    try {
      const idb = await openLocalDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE_PLACES, 'readwrite');
        const store = tx.objectStore(STORE_PLACES);
        for (const place of places) {
          store.put(place);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Could not persist to IndexedDB:', err);
    }
  }

  private async deleteFromIndexedDB(id: string): Promise<void> {
    try {
      const idb = await openLocalDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE_PLACES, 'readwrite');
        const store = tx.objectStore(STORE_PLACES);
        store.delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('Could not delete from IndexedDB:', err);
    }
  }

  async getMetadata(key: string): Promise<any> {
    try {
      const idb = await openLocalDB();
      return new Promise((resolve) => {
        const tx = idb.transaction(STORE_META, 'readonly');
        const store = tx.objectStore(STORE_META);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async setMetadata(key: string, value: any): Promise<void> {
    try {
      const idb = await openLocalDB();
      return new Promise((resolve) => {
        const tx = idb.transaction(STORE_META, 'readwrite');
        const store = tx.objectStore(STORE_META);
        store.put({ key, value, updatedAt: new Date().toISOString() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Ignore
    }
  }

  // ==========================================
  // QUERY & RETRIEVAL (OPTIMIZED FOR 0-DONG)
  // ==========================================

  /**
   * Get all places with optional filtering, prioritizing IndexedDB
   */
  async getPlaces(filters?: {
    provinceCode?: string;
    category?: string;
    verificationStatus?: KnowledgeVerificationStatus;
    searchQuery?: string;
  }): Promise<TourismKnowledgePlace[]> {
    await this.initialize();
    let result = await this.getAllFromIndexedDB();
    if (!result || result.length === 0) {
      result = memoryPlacesCache;
    }

    if (!filters) return result;

    if (filters.provinceCode && filters.provinceCode !== 'all') {
      result = result.filter(p => p.provinceCode === filters.provinceCode);
    }
    if (filters.category && filters.category !== 'all') {
      result = result.filter(p => p.category === filters.category);
    }
    if (filters.verificationStatus && filters.verificationStatus !== 'all' as any) {
      result = result.filter(p => p.verificationStatus === filters.verificationStatus);
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = normalizeVi(filters.searchQuery);
      result = result.filter(p => {
        const name = normalizeVi(p.name);
        const aliases = (p.aliases || []).map(normalizeVi).join(' ');
        const prov = normalizeVi(p.provinceName || '');
        const addr = normalizeVi(p.address || '');
        return name.includes(q) || aliases.includes(q) || prov.includes(q) || addr.includes(q);
      });
    }

    return result;
  }

  /**
   * Get a place by ID
   */
  async getPlaceById(id: string): Promise<TourismKnowledgePlace | null> {
    await this.initialize();
    const places = await this.getAllFromIndexedDB();
    const found = places.find(p => p.id === id);
    if (found) return found;

    // Check memory
    const memFound = memoryPlacesCache.find(p => p.id === id);
    if (memFound) return memFound;

    // Firestore single doc read fallback only if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const docRef = doc(db, FIRESTORE_COLLECTION, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const item = snap.data() as TourismKnowledgePlace;
          await this.savePlacesToIndexedDB([item]);
          return item;
        }
      } catch (err) {
        console.warn('Firestore fetch failed for place:', id, err);
      }
    }
    return null;
  }

  // ==========================================
  // FIRESTORE SYNC & QUOTA OPTIMIZATION
  // ==========================================

  /**
   * Incremental Sync from Firestore to IndexedDB
   * Uses updatedAt > lastSync to avoid reading entire collection repeatedly
   */
  async syncFromFirestore(forceFull = false): Promise<{ syncedCount: number; lastSync: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Thiết bị đang ở chế độ ngoại tuyến, không thể đồng bộ từ máy chủ.');
    }

    const lastSync = forceFull ? null : await this.getMetadata('lastSyncTimestamp');
    let q;

    if (lastSync) {
      q = query(
        collection(db, FIRESTORE_COLLECTION),
        where('updatedAt', '>', lastSync),
        orderBy('updatedAt', 'asc'),
        limit(100)
      );
    } else {
      q = query(
        collection(db, FIRESTORE_COLLECTION),
        orderBy('updatedAt', 'desc'),
        limit(100)
      );
    }

    try {
      const snap = await getDocs(q);
      const incoming: TourismKnowledgePlace[] = [];
      snap.forEach(d => {
        incoming.push(d.data() as TourismKnowledgePlace);
      });

      if (incoming.length > 0) {
        await this.savePlacesToIndexedDB(incoming);
        // Refresh memory cache
        memoryPlacesCache = await this.getAllFromIndexedDB();
      }

      const newTimestamp = new Date().toISOString();
      await this.setMetadata('lastSyncTimestamp', newTimestamp);
      return { syncedCount: incoming.length, lastSync: newTimestamp };
    } catch (err: any) {
      console.warn('Firestore sync failed or permission denied:', err?.message);
      throw err;
    }
  }

  // ==========================================
  // ADMIN CRUD OPERATIONS (FIRESTORE + INDEXEDDB)
  // ==========================================

  /**
   * Save or Update a single place
   */
  async savePlace(placeData: Partial<TourismKnowledgePlace>): Promise<TourismKnowledgePlace> {
    this.assertAdmin();

    const now = new Date().toISOString();
    const id = placeData.id?.trim() || generateStablePlaceId(placeData.provinceCode || 'vn', placeData.name || 'di-tich');

    const sanitizedPlace: TourismKnowledgePlace = {
      id,
      name: placeData.name?.trim() || 'Địa điểm chưa đặt tên',
      aliases: Array.isArray(placeData.aliases) ? placeData.aliases.filter(Boolean) : [],
      provinceCode: placeData.provinceCode?.trim() || '01',
      provinceName: placeData.provinceName?.trim() || '',
      category: placeData.category || 'monument',
      description: placeData.description?.trim() || '',
      history: placeData.history?.trim() || '',
      culturalValue: placeData.culturalValue?.trim() || '',
      address: placeData.address?.trim() || '',
      coordinates: {
        lat: Number(placeData.coordinates?.lat) || 0,
        lng: Number(placeData.coordinates?.lng) || 0
      },
      visitorInfo: placeData.visitorInfo || {},
      relatedPlaces: Array.isArray(placeData.relatedPlaces) ? placeData.relatedPlaces.filter(Boolean) : [],
      sources: Array.isArray(placeData.sources) ? placeData.sources : [],
      verificationStatus: placeData.verificationStatus || 'unverified',
      lastVerifiedAt: placeData.lastVerifiedAt || now,
      createdAt: placeData.createdAt || now,
      updatedAt: now,
      imageUrl: placeData.imageUrl || '',
      tags: Array.isArray(placeData.tags) ? placeData.tags.filter(Boolean) : []
    };

    // 1. Update local IndexedDB and memory
    await this.savePlacesToIndexedDB([sanitizedPlace]);
    const idx = memoryPlacesCache.findIndex(p => p.id === sanitizedPlace.id);
    if (idx >= 0) {
      memoryPlacesCache[idx] = sanitizedPlace;
    } else {
      memoryPlacesCache.unshift(sanitizedPlace);
    }

    // 2. Try Firestore write if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const docRef = doc(db, FIRESTORE_COLLECTION, sanitizedPlace.id);
        await setDoc(docRef, sanitizedPlace, { merge: true });
      } catch (err: any) {
        console.warn('Firestore write failed, place saved locally in IndexedDB:', err?.message);
      }
    }

    return sanitizedPlace;
  }

  /**
   * Delete a place
   */
  async deletePlace(id: string): Promise<void> {
    this.assertAdmin();

    // 1. Delete from local IndexedDB & memory
    await this.deleteFromIndexedDB(id);
    memoryPlacesCache = memoryPlacesCache.filter(p => p.id !== id);

    // 2. Delete from Firestore if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const docRef = doc(db, FIRESTORE_COLLECTION, id);
        await deleteDoc(docRef);
      } catch (err: any) {
        console.warn('Firestore delete failed:', err?.message);
      }
    }
  }

  // ==========================================
  // BATCH IMPORT WITH PREVIEW & DEDUPLICATION
  // ==========================================

  /**
   * Validate raw JSON input for batch import
   */
  async validateBatchInput(rawInput: string): Promise<BatchValidationResult> {
    let parsed: any;
    try {
      parsed = JSON.parse(rawInput);
    } catch (e: any) {
      throw new Error(`Cú pháp JSON không hợp lệ: ${e.message}`);
    }

    const items = Array.isArray(parsed) ? parsed : [parsed];
    const existingPlaces = await this.getPlaces();
    const existingIds = existingPlaces.map(p => p.id);

    const valid: TourismKnowledgePlace[] = [];
    const invalid: { item: any; errors: string[] }[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const errors: string[] = [];

      if (!item || typeof item !== 'object') {
        invalid.push({ item, errors: ['Bản ghi phải là đối tượng JSON'] });
        continue;
      }

      if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        errors.push('Thiếu trường bắt buộc "name" (Tên địa điểm)');
      }
      if (!item.provinceCode || typeof item.provinceCode !== 'string') {
        errors.push('Thiếu trường "provinceCode" (Mã tỉnh/thành)');
      }
      if (!item.history && !item.description) {
        errors.push('Phải có ít nhất thông tin tóm tắt ("description") hoặc lịch sử ("history")');
      }

      const id = item.id?.trim() || generateStablePlaceId(item.provinceCode || 'vn', item.name || `item-${i}`);
      const now = new Date().toISOString();

      if (errors.length > 0) {
        invalid.push({ item, errors });
      } else {
        const sanitized: TourismKnowledgePlace = {
          id,
          name: item.name.trim(),
          aliases: Array.isArray(item.aliases) ? item.aliases.map((a: any) => String(a).trim()).filter(Boolean) : [],
          provinceCode: String(item.provinceCode).trim(),
          provinceName: item.provinceName ? String(item.provinceName).trim() : '',
          category: item.category || 'monument',
          description: String(item.description || item.history || '').trim(),
          history: String(item.history || item.description || '').trim(),
          culturalValue: String(item.culturalValue || '').trim(),
          address: String(item.address || '').trim(),
          coordinates: {
            lat: Number(item.coordinates?.lat) || 0,
            lng: Number(item.coordinates?.lng) || 0
          },
          visitorInfo: item.visitorInfo || {},
          relatedPlaces: Array.isArray(item.relatedPlaces) ? item.relatedPlaces : [],
          sources: Array.isArray(item.sources) ? item.sources : [
            {
              title: item.source || 'Kho dữ liệu tổng hợp',
              verified: item.verificationStatus === 'verified'
            }
          ],
          verificationStatus: (item.verificationStatus as KnowledgeVerificationStatus) || 'unverified',
          lastVerifiedAt: item.lastVerifiedAt || now,
          createdAt: item.createdAt || now,
          updatedAt: now,
          imageUrl: item.imageUrl || '',
          tags: Array.isArray(item.tags) ? item.tags : []
        };
        valid.push(sanitized);
      }
    }

    return { valid, invalid, existingIds };
  }

  /**
   * Commit verified batch records with deduplication strategy
   */
  async commitBatchImport(
    validItems: TourismKnowledgePlace[],
    deduplicationMode: 'skip' | 'overwrite' | 'rename'
  ): Promise<{ inserted: number; updated: number; skipped: number }> {
    this.assertAdmin();

    const existingPlaces = await this.getPlaces();
    const existingMap = new Map(existingPlaces.map(p => [p.id, p]));

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const toSave: TourismKnowledgePlace[] = [];

    for (const item of validItems) {
      if (existingMap.has(item.id)) {
        if (deduplicationMode === 'skip') {
          skipped++;
          continue;
        } else if (deduplicationMode === 'overwrite') {
          updated++;
          toSave.push({
            ...item,
            createdAt: existingMap.get(item.id)?.createdAt || item.createdAt,
            updatedAt: new Date().toISOString()
          });
        } else if (deduplicationMode === 'rename') {
          inserted++;
          const newId = `${item.id}-${Date.now().toString().slice(-4)}`;
          toSave.push({
            ...item,
            id: newId,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        inserted++;
        toSave.push(item);
      }
    }

    if (toSave.length > 0) {
      // 1. Save to IndexedDB
      await this.savePlacesToIndexedDB(toSave);
      // Update memory cache
      memoryPlacesCache = await this.getAllFromIndexedDB();

      // 2. Batch write to Firestore if online
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          const batch = writeBatch(db);
          for (const item of toSave.slice(0, 500)) { // Firestore max batch is 500
            const docRef = doc(db, FIRESTORE_COLLECTION, item.id);
            batch.set(docRef, item, { merge: true });
          }
          await batch.commit();
        } catch (err: any) {
          console.warn('Firestore batch write failed, saved in IndexedDB:', err?.message);
        }
      }
    }

    return { inserted, updated, skipped };
  }

  // ==========================================
  // KNOWLEDGE RETRIEVAL & ANSWER SYNTHESIS
  // (NO GEMINI CALLS WHEN RELEVANT DATA EXISTS)
  // ==========================================

  /**
   * Search knowledge base and synthesize factual answer
   */
  async searchAndSynthesizeAnswer(query: string, currentContextPlaceId?: string): Promise<{
    matched: boolean;
    confidenceScore: number;
    place?: TourismKnowledgePlace;
    answer: string;
    sources: KnowledgeSource[];
  }> {
    await this.initialize();
    const places = await this.getPlaces();
    const qNorm = normalizeVi(query);

    if (!qNorm) {
      return {
        matched: false,
        confidenceScore: 0,
        sources: [],
        answer: 'Xin chào! Bạn muốn tìm hiểu thông tin lịch sử, văn hóa hoặc điểm đến nào của Việt Nam?'
      };
    }

    const tokens = [...new Set(qNorm.split(' ').filter(t => t.length > 1))];

    // Score all records
    const scored = places.map(place => {
      let score = 0;
      const nameNorm = normalizeVi(place.name);
      const provNorm = normalizeVi(place.provinceName || '');
      const addrNorm = normalizeVi(place.address || '');
      const aliasNorms = (place.aliases || []).map(normalizeVi);

      // Context bonus
      if (currentContextPlaceId && place.id === currentContextPlaceId) {
        score += 15;
      }

      // Exact name match
      if (nameNorm === qNorm) score += 40;
      else if (nameNorm.includes(qNorm)) score += 25;
      else if (qNorm.includes(nameNorm)) score += 25;

      // Alias matches
      for (const alias of aliasNorms) {
        if (alias === qNorm) score += 35;
        else if (alias.includes(qNorm) || qNorm.includes(alias)) score += 20;
      }

      // Province match
      if (provNorm && qNorm.includes(provNorm)) score += 10;

      // Token matches
      for (const token of tokens) {
        if (nameNorm.split(' ').includes(token)) score += 6;
        else if (nameNorm.includes(token)) score += 3;

        for (const alias of aliasNorms) {
          if (alias.includes(token)) score += 4;
        }

        if (provNorm.includes(token)) score += 2;
        if (addrNorm.includes(token)) score += 1;
      }

      // Deep text matches in history/culture/desc
      const bodyNorm = normalizeVi(`${place.history} ${place.culturalValue} ${place.description}`);
      for (const token of tokens) {
        if (bodyNorm.includes(token)) score += 0.5;
      }

      return { place, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    // High confidence threshold
    if (!best || best.score < 12) {
      return {
        matched: false,
        confidenceScore: best ? best.score : 0,
        sources: [],
        answer: [
          '⚡ **[KHO TRI THỨC DI SẢN VIỆT NAM]**',
          'Rất tiếc, kho tri thức hiện tại chưa có thông tin chính thức đã xác minh phù hợp với câu hỏi của bạn.',
          'Hệ thống tuân thủ nguyên tắc **không tự ý bịa đặt thông tin** khi chưa có dữ liệu lưu trữ đối sánh.',
          '💡 **Gợi ý tra cứu:** Bạn có thể hỏi về các di sản nổi bật như _Văn Miếu Thăng Long, Cố đô Huế, Phố cổ Hội An, Tràng An Ninh Bình, Thành Nhà Hồ, Đền Hùng, Mũi Cà Mau..._ hoặc nhập tên tỉnh/thành cụ thể.'
        ].join('\n\n')
      };
    }

    const p = best.place;
    const sourcesList = p.sources && p.sources.length > 0 ? p.sources : [];

    const answerLines: string[] = [
      `🏛️ **${p.name}**`,
      p.address ? `📍 **Địa chỉ:** ${p.address}` : '',
      p.provinceName ? `🗺️ **Tỉnh / Thành phố:** ${p.provinceName}` : '',
      p.description ? `✨ **Tổng quan:** ${p.description}` : '',
      p.history ? `📜 **Lịch sử & Nguồn gốc:**\n${p.history}` : '',
      p.culturalValue ? `💎 **Giá trị văn hóa - tâm linh:**\n${p.culturalValue}` : ''
    ];

    if (p.visitorInfo) {
      const v = p.visitorInfo;
      const vLines = [
        v.openingHours ? `• ⏰ Giờ mở cửa: ${v.openingHours}` : '',
        v.ticketPrice ? `• 🎫 Giá vé: ${v.ticketPrice}` : '',
        v.bestTimeToVisit ? `• 🌤️ Thời điểm lý tưởng: ${v.bestTimeToVisit}` : '',
        v.dressCode ? `• 👗 Trang phục: ${v.dressCode}` : '',
        v.tips ? `• 💡 Lưu ý du khách: ${v.tips}` : ''
      ].filter(Boolean);

      if (vLines.length > 0) {
        answerLines.push(`📋 **Thông tin tham quan:**\n${vLines.join('\n')}`);
      }
    }

    // Append Sources & Verification Citation
    const statusLabel = p.verificationStatus === 'verified'
      ? '✅ Đã xác minh chính thức từ hồ sơ di sản'
      : (p.verificationStatus === 'folk_legend' ? '📖 Huyền tích / Truyền thuyết dân gian' : '⚠️ Đang chờ kiểm duyệt hồ sơ');

    answerLines.push(`🛡️ **Trạng thái lưu trữ:** ${statusLabel}`);

    if (sourcesList.length > 0) {
      const srcText = sourcesList.map(s => `• ${s.title}${s.publisher ? ` (${s.publisher})` : ''}${s.year ? ` - ${s.year}` : ''}`).join('\n');
      answerLines.push(`📚 **Nguồn tham chiếu đối sánh:**\n${srcText}`);
    }

    return {
      matched: true,
      confidenceScore: best.score,
      place: p,
      sources: sourcesList,
      answer: answerLines.filter(Boolean).join('\n\n')
    };
  }

  // ==========================================
  // SECURITY & ROLE VALIDATION
  // ==========================================

  private assertAdmin(): void {
    const curUser = storageService.getCurrentUser();
    const fbUser = auth.currentUser;
    const isLocalAdmin = curUser && (curUser.role === 'admin' || curUser.email === 'btin2499@gmail.com');
    const isFbAdmin = fbUser && (fbUser.email === 'btin2499@gmail.com');

    if (!isLocalAdmin && !isFbAdmin) {
      throw new Error('Từ chối quyền truy cập: Bạn cần có vai trò Quản trị viên (Admin) để thực hiện thao tác này.');
    }
  }

  /**
   * Reset local database to initial 34 provinces seed
   */
  async resetToSeedData(): Promise<void> {
    this.assertAdmin();
    await this.savePlacesToIndexedDB(INITIAL_34_KNOWLEDGE_PLACES);
    memoryPlacesCache = [...INITIAL_34_KNOWLEDGE_PLACES];
    await this.setMetadata('lastSyncTimestamp', new Date().toISOString());
  }

  /**
   * Export all places as formatted JSON for offline backup / download
   */
  async exportJSON(): Promise<string> {
    const places = await this.getPlaces();
    return JSON.stringify(places, null, 2);
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
