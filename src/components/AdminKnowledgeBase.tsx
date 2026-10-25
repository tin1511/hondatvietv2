import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Plus, 
  Upload, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Trash2, 
  Edit, 
  FileText, 
  ShieldCheck, 
  ExternalLink, 
  HelpCircle, 
  Sparkles,
  MapPin,
  Clock,
  BookOpen,
  Filter,
  Check,
  Layers,
  Eye,
  Info
} from 'lucide-react';
import { 
  TourismKnowledgePlace, 
  KnowledgeVerificationStatus, 
  KnowledgeSource,
  KnowledgeVisitorInfo 
} from '../types';
import { knowledgeBaseService, BatchValidationResult } from '../services/knowledgeBaseService';
import { VIETNAM_PROVINCES } from '../data/vietnamProvincesData';

export const AdminKnowledgeBase: React.FC = () => {
  const [places, setPlaces] = useState<TourismKnowledgePlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Modals
  const [editingPlace, setEditingPlace] = useState<Partial<TourismKnowledgePlace> | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isQaTesterOpen, setIsQaTesterOpen] = useState(false);
  const [selectedPlaceDetail, setSelectedPlaceDetail] = useState<TourismKnowledgePlace | null>(null);

  // Batch import state
  const [batchRawJson, setBatchRawJson] = useState('');
  const [batchValidation, setBatchValidation] = useState<BatchValidationResult | null>(null);
  const [dedupMode, setDedupMode] = useState<'skip' | 'overwrite' | 'rename'>('skip');
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Q&A Tester state
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingQa, setIsTestingQa] = useState(false);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    loadPlaces();
    loadSyncMeta();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadPlaces = async () => {
    try {
      setLoading(true);
      const data = await knowledgeBaseService.getPlaces();
      setPlaces(data);
    } catch (err: any) {
      showToast('Lỗi khi tải kho tri thức: ' + (err?.message || ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSyncMeta = async () => {
    try {
      const sync = await knowledgeBaseService.getMetadata('lastSyncTimestamp');
      setLastSyncTime(sync);
    } catch {
      // Ignore
    }
  };

  // Filtered places
  const filteredPlaces = places.filter(p => {
    if (selectedProvince !== 'all' && p.provinceCode !== selectedProvince) return false;
    if (selectedStatus !== 'all' && p.verificationStatus !== selectedStatus) return false;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchProv = (p.provinceName || '').toLowerCase().includes(q);
      const matchAliases = (p.aliases || []).some(a => a.toLowerCase().includes(q));
      const matchAddr = (p.address || '').toLowerCase().includes(q);
      return matchName || matchProv || matchAliases || matchAddr;
    }
    return true;
  });

  // Calculate statistics
  const verifiedCount = places.filter(p => p.verificationStatus === 'verified').length;
  const folkCount = places.filter(p => p.verificationStatus === 'folk_legend').length;
  const unverifiedCount = places.filter(p => p.verificationStatus === 'unverified').length;
  const uniqueProvinces = new Set(places.map(p => p.provinceCode)).size;

  // Save place
  const handleSavePlace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlace?.name || !editingPlace.name.trim()) {
      showToast('Vui lòng nhập tên địa điểm', 'error');
      return;
    }

    try {
      await knowledgeBaseService.savePlace(editingPlace);
      showToast(`Đã lưu địa điểm "${editingPlace.name}" vào kho tri thức thành công!`);
      setIsEditModalOpen(false);
      setEditingPlace(null);
      loadPlaces();
    } catch (err: any) {
      showToast('Lỗi khi lưu địa điểm: ' + (err?.message || ''), 'error');
    }
  };

  // Delete place
  const handleDeletePlace = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa địa điểm "${name}" khỏi kho tri thức?`)) return;
    try {
      await knowledgeBaseService.deletePlace(id);
      showToast(`Đã xóa "${name}" thành công`);
      loadPlaces();
    } catch (err: any) {
      showToast('Lỗi khi xóa: ' + (err?.message || ''), 'error');
    }
  };

  // Cloud Sync
  const handleCloudSync = async () => {
    try {
      setIsSyncing(true);
      const res = await knowledgeBaseService.syncFromFirestore();
      setLastSyncTime(res.lastSync);
      showToast(`Đã đồng bộ ${res.syncedCount} bản ghi mới từ Firestore thành công!`);
      loadPlaces();
    } catch (err: any) {
      showToast('Đồng bộ thất bại: ' + (err?.message || 'Kiểm tra kết nối mạng'), 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Export JSON
  const handleExportJSON = async () => {
    try {
      const json = await knowledgeBaseService.exportJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vietnam_tourism_knowledge_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Đã tải xuống tệp sao lưu kho tri thức du lịch.');
    } catch (err: any) {
      showToast('Lỗi khi xuất tệp: ' + err?.message, 'error');
    }
  };

  // Reset to initial 34 provinces
  const handleResetToSeed = async () => {
    if (!confirm('Khôi phục kho tri thức về bộ dữ liệu chuẩn 34 đơn vị hành chính đã xác minh? Thao tác này sẽ ghi đè các bản ghi trùng lặp.')) return;
    try {
      await knowledgeBaseService.resetToSeedData();
      showToast('Đã khôi phục thành công 34 đơn vị hành chính chuẩn!');
      loadPlaces();
    } catch (err: any) {
      showToast('Lỗi khôi phục: ' + err?.message, 'error');
    }
  };

  // Validate batch
  const handleValidateBatch = async () => {
    if (!batchRawJson.trim()) {
      showToast('Vui lòng nhập hoặc dán nội dung JSON', 'error');
      return;
    }
    try {
      const res = await knowledgeBaseService.validateBatchInput(batchRawJson);
      setBatchValidation(res);
    } catch (err: any) {
      showToast(err.message, 'error');
      setBatchValidation(null);
    }
  };

  // Commit batch
  const handleCommitBatch = async () => {
    if (!batchValidation || batchValidation.valid.length === 0) return;
    try {
      setIsProcessingBatch(true);
      const res = await knowledgeBaseService.commitBatchImport(batchValidation.valid, dedupMode);
      showToast(`Nhập dữ liệu thành công: ${res.inserted} bản ghi mới, ${res.updated} cập nhật, ${res.skipped} bỏ qua.`);
      setIsBatchModalOpen(false);
      setBatchRawJson('');
      setBatchValidation(null);
      loadPlaces();
    } catch (err: any) {
      showToast('Lỗi khi nhập dữ liệu: ' + err?.message, 'error');
    } finally {
      setIsProcessingBatch(false);
    }
  };

  // Load sample JSON into batch textarea
  const handleLoadSampleBatch = () => {
    const sample = [
      {
        id: "vn-place-hanoi-hoang-thanh-thang-long",
        name: "Khu Di tích Hoàng thành Thăng Long",
        aliases: ["Hoàng thành Thăng Long", "Thành cổ Hà Nội", "Imperial Citadel of Thang Long", "Đoan Môn", "Điện Kính Thiên"],
        provinceCode: "01",
        provinceName: "Thành phố Hà Nội",
        category: "citadel",
        description: "Quần thể di tích gắn với lịch sử kinh thành Thăng Long từ thời tiền Thăng Long thế kỷ VII qua thời Đinh - Tiền Lê, phát triển rực rỡ dưới thời Lý, Trần, Lê và thành Hà Nội thời Nguyễn.",
        history: "Năm 1010, vua Lý Thái Tổ ban Chiếu dời đô từ Hoa Lư về thành Đại La và đổi tên là Thăng Long, cho xây dựng Hoàng thành kiên cố. Trải qua hơn 1.000 năm lịch sử, nơi đây lưu giữ các tầng văn hóa khảo cổ xếp chồng lên nhau liên tục.",
        culturalValue: "Được UNESCO công nhận là Di sản Văn hóa Thế giới năm 2010. Tiêu biểu cho sự giao thoa văn hóa Á Đông và nghệ thuật kiến trúc thành quách độc đáo.",
        address: "19C Hoàng Diệu, Quán Thánh, Ba Đình, Hà Nội",
        coordinates: { lat: 21.0347, lng: 105.8398 },
        visitorInfo: {
          ticketPrice: "30.000 VNĐ / người lớn (Giảm 50% cho học sinh, sinh viên, người cao tuổi)",
          openingHours: "08:00 - 17:00 hàng ngày (Mở cửa tour đêm Giải mã Hoàng thành Thăng Long)",
          bestTimeToVisit: "Mùa thu từ tháng 9 đến tháng 11"
        },
        sources: [
          {
            title: "Hồ sơ Di sản Thế giới Hoàng thành Thăng Long - Hà Nội",
            publisher: "UNESCO World Heritage Centre",
            year: 2010,
            verified: true
          }
        ],
        verificationStatus: "verified",
        lastVerifiedAt: "2025-01-15T00:00:00Z"
      }
    ];
    setBatchRawJson(JSON.stringify(sample, null, 2));
    setBatchValidation(null);
  };

  // Test Q&A Search
  const handleRunQaTest = async () => {
    if (!testQuery.trim()) return;
    try {
      setIsTestingQa(true);
      const res = await knowledgeBaseService.searchAndSynthesizeAnswer(testQuery);
      setTestResult(res);
    } catch (err: any) {
      showToast('Lỗi thử nghiệm hỏi đáp: ' + err?.message, 'error');
    } finally {
      setIsTestingQa(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between shadow-xl transition-all ${
          feedback.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' 
            : 'bg-red-950/90 border-red-500/50 text-red-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-medium">Tổng địa điểm</div>
            <div className="text-xl font-bold text-stone-100">{places.length}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-medium">Đã xác minh</div>
            <div className="text-xl font-bold text-emerald-400">{verifiedCount}</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-medium">Đơn vị hành chính</div>
            <div className="text-xl font-bold text-blue-400">{uniqueProvinces} tỉnh/thành</div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400 font-medium">Huyền tích / Dân gian</div>
            <div className="text-xl font-bold text-purple-400">{folkCount}</div>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingPlace({
                  category: 'monument',
                  verificationStatus: 'verified',
                  sources: [{ title: '', publisher: '', verified: true }],
                  aliases: [],
                  coordinates: { lat: 21.0285, lng: 105.8542 }
                });
                setIsEditModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm địa điểm</span>
            </button>

            <button
              onClick={() => {
                setBatchRawJson('');
                setBatchValidation(null);
                setIsBatchModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Nhập JSON hàng loạt</span>
            </button>

            <button
              onClick={() => {
                setTestQuery('');
                setTestResult(null);
                setIsQaTesterOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Thử nghiệm Hỏi Đáp Tri Thức</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCloudSync}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs flex items-center gap-1.5 transition-colors"
              title="Đồng bộ từ Firebase Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ Firestore'}</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition-colors"
              title="Xuất file JSON sao lưu ngoại tuyến"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={handleResetToSeed}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-400 text-xs transition-colors"
              title="Khôi phục 34 đơn vị hành chính chuẩn"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-stone-800/80">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên, từ đồng nghĩa, địa chỉ..."
              className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="all">Tất cả tỉnh / thành ({uniqueProvinces} đơn vị)</option>
              {VIETNAM_PROVINCES.map((prov) => (
                <option key={prov.id} value={prov.code || prov.id}>
                  {prov.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="all">Tất cả trạng thái xác minh</option>
              <option value="verified">✅ Đã xác minh chính thức ({verifiedCount})</option>
              <option value="folk_legend">📖 Huyền tích / Dân gian ({folkCount})</option>
              <option value="unverified">⚠️ Chờ duyệt ({unverifiedCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="px-4 py-2.5 rounded-xl bg-stone-900/60 border border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Kho lưu trữ cục bộ: <strong>IndexedDB (0đ chi phí vận hành)</strong></span>
          <span>•</span>
          <span>Đồng bộ gần nhất: <strong>{lastSyncTime ? new Date(lastSyncTime).toLocaleString('vi-VN') : 'Mặc định đóng gói'}</strong></span>
        </div>
        <span className="text-stone-500 hidden sm:inline">Tự động trả lời ngoại tuyến không tiêu tốn quota Gemini</span>
      </div>

      {/* Places List Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
              <tr>
                <th className="px-4 py-3">Địa điểm / Danh thắng</th>
                <th className="px-4 py-3">Tỉnh / Thành</th>
                <th className="px-4 py-3">Phân loại</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Nguồn tham chiếu</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-500" />
                    Đang tải danh sách kho tri thức...
                  </td>
                </tr>
              ) : filteredPlaces.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                    Không tìm thấy địa điểm nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredPlaces.map((place) => (
                  <tr key={place.id} className="hover:bg-stone-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-stone-100 flex items-center gap-1.5">
                        <span>{place.name}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 line-clamp-1 font-mono">
                        ID: {place.id}
                      </div>
                      {place.aliases && place.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {place.aliases.slice(0, 3).map((alias, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 text-[9px]">
                              {alias}
                            </span>
                          ))}
                          {place.aliases.length > 3 && (
                            <span className="text-[9px] text-stone-500">+{place.aliases.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span className="text-stone-300 font-medium">{place.provinceName || place.provinceCode}</span>
                    </td>

                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 text-[10px]">
                        {place.category}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {place.verificationStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                          <CheckCircle className="w-3 h-3" /> Đã xác minh
                        </span>
                      ) : place.verificationStatus === 'folk_legend' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold">
                          <BookOpen className="w-3 h-3" /> Huyền tích
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-semibold">
                          <AlertTriangle className="w-3 h-3" /> Chưa duyệt
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-[11px] text-stone-400">
                        {place.sources && place.sources.length > 0 ? (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <Check className="w-3 h-3" />
                            <span>{place.sources.length} nguồn tài liệu</span>
                          </div>
                        ) : (
                          <span className="text-stone-500 italic">Chưa có nguồn</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedPlaceDetail(place)}
                          className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                          title="Xem chi tiết & nguồn kiểm duyệt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingPlace({ ...place });
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-stone-800 hover:bg-amber-500 hover:text-stone-950 text-stone-300 transition-colors"
                          title="Chỉnh sửa bản ghi"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePlace(place.id, place.name)}
                          className="p-1.5 rounded-lg bg-stone-800 hover:bg-red-500 hover:text-white text-stone-400 transition-colors"
                          title="Xóa địa điểm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT PLACE                                */}
      {/* ======================================================== */}
      {isEditModalOpen && editingPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-6">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-500" />
                <h3 className="text-base sm:text-lg font-bold text-stone-100 font-serif">
                  {editingPlace.id ? 'Chỉnh Sửa Địa Điểm Tri Thức' : 'Thêm Địa Điểm Mới Vào Kho Tri Thức'}
                </h3>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlace} className="space-y-4 text-xs">
              {/* Name & ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-400 mb-1 font-semibold">Tên địa điểm *</label>
                  <input
                    type="text"
                    required
                    value={editingPlace.name || ''}
                    onChange={(e) => setEditingPlace({ ...editingPlace, name: e.target.value })}
                    placeholder="VD: Văn Miếu - Quốc Tử Giám"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-stone-400 mb-1 font-semibold">Mã định danh ID (Để trống để tự tạo slug)</label>
                  <input
                    type="text"
                    value={editingPlace.id || ''}
                    onChange={(e) => setEditingPlace({ ...editingPlace, id: e.target.value })}
                    placeholder="vn-place-hanoi-van-mieu"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Province & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-400 mb-1 font-semibold">Tỉnh / Thành phố *</label>
                  <select
                    value={editingPlace.provinceCode || '01'}
                    onChange={(e) => {
                      const code = e.target.value;
                      const prov = VIETNAM_PROVINCES.find(p => p.code === code || p.id === code);
                      setEditingPlace({
                        ...editingPlace,
                        provinceCode: code,
                        provinceName: prov ? prov.name : ''
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    {VIETNAM_PROVINCES.map((prov) => (
                      <option key={prov.id} value={prov.code || prov.id}>
                        {prov.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-stone-400 mb-1 font-semibold">Phân loại di sản / danh thắng</label>
                  <select
                    value={editingPlace.category || 'monument'}
                    onChange={(e) => setEditingPlace({ ...editingPlace, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="monument">Di tích lịch sử (monument)</option>
                    <option value="temple">Đền / Chùa / Tâm linh (temple)</option>
                    <option value="citadel">Thành quách / Kinh thành (citadel)</option>
                    <option value="palace">Cung điện / Dinh thự (palace)</option>
                    <option value="ancient_house">Phố cổ / Nhà cổ (ancient_house)</option>
                    <option value="scenic_landscape">Danh lam thắng cảnh (scenic_landscape)</option>
                    <option value="ecotourism">Sinh thái / Vườn quốc gia (ecotourism)</option>
                    <option value="community_tourism">Du lịch cộng đồng (community_tourism)</option>
                  </select>
                </div>
              </div>

              {/* Aliases */}
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">
                  Tên đồng nghĩa / Tên gọi khác (Phân cách bằng dấu phẩy)
                </label>
                <input
                  type="text"
                  value={(editingPlace.aliases || []).join(', ')}
                  onChange={(e) => setEditingPlace({
                    ...editingPlace,
                    aliases: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  placeholder="VD: Văn Miếu, Temple of Literature, Khuê Văn Các..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Mô tả tóm tắt</label>
                <textarea
                  rows={2}
                  value={editingPlace.description || ''}
                  onChange={(e) => setEditingPlace({ ...editingPlace, description: e.target.value })}
                  placeholder="Tóm tắt ngắn gọn đặc điểm nổi bật..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* History */}
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Lịch sử & Niên đại hình thành</label>
                <textarea
                  rows={3}
                  value={editingPlace.history || ''}
                  onChange={(e) => setEditingPlace({ ...editingPlace, history: e.target.value })}
                  placeholder="Lịch sử chi tiết, thời kỳ xây dựng, các nhân vật lịch sử gắn liền..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Cultural Value */}
              <div>
                <label className="block text-stone-400 mb-1 font-semibold">Giá trị văn hóa & Nghệ thuật</label>
                <textarea
                  rows={2}
                  value={editingPlace.culturalValue || ''}
                  onChange={(e) => setEditingPlace({ ...editingPlace, culturalValue: e.target.value })}
                  placeholder="Ý nghĩa văn hóa, kiến trúc, tâm linh, di sản UNESCO..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Address & Coordinates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-stone-400 mb-1 font-semibold">Địa chỉ cụ thể</label>
                  <input
                    type="text"
                    value={editingPlace.address || ''}
                    onChange={(e) => setEditingPlace({ ...editingPlace, address: e.target.value })}
                    placeholder="Số 58 Quốc Tử Giám, Hà Nội"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-stone-400 mb-1 font-semibold">Vĩ độ (Lat)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingPlace.coordinates?.lat ?? 0}
                    onChange={(e) => setEditingPlace({
                      ...editingPlace,
                      coordinates: {
                        lat: parseFloat(e.target.value) || 0,
                        lng: editingPlace.coordinates?.lng ?? 0
                      }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-stone-400 mb-1 font-semibold">Kinh độ (Lng)</label>
                  <input
                    type="number"
                    step="any"
                    value={editingPlace.coordinates?.lng ?? 0}
                    onChange={(e) => setEditingPlace({
                      ...editingPlace,
                      coordinates: {
                        lat: editingPlace.coordinates?.lat ?? 0,
                        lng: parseFloat(e.target.value) || 0
                      }
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Visitor Info */}
              <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80 space-y-3">
                <div className="font-semibold text-stone-300">Thông tin tham quan du khách</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-400 mb-1">Giá vé</label>
                    <input
                      type="text"
                      value={editingPlace.visitorInfo?.ticketPrice || ''}
                      onChange={(e) => setEditingPlace({
                        ...editingPlace,
                        visitorInfo: { ...editingPlace.visitorInfo, ticketPrice: e.target.value }
                      })}
                      placeholder="VD: 70.000 VNĐ / người lớn"
                      className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-100"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-400 mb-1">Giờ mở cửa</label>
                    <input
                      type="text"
                      value={editingPlace.visitorInfo?.openingHours || ''}
                      onChange={(e) => setEditingPlace({
                        ...editingPlace,
                        visitorInfo: { ...editingPlace.visitorInfo, openingHours: e.target.value }
                      })}
                      placeholder="08:00 - 17:00 hàng ngày"
                      className="w-full px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-100"
                    />
                  </div>
                </div>
              </div>

              {/* Verification Status & Sources */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-400 mb-1 font-semibold">Trạng thái xác minh</label>
                  <select
                    value={editingPlace.verificationStatus || 'verified'}
                    onChange={(e) => setEditingPlace({
                      ...editingPlace,
                      verificationStatus: e.target.value as KnowledgeVerificationStatus
                    })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="verified">✅ Đã xác minh chính thức từ tài liệu/hồ sơ</option>
                    <option value="folk_legend">📖 Huyền tích / Truyền thuyết dân gian</option>
                    <option value="unverified">⚠️ Chưa qua thẩm định</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-400 mb-1 font-semibold">Ảnh đại diện (URL)</label>
                  <input
                    type="url"
                    value={editingPlace.imageUrl || ''}
                    onChange={(e) => setEditingPlace({ ...editingPlace, imageUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Sources Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-stone-300">Nguồn đối sánh & Thư mục tham chiếu</label>
                  <button
                    type="button"
                    onClick={() => {
                      const curSources = editingPlace.sources || [];
                      setEditingPlace({
                        ...editingPlace,
                        sources: [...curSources, { title: '', publisher: '', verified: true }]
                      });
                    }}
                    className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm nguồn
                  </button>
                </div>

                {(editingPlace.sources || []).map((source, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Tên tài liệu / Hồ sơ di tích..."
                      value={source.title}
                      onChange={(e) => {
                        const newSources = [...(editingPlace.sources || [])];
                        newSources[idx] = { ...newSources[idx], title: e.target.value };
                        setEditingPlace({ ...editingPlace, sources: newSources });
                      }}
                      className="flex-1 px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100"
                    />
                    <input
                      type="text"
                      placeholder="Nhà xuất bản / Cơ quan cấp..."
                      value={source.publisher || ''}
                      onChange={(e) => {
                        const newSources = [...(editingPlace.sources || [])];
                        newSources[idx] = { ...newSources[idx], publisher: e.target.value };
                        setEditingPlace({ ...editingPlace, sources: newSources });
                      }}
                      className="w-48 px-3 py-2 rounded-lg bg-stone-950 border border-stone-800 text-stone-100"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newSources = (editingPlace.sources || []).filter((_, i) => i !== idx);
                        setEditingPlace({ ...editingPlace, sources: newSources });
                      }}
                      className="p-2 text-stone-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow-lg transition-colors"
                >
                  Lưu bản ghi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: BATCH JSON IMPORT WITH PREVIEW & DEDUP         */}
      {/* ======================================================== */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-3xl w-full p-6 shadow-2xl my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" />
                <h3 className="text-base sm:text-lg font-bold text-stone-100 font-serif">
                  Nhập Dữ Liệu Hàng Loạt (Batch JSON Import)
                </h3>
              </div>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-stone-400">
                  Dán mảng JSON các địa điểm hoặc nhập đối tượng đơn lẻ theo đúng Schema.
                </span>
                <button
                  onClick={handleLoadSampleBatch}
                  className="text-amber-400 hover:text-amber-300 font-semibold underline"
                >
                  Tải mẫu JSON hợp lệ
                </button>
              </div>

              <textarea
                rows={10}
                value={batchRawJson}
                onChange={(e) => {
                  setBatchRawJson(e.target.value);
                  setBatchValidation(null);
                }}
                placeholder="[ { &quot;name&quot;: &quot;...&quot;, &quot;provinceCode&quot;: &quot;01&quot;, ... } ]"
                className="w-full p-3.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 font-mono text-[11px] focus:outline-none focus:border-amber-500 custom-scrollbar"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleValidateBatch}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold transition-colors"
                >
                  Kiểm tra cú pháp & Schema (Validate)
                </button>

                {batchValidation && (
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-emerald-400 font-semibold">
                      ✓ Hợp lệ: {batchValidation.valid.length} bản ghi
                    </span>
                    {batchValidation.invalid.length > 0 && (
                      <span className="text-red-400 font-semibold">
                        ✗ Lỗi: {batchValidation.invalid.length} bản ghi
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Deduplication strategy */}
              {batchValidation && batchValidation.valid.length > 0 && (
                <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
                  <div className="font-semibold text-stone-200">
                    Chiến lược xử lý trùng lặp (Deduplication):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <label className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      dedupMode === 'skip' ? 'bg-amber-500/10 border-amber-500 text-amber-300' : 'bg-stone-900 border-stone-800 text-stone-400'
                    }`}>
                      <input
                        type="radio"
                        name="dedup"
                        checked={dedupMode === 'skip'}
                        onChange={() => setDedupMode('skip')}
                        className="mr-2"
                      />
                      <span className="font-semibold">Bỏ qua (Skip)</span>
                      <p className="text-[10px] text-stone-500 mt-1">Giữ nguyên bản ghi cũ nếu trùng ID</p>
                    </label>

                    <label className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      dedupMode === 'overwrite' ? 'bg-amber-500/10 border-amber-500 text-amber-300' : 'bg-stone-900 border-stone-800 text-stone-400'
                    }`}>
                      <input
                        type="radio"
                        name="dedup"
                        checked={dedupMode === 'overwrite'}
                        onChange={() => setDedupMode('overwrite')}
                        className="mr-2"
                      />
                      <span className="font-semibold">Ghi đè (Overwrite)</span>
                      <p className="text-[10px] text-stone-500 mt-1">Cập nhật nội dung mới cho ID trùng</p>
                    </label>

                    <label className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      dedupMode === 'rename' ? 'bg-amber-500/10 border-amber-500 text-amber-300' : 'bg-stone-900 border-stone-800 text-stone-400'
                    }`}>
                      <input
                        type="radio"
                        name="dedup"
                        checked={dedupMode === 'rename'}
                        onChange={() => setDedupMode('rename')}
                        className="mr-2"
                      />
                      <span className="font-semibold">Đổi ID mới (Rename)</span>
                      <p className="text-[10px] text-stone-500 mt-1">Tạo ID phụ để giữ cả hai bản ghi</p>
                    </label>
                  </div>

                  {batchValidation.invalid.length > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 space-y-1">
                      <div className="font-semibold text-red-200">Chi tiết lỗi các bản ghi không hợp lệ:</div>
                      {batchValidation.invalid.map((inv, idx) => (
                        <div key={idx} className="text-[11px]">
                          • <strong>{inv.item?.name || `Bản ghi #${idx + 1}`}:</strong> {inv.errors.join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={!batchValidation || batchValidation.valid.length === 0 || isProcessingBatch}
                  onClick={handleCommitBatch}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-bold shadow-lg transition-colors flex items-center gap-2"
                >
                  {isProcessingBatch && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>Nhập {batchValidation?.valid.length || 0} bản ghi hợp lệ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: Q&A RETRIEVER TEST TOOL                        */}
      {/* ======================================================== */}
      {isQaTesterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-base sm:text-lg font-bold text-stone-100 font-serif">
                  Thử Nghiệm Hỏi Đáp Tri Thức (Q&A Simulation)
                </h3>
              </div>
              <button onClick={() => setIsQaTesterOpen(false)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-stone-400">
                Nhập câu hỏi để kiểm tra công cụ tra cứu tri thức tự động. Hệ thống sẽ truy xuất trực tiếp từ IndexedDB và trích xuất nguồn đối sánh, <strong>không gọi mô hình Gemini</strong> khi tìm thấy dữ liệu phù hợp.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunQaTest()}
                  placeholder="VD: Văn Miếu Thăng Long có bao nhiêu bia tiến sĩ? hoặc Đỉnh Fansipan ở đâu?"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleRunQaTest}
                  disabled={isTestingQa}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors flex items-center gap-1.5"
                >
                  {isTestingQa ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>Tra cứu</span>
                </button>
              </div>

              {/* Sample Queries */}
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[11px] text-stone-500">Thử câu hỏi mẫu:</span>
                {[
                  'Văn Miếu Thăng Long',
                  'Kinh thành Cố đô Huế',
                  'Phố cổ Hội An có di tích gì',
                  'Hang Múa Tràng An Ninh Bình',
                  'Núi Bà Đen cao bao nhiêu'
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTestQuery(sample);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px]"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {/* QA Result Output */}
              {testResult && (
                <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        testResult.matched 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {testResult.matched ? '✓ Khớp dữ liệu thành công' : '⚠ Không tìm thấy bản ghi'}
                      </span>
                      <span className="text-stone-400 text-[11px]">
                        Điểm tin cậy: <strong>{testResult.confidenceScore}</strong>
                      </span>
                    </div>

                    <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Chi phí: 0đ (Không gọi Gemini)</span>
                    </div>
                  </div>

                  {testResult.place && (
                    <div className="text-[11px] text-stone-400 bg-stone-900/60 p-2.5 rounded-xl border border-stone-800/80">
                      <div>📍 <strong>Bản ghi khớp:</strong> {testResult.place.name} ({testResult.place.provinceName || testResult.place.provinceCode})</div>
                      <div>🏷️ <strong>Tên đồng nghĩa:</strong> {(testResult.place.aliases || []).join(', ')}</div>
                    </div>
                  )}

                  <div className="p-3.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 whitespace-pre-line leading-relaxed">
                    {testResult.answer}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: PLACE DETAILS & SOURCE AUDIT                   */}
      {/* ======================================================== */}
      {selectedPlaceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between pb-4 border-b border-stone-800 mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <h3 className="text-base sm:text-lg font-bold text-stone-100 font-serif">
                  {selectedPlaceDetail.name}
                </h3>
              </div>
              <button onClick={() => setSelectedPlaceDetail(null)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-stone-300">
              {selectedPlaceDetail.imageUrl && (
                <div className="h-44 rounded-2xl overflow-hidden border border-stone-800">
                  <img
                    src={selectedPlaceDetail.imageUrl}
                    alt={selectedPlaceDetail.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-stone-500 block">Địa phương:</span>
                  <span className="font-semibold text-stone-200">{selectedPlaceDetail.provinceName}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800">
                  <span className="text-stone-500 block">Trạng thái xác minh:</span>
                  <span className="font-semibold text-emerald-400">{selectedPlaceDetail.verificationStatus}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-amber-400 mb-1">📜 Lịch sử & Nguồn gốc:</h4>
                <p className="leading-relaxed bg-stone-950 p-3 rounded-xl border border-stone-800/80">
                  {selectedPlaceDetail.history}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-amber-400 mb-1">💎 Giá trị văn hóa:</h4>
                <p className="leading-relaxed bg-stone-950 p-3 rounded-xl border border-stone-800/80">
                  {selectedPlaceDetail.culturalValue}
                </p>
              </div>

              {/* Sources audit */}
              <div>
                <h4 className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Nguồn tham chiếu đối sánh ({selectedPlaceDetail.sources.length}):
                </h4>
                <div className="space-y-2">
                  {selectedPlaceDetail.sources.map((src, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-stone-200">{src.title}</div>
                        <div className="text-[10px] text-stone-500">
                          {src.publisher} {src.year ? `(${src.year})` : ''}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/20">
                        Xác minh
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-stone-800">
                <button
                  onClick={() => setSelectedPlaceDetail(null)}
                  className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
