import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  MessageSquareQuote, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  Square, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  Info,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  Compass,
  Camera,
  Utensils,
  MapPin,
  Clock,
  Award,
  VolumeX,
  BookOpen,
  AlertTriangle,
  Sliders
} from 'lucide-react';
import { aiService } from '../services/aiService';
import { speechService } from '../services/speechService';
import { storageService } from '../services/storageService';
import { ttsService, TTSStatus, mobileAudioUnlocker } from '../services/ttsService';
import { getTTSConfig, TTSConfig } from '../config/ttsConfig';
import { ChatMessage, HeritageItem, AITourGuideConfig } from '../types';
import { VoiceSettingsModal } from './VoiceSettingsModal';
import { SafeMarkdownRenderer } from './SafeMarkdownRenderer';

interface AIChatAssistantProps {
  initialContext?: HeritageItem | null;
  initialQuestion?: string;
  language?: string;
}

const CULTURAL_SUGGESTIONS = [
  { vi: 'Vì sao người Việt có phong tục têm trầu cánh phượng?', en: 'Why do Vietnamese people shape betel leaves into phoenix wings?' },
  { vi: 'Cổng Ngọ Môn Huế có mấy lối đi và ý nghĩa từng lối?', en: 'How many passageways does Ngo Mon Gate in Hue have, and what does each mean?' },
  { vi: 'Ý nghĩa của 82 Bia Tiến sĩ Văn Miếu Thăng Long là gì?', en: 'What is the significance of the 82 doctoral steles at the Temple of Literature?' },
  { vi: 'Món Cơm Hến Huế có nguồn gốc dân dã như thế nào?', en: 'What are the humble origins of Hue clam rice?' },
  { vi: 'Giải thích ngắn gọn cho học sinh về chiến thắng Bạch Đằng 938', en: 'Explain the 938 Bach Dang victory briefly for students.' }
];

export const buildInitialWelcome = (
  lang: string, 
  config: AITourGuideConfig, 
  isGuide: boolean, 
  heritage?: HeritageItem | null
): string => {
  const isEn = lang === 'en';
  if (isGuide) {
    if (isEn) {
      return `Hello everyone! I’m ${config.guideName || 'Bao An'}, your cultural tour guide on this journey. I am delighted to accompany you as we explore the rich heritage and thousand-year stories of Vietnam! Feel free to ask me about ${heritage?.name || 'Vietnamese landmarks'}, historical insights, photo spots, or authentic local food!`;
    }
    return config.welcomeGreeting || `Dạ em là ${config.guideName || 'Bảo An'} - Hướng dẫn viên du lịch văn hóa! Rất hân hạnh được đồng hành cùng quý cô bác, anh chị trong đoàn. Quý vị muốn em thuyết minh về ${heritage?.name || 'di sản Việt Nam'} hay tư vấn góc chụp ảnh, quán ngon cứ bảo em nhé!`;
  } else {
    if (isEn) {
      return 'Hello! I’m the Vietnamese Culture & History Assistant. I provide factual historical knowledge, distinguishing documented history from folk legends. How may I assist your cultural exploration today?';
    }
    return 'Xin chào! Tôi là Trợ lý Lịch sử & Văn hóa Việt Nam. Tôi giải đáp các câu hỏi học thuật, phân biệt rạch ròi giữa chính sử và truyền thuyết dân gian. Hôm nay bạn muốn tìm hiểu về trang sử hay di sản nào?';
  }
};

interface ChatMessageItemProps {
  msg: ChatMessage;
  guideConfig: AITourGuideConfig;
  mode: 'tour_guide' | 'cultural_assistant';
  isEnglish: boolean;
  ttsStatus?: TTSStatus;
  ttsProvider?: string;
  isCopied: boolean;
  onSpeak: (id: string, text: string) => void;
  onCopy: (id: string, text: string) => void;
  ui: (vi: string, en: string) => string;
}

const ChatMessageItem: React.FC<ChatMessageItemProps> = React.memo(({
  msg,
  guideConfig,
  mode,
  isEnglish,
  ttsStatus,
  ttsProvider,
  isCopied,
  onSpeak,
  onCopy,
  ui
}) => {
  const isUser = msg.sender === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        mode === 'tour_guide' ? (
          <img 
            src={guideConfig.avatarUrl} 
            alt={guideConfig.guideName}
            className="w-9 h-9 rounded-xl object-cover border border-amber-500/50 shadow shrink-0 mt-0.5"
            loading="lazy"
          />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-amber-600/30 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 text-xs font-serif font-bold">
            H
          </div>
        )
      )}

      <div
        className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-md ${
          isUser
            ? 'bg-amber-600 text-stone-950 font-medium rounded-tr-none'
            : 'bg-stone-800/90 text-stone-200 border border-stone-700/60 rounded-tl-none'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{msg.text}</div>
        ) : (
          <div>
            {msg.isStreaming && !msg.text ? (
              <div className="flex items-center gap-2 py-1 text-stone-300">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                <span className="text-xs italic text-amber-300/90">
                  {mode === 'tour_guide' 
                    ? (isEnglish ? `${guideConfig.guideName} is preparing your tour narration...` : `HDV ${guideConfig.guideName} đang chuẩn bị lời thuyết minh...`) 
                    : ui('Trợ lý AI đang tra cứu...','AI is researching sources...')}
                </span>
              </div>
            ) : (
              <>
                <SafeMarkdownRenderer content={msg.text} />
                {msg.isStreaming && (
                  <span className="inline-block w-2 h-3.5 ml-1 bg-amber-400 animate-pulse rounded-sm align-middle" />
                )}
              </>
            )}
          </div>
        )}

        {/* Assistant message action controls */}
        {!isUser && !msg.isStreaming && (
          <div className="mt-3 pt-2 border-t border-stone-700/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-400">
            <div className="flex items-center gap-1.5 text-[10px] text-stone-500">
              <span>
                {mode === 'tour_guide' ? `${isEnglish ? 'Guide ' : 'HDV '}${guideConfig.guideName} • ` : ui('Trợ lý AI • ','AI Assistant • ')}
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {/* Provider Badge */}
              <span className={`px-2 py-0.5 rounded font-bold border text-[9px] flex items-center gap-1 ${
                !isEnglish && ttsProvider === 'vieneu'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-stone-800 text-stone-300 border-stone-700'
              }`}>
                <span>🎙️</span>
                <span>
                  {isEnglish 
                    ? 'English Voice' 
                    : (ttsProvider === 'vieneu' ? 'VieNeu AI' : 'Giọng Máy')}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onSpeak(msg.id, msg.text)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all text-xs font-medium cursor-pointer ${
                  ttsStatus === 'playing'
                    ? 'bg-red-950/80 border border-red-500/40 text-red-300 animate-pulse'
                    : ttsStatus === 'generating' || ttsStatus === 'loading'
                    ? 'bg-amber-950/80 border border-amber-500/40 text-amber-300 animate-pulse'
                    : ttsStatus === 'error'
                    ? 'bg-rose-950/80 border border-rose-500/40 text-rose-300'
                    : 'bg-stone-900/80 hover:bg-stone-700 text-stone-300 border border-stone-700'
                }`}
                title={isEnglish ? "Listen to the guide in English" : "Nghe hướng dẫn viên đọc bằng VieNeu AI (Text-to-Speech)"}
              >
                {ttsStatus === 'playing' ? (
                  <>
                    <Square className="w-3 h-3 text-red-400 fill-current" />
                    <span>{ui("⏹ Dừng","⏹ Stop")}</span>
                  </>
                ) : ttsStatus === 'generating' || ttsStatus === 'loading' ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    <span>{ui("⏳ Đang chuẩn bị đọc...", "⏳ Reading aloud...")}</span>
                  </>
                ) : ttsStatus === 'error' ? (
                  <>
                    <RefreshCw className="w-3 h-3 text-rose-400" />
                    <span>{ui("🔄 Thử lại", "🔄 Retry")}</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isEnglish ? "🔊 Listen (English)" : "🔊 Đọc (VieNeu AI)"}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onCopy(msg.id, msg.text)}
                className="hover:text-amber-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-stone-900/60 border border-stone-700/60 transition-colors cursor-pointer"
                title={ui('Sao chép nội dung','Copy message')}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">{ui('Đã chép','Copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-stone-400" />
                    <span>{ui('Chép','Copy')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.msg.id !== nextProps.msg.id) return false;
  if (prevProps.msg.isStreaming !== nextProps.msg.isStreaming) return false;
  if (prevProps.msg.text !== nextProps.msg.text) return false;
  if (prevProps.ttsStatus !== nextProps.ttsStatus) return false;
  if (prevProps.ttsProvider !== nextProps.ttsProvider) return false;
  if (prevProps.isCopied !== nextProps.isCopied) return false;
  if (prevProps.mode !== nextProps.mode) return false;
  if (prevProps.isEnglish !== nextProps.isEnglish) return false;
  if (prevProps.guideConfig.guideName !== nextProps.guideConfig.guideName) return false;
  if (prevProps.guideConfig.avatarUrl !== nextProps.guideConfig.avatarUrl) return false;
  return true;
});

// Memoized Subcomponents to prevent re-rendering during streaming
interface ChatToolbarProps {
  mode: 'tour_guide' | 'cultural_assistant';
  isEnglish: boolean;
  ttsConfig: TTSConfig;
  autoSpeech: boolean;
  onSwitchMode: (mode: 'tour_guide' | 'cultural_assistant') => void;
  onOpenVoiceSettings: () => void;
  onToggleAutoSpeech: () => void;
  onClearChat: () => void;
  ui: (vi: string, en: string) => string;
}

const ChatToolbar: React.FC<ChatToolbarProps> = React.memo(({
  mode,
  isEnglish,
  ttsConfig,
  autoSpeech,
  onSwitchMode,
  onOpenVoiceSettings,
  onToggleAutoSpeech,
  onClearChat,
  ui
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6 pb-4 border-b border-stone-800">
    {/* Left: Mode Toggle Pills */}
    <div className="grid grid-cols-2 sm:flex items-center gap-1.5 p-1 bg-stone-900 border border-stone-800 rounded-2xl shadow-inner">
      <button
        onClick={() => onSwitchMode('tour_guide')}
        className={`px-3 py-2 sm:px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-h-[40px] ${
          mode === 'tour_guide'
            ? 'bg-amber-500 text-stone-950 shadow-md scale-[1.01]'
            : 'text-stone-400 hover:text-stone-200'
        }`}
      >
        <Compass className="w-4 h-4 shrink-0" />
        <span className="truncate">{ui('HDV Du Lịch AI','AI Tour Guide')}</span>
        <span className="hidden md:inline text-[10px] px-1.5 py-0.2 bg-stone-950/20 rounded font-normal">
          Tour Guide
        </span>
      </button>

      <button
        onClick={() => onSwitchMode('cultural_assistant')}
        className={`px-3 py-2 sm:px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer min-h-[40px] ${
          mode === 'cultural_assistant'
            ? 'bg-amber-500 text-stone-950 shadow-md scale-[1.01]'
            : 'text-stone-400 hover:text-stone-200'
        }`}
      >
        <BookOpen className="w-4 h-4 shrink-0" />
        <span className="truncate">{ui('Trợ Lý Lịch Sử','Culture Assistant')}</span>
      </button>
    </div>

    {/* Right Tools */}
    <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
      <button
        onClick={onOpenVoiceSettings}
        className="px-2.5 sm:px-3 py-2 rounded-xl text-xs bg-stone-900 border border-amber-500/40 text-amber-300 hover:text-amber-200 hover:bg-stone-800 flex items-center gap-1.5 transition-all cursor-pointer shrink-0 min-h-[38px] shadow-sm"
        title={ui('Cài đặt công nghệ đọc VieNeu AI hoặc tùy chỉnh tốc độ, giọng đọc','Configure speech, voice, and reading speed')}
      >
        <Sliders className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-semibold">
          {isEnglish 
            ? 'Voice: English (en-US)' 
            : (ttsConfig.provider === 'vieneu' ? `Giọng: VieNeu (${ttsConfig.voice || 'Ngọc Lan'})` : 'Giọng: Trình duyệt')}
        </span>
      </button>

      <button
        onClick={onToggleAutoSpeech}
        className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 border transition-all cursor-pointer shrink-0 min-h-[38px] ${
          autoSpeech
            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
            : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-300'
        }`}
        title={ui('Tự động đọc giọng nói thuyết minh mỗi khi AI phản hồi','Automatically read each AI response aloud')}
      >
        <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Audio: {autoSpeech ? ui('Bật','On') : ui('Tắt','Off')}</span>
      </button>

      <button
        onClick={onClearChat}
        className="px-2.5 sm:px-3 py-2 rounded-xl text-xs text-stone-400 hover:text-red-400 hover:bg-stone-800 flex items-center gap-1.5 transition-colors border border-stone-800 cursor-pointer shrink-0 min-h-[38px]"
        title={ui('Làm mới lịch sử trò chuyện','Clear chat history')}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{ui('Làm mới','Clear')}</span>
      </button>
    </div>
  </div>
));

interface TourGuideHeaderProps {
  guideConfig: AITourGuideConfig;
  selectedHeritage: HeritageItem | null;
  allHeritages: HeritageItem[];
  isEnglish: boolean;
  ttsConfig: TTSConfig;
  onOpenVoiceSettings: () => void;
  onSelectHeritage: (heritage: HeritageItem) => void;
  ui: (vi: string, en: string) => string;
}

const TourGuideHeader: React.FC<TourGuideHeaderProps> = React.memo(({
  guideConfig,
  selectedHeritage,
  allHeritages,
  isEnglish,
  ttsConfig,
  onOpenVoiceSettings,
  onSelectHeritage,
  ui
}) => (
  <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-amber-950/40 via-stone-900 to-stone-900 border border-amber-500/40 rounded-3xl shadow-xl flex flex-wrap items-center justify-between gap-4">
    <div className="flex items-center gap-4">
      <div className="relative">
        <img 
          src={guideConfig.avatarUrl} 
          alt={guideConfig.guideName}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-amber-500/60 shadow-lg"
        />
        <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-stone-900 rounded-full" />
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg sm:text-xl font-serif font-bold text-stone-100 flex items-center gap-2">
            <span>HDV. {guideConfig.guideName}</span>
          </h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
            {ui(`Thẻ HDV Quốc Gia #${guideConfig.experienceYears} Năm Nghề`,`National Tour Guide • ${guideConfig.experienceYears} Years’ Experience`)}
          </span>
          <button
            type="button"
            onClick={onOpenVoiceSettings}
            className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1 transition-all cursor-pointer"
            title={ui('Bấm để tùy chỉnh giọng đọc cho HDV Bảo An','Click to customize the AI tour guide voice')}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>
              {isEnglish ? 'English Voice (en-US)' : (ttsConfig.provider === 'vieneu' ? `VieNeu AI (${ttsConfig.voice || 'Ngọc Lan'})` : 'Giọng Trình duyệt')}
            </span>
          </button>
        </div>
        <p className="text-xs text-stone-300 font-medium mt-0.5">
          {guideConfig.title}
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {guideConfig.specialties.slice(0, 3).map((sp, idx) => (
            <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-stone-800 text-stone-400">
              {sp}
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Heritage Selection Dropdown for Tour Guide Context */}
    <div className="w-full sm:w-auto bg-stone-950/80 border border-stone-800 rounded-2xl p-2.5 space-y-1">
      <label className="text-[10px] uppercase font-bold text-stone-400 block tracking-wider flex items-center gap-1">
        <MapPin className="w-3 h-3 text-amber-400" />
        <span>{ui('Điểm Dừng Chân Hiện Tại:','Current Stop:')}</span>
      </label>
      <select
        value={selectedHeritage?.id || ''}
        onChange={(e) => {
          const target = allHeritages.find(h => h.id === e.target.value);
          if (target) onSelectHeritage(target);
        }}
        className="w-full bg-stone-900 border border-stone-700 text-amber-300 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
      >
        {allHeritages.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name} ({h.province})
          </option>
        ))}
      </select>
    </div>
  </div>
));

interface CulturalAssistantHeaderProps {
  ui: (vi: string, en: string) => string;
}

const CulturalAssistantHeader: React.FC<CulturalAssistantHeaderProps> = React.memo(({ ui }) => (
  <div className="flex items-center gap-3 mb-6 p-4 bg-stone-900 border border-stone-800 rounded-2xl">
    <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
      <MessageSquareQuote className="w-5 h-5" />
    </div>
    <div>
      <h2 className="text-lg font-serif font-bold text-stone-100 flex items-center gap-2">
        <span>{ui('Trợ Lý Văn Hóa Việt Nam','Vietnamese Culture Assistant')}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          {ui('Chính sử & Huyền tích','History & Legends')}
        </span>
      </h2>
      <p className="text-xs text-stone-400">
        {ui('Tra cứu phong tục, làng nghề, lịch sử và thẩm định độ xác thực dữ liệu văn hóa.','Explore customs, traditional crafts, history, and the reliability of cultural information.')}
      </p>
    </div>
  </div>
));

interface QuickSuggestionChipsProps {
  mode: 'tour_guide' | 'cultural_assistant';
  guideName: string;
  selectedHeritageName: string;
  loading: boolean;
  isEnglish: boolean;
  onSelectPrompt: (prompt: string) => void;
  ui: (vi: string, en: string) => string;
}

const QuickSuggestionChips: React.FC<QuickSuggestionChipsProps> = React.memo(({
  mode,
  guideName,
  selectedHeritageName,
  loading,
  isEnglish,
  onSelectPrompt,
  ui
}) => (
  <div className="mt-3">
    {mode === 'tour_guide' ? (
      <div>
        <p className="text-[11px] text-stone-400 mb-1.5 font-medium flex items-center gap-1">
          <Compass className="w-3 h-3 text-amber-400" />
          <span>{ui(`Chỉ dẫn du lịch nhanh với HDV ${guideName}:`,`Quick tour prompts for ${guideName}:`)}</span>
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            disabled={loading}
            onClick={() => onSelectPrompt(ui(`Chào em ${guideName}! Hãy thuyết minh chi tiết và dẫn đoàn đi một vòng quanh ${selectedHeritageName} nhé.`,`Hi ${guideName}! Please give us a detailed guided tour of ${selectedHeritageName}.`))}
            className="text-xs bg-stone-900 hover:bg-stone-800 text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/40 hover:border-amber-400 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>{ui('Thuyết minh điểm này','Tell me about this site')}</span>
          </button>

          <button
            disabled={loading}
            onClick={() => onSelectPrompt(ui(`Khi tham quan ${selectedHeritageName}, quý đoàn cần lưu ý trang phục và các quy tắc ứng xử tôn nghiêm nào?`,`What dress code and respectful behavior rules should visitors follow at ${selectedHeritageName}?`))}
            className="text-xs bg-stone-900 hover:bg-stone-800 text-stone-300 px-3 py-1.5 rounded-xl border border-stone-800 hover:border-emerald-500/40 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{ui('Quy tắc ứng xử & Trang phục','Etiquette & dress code')}</span>
          </button>

          <button
            disabled={loading}
            onClick={() => onSelectPrompt(ui(`Gần ${selectedHeritageName} có món ăn đặc sản nào ngon và quán nào chuẩn vị của người bản xứ không em?`,`What local specialties and authentic restaurants would you recommend near ${selectedHeritageName}?`))}
            className="text-xs bg-stone-900 hover:bg-stone-800 text-stone-300 px-3 py-1.5 rounded-xl border border-stone-800 hover:border-rose-500/40 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Utensils className="w-3.5 h-3.5 text-rose-400" />
            <span>{ui('Quán ngon & Đặc sản bản xứ','Local food & specialties')}</span>
          </button>

          <button
            disabled={loading}
            onClick={() => onSelectPrompt(ui(`Chỉ cho anh các góc chụp ảnh đẹp nhất và giờ vàng ánh sáng tại ${selectedHeritageName}!`,`Show me the best photo spots and golden-hour times at ${selectedHeritageName}!`))}
            className="text-xs bg-stone-900 hover:bg-stone-800 text-stone-300 px-3 py-1.5 rounded-xl border border-stone-800 hover:border-sky-500/40 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span>{ui('Góc chụp ảnh đẹp & Giờ vàng','Photo spots & golden hour')}</span>
          </button>

          <button
            disabled={loading}
            onClick={() => onSelectPrompt(ui(`Gợi ý cho đoàn lộ trình dạo bước từ 1 đến 2 tiếng tối ưu nhất tại ${selectedHeritageName}.`,`Suggest an optimized 1–2 hour walking route around ${selectedHeritageName}.`))}
            className="text-xs bg-stone-900 hover:bg-stone-800 text-stone-300 px-3 py-1.5 rounded-xl border border-stone-800 hover:border-amber-500/40 whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{ui('Lộ trình dạo bước 1-2 giờ','1–2 hour walking route')}</span>
          </button>
        </div>
      </div>
    ) : (
      <div>
        <p className="text-[11px] text-stone-400 mb-1.5 font-medium">{ui('Gợi ý câu hỏi nghiên cứu văn hóa:','Suggested cultural research questions:')}</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {CULTURAL_SUGGESTIONS.map((q, idx) => (
            <button
              key={idx}
              disabled={loading}
              onClick={() => onSelectPrompt(isEnglish ? q.en : q.vi)}
              className="text-xs bg-stone-900 hover:bg-stone-800 text-stone-300 px-3 py-1.5 rounded-xl border border-stone-800 hover:border-amber-500/40 whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEnglish ? q.en : q.vi}
            </button>
          ))}
        </div>
      </div>
    )}
  </div>
));

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  initialContext,
  initialQuestion,
  language = 'vi'
}) => {
  const isEnglish = language === 'en';
  const ui = useCallback((vi: string, en: string) => isEnglish ? en : vi, [isEnglish]);

  const [guideConfig, setGuideConfig] = useState<AITourGuideConfig>(storageService.getTourGuideConfig());
  const [allHeritages] = useState<HeritageItem[]>(storageService.getHeritages());
  const [selectedHeritage, setSelectedHeritage] = useState<HeritageItem | null>(initialContext || allHeritages[0] || null);

  // Mode: 'tour_guide' (Huấn luyện chuyên sâu) or 'cultural_assistant' (Tra cứu văn hóa chung)
  const [mode, setMode] = useState<'tour_guide' | 'cultural_assistant'>('tour_guide');

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const config = storageService.getTourGuideConfig();
    return [
      {
        id: 'welcome-msg',
        sender: 'assistant',
        text: buildInitialWelcome(language, config, true, initialContext || null),
        timestamp: new Date().toISOString(),
        isTourGuideMode: true
      }
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [ttsStatusMap, setTtsStatusMap] = useState<Record<string, TTSStatus>>({});
  const [ttsProviderMap, setTtsProviderMap] = useState<Record<string, string>>({});
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>(() => getTTSConfig());
  const [autoSpeech, setAutoSpeech] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // High-performance request duplicate protection guards
  const isLoadingRef = useRef<boolean>(false);
  const initialQuestionHandledRef = useRef<string | null>(null);

  // Sync TTS config whenever VoiceSettingsModal closes
  useEffect(() => {
    if (!isVoiceSettingsOpen) {
      setTtsConfig(getTTSConfig());
    }
  }, [isVoiceSettingsOpen]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef<boolean>(false);
  const rafIdRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    userScrolledUpRef.current = !isNearBottom;
  }, []);

  const scrollToBottom = useCallback((smooth = false) => {
    if (scrollContainerRef.current) {
      if (smooth) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }
  }, []);

  // Listen to config updates from Admin Studio
  useEffect(() => {
    const handleConfigUpdate = (e: any) => {
      if (e.detail) {
        setGuideConfig(e.detail);
      }
    };
    window.addEventListener('tour-guide-config-updated', handleConfigUpdate);

    // Initial server sync
    storageService.fetchTourGuideConfig().then(latest => {
      setGuideConfig(latest);
    });

    return () => {
      window.removeEventListener('tour-guide-config-updated', handleConfigUpdate);
    };
  }, []);

  useEffect(() => {
    if (initialQuestion && initialQuestionHandledRef.current !== initialQuestion) {
      initialQuestionHandledRef.current = initialQuestion;
      handleSendMessage(initialQuestion);
    }
  }, [initialQuestion]);

  useEffect(() => {
    if (initialContext) {
      setSelectedHeritage(initialContext);
    }
  }, [initialContext]);

  // Synchronize initial welcome greeting when language changes (preserving existing chats)
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && (prev[0].id === 'welcome-msg' || prev[0].id.startsWith('welcome-'))) {
        return [
          {
            ...prev[0],
            text: buildInitialWelcome(language, guideConfig, mode === 'tour_guide', selectedHeritage),
            isTourGuideMode: mode === 'tour_guide'
          }
        ];
      }
      return prev;
    });
  }, [language, guideConfig, mode, selectedHeritage]);

  // Handle Speech-to-Text via Web Speech API
  const handleToggleRecord = () => {
    setVoiceNotice(null);

    if (isRecording) {
      speechService.stopListening();
      setIsRecording(false);
      return;
    }

    if (!speechService.isSupported()) {
      setVoiceNotice(ui('Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Chrome hoặc Edge.','Speech recognition is not supported by this browser. Please use Chrome or Edge.'));
      return;
    }

    const bcp47Map: Record<string, string> = {
      vi: 'vi-VN',
      en: 'en-US',
      fr: 'fr-FR',
      ja: 'ja-JP',
      ko: 'ko-KR',
      zh: 'zh-CN'
    };
    const recognitionLang = bcp47Map[language] || 'vi-VN';

    const success = speechService.startListening({
      lang: recognitionLang,
      onStart: () => {
        setIsRecording(true);
        setVoiceNotice(null);
      },
      onResult: (transcript) => {
        if (transcript) {
          setInput((prev) => (prev.trim() ? prev.trim() + ' ' + transcript : transcript));
        }
      },
      onError: (errMsg) => {
        setIsRecording(false);
        setVoiceNotice(errMsg);
      },
      onEnd: () => {
        setIsRecording(false);
      }
    });

    if (!success) {
      setIsRecording(false);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isLoadingRef.current = false;
    setLoading(false);
    setMessages((prev) =>
      prev.map((m) => m.isStreaming ? { ...m, isStreaming: false } : m)
    );
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || input;
    // Strict guard to eliminate duplicate requests
    if (!query.trim() || loading || isLoadingRef.current) return;
    isLoadingRef.current = true;

    const isGuide = mode === 'tour_guide';

    // Prime mobile audio for automatic playback upon response
    if (autoSpeech) {
      mobileAudioUnlocker.unlock();
    }

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toISOString(),
      isTourGuideMode: isGuide
    };

    const assistantMsgId = 'msg-' + (Date.now() + 1);
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
      isTourGuideMode: isGuide,
      isStreaming: true
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    if (!textToSend) setInput('');
    setLoading(true);
    userScrolledUpRef.current = false;
    setTimeout(() => scrollToBottom(true), 10);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const conversationHistory = messages.map(m => ({
        role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
        text: m.text
      }));

      let accumulatedText = '';
      let lastFlushTime = 0;
      const MIN_FLUSH_INTERVAL = 35; // ~28 fps: smooth visual cadence, eliminates main thread thrashing

      const flushChunkToState = (isFinal = false) => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        lastFlushTime = performance.now();
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, text: accumulatedText, isStreaming: !isFinal } : m)
        );
        // Defer scroll adjustment to next frame to prevent forced synchronous reflow
        requestAnimationFrame(() => {
          if (!userScrolledUpRef.current && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
          }
        });
      };

      const finalReply = await aiService.streamChatWithAssistant({
        message: query,
        conversationHistory,
        currentHeritageContext: selectedHeritage,
        language,
        isTourGuideMode: isGuide,
        signal: controller.signal,
        onMeta: (meta) => {
          if (meta.intent) {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantMsgId ? { ...m, intent: meta.intent } : m)
            );
          }
        },
        onChunk: (chunk, accumulated) => {
          accumulatedText = accumulated;
          const now = performance.now();
          if (now - lastFlushTime >= MIN_FLUSH_INTERVAL) {
            flushChunkToState(false);
          } else if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(() => flushChunkToState(false));
          }
        }
      });

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const completedText = finalReply || accumulatedText;
      accumulatedText = completedText;
      flushChunkToState(true);

      // If auto-speech enabled, speak the answer
      if (autoSpeech && completedText) {
        handleSpeak(assistantMsgId, completedText);
      }

      storageService.logActivity({
        actionType: 'chat',
        title: isGuide ? `Hỏi Hướng Dẫn Viên (${guideConfig.guideName})` : 'Hỏi đáp Trợ lý Văn hóa',
        description: `Hỏi: "${query.length > 60 ? query.substring(0, 60) + '...' : query}"`,
        pointsEarned: 10
      });
    } catch (err: any) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, isStreaming: false } : m)
        );
        return;
      }
      const fallbackText = isGuide 
        ? ui(`Dạ em là ${guideConfig.guideName}! Đường truyền máy chủ đang bận đôi chút, quý đoàn mình thông cảm nhé. Em luôn sẵn lòng tiếp tục thuyết minh khi quý vị thử lại!`, `I’m ${guideConfig.guideName}. The server is temporarily busy. Please try again, and I’ll be happy to continue your tour!`) 
        : ui('Xin lỗi, tôi gặp sự cố khi xử lý câu hỏi lúc này. Bạn vui lòng thử lại nhé!', 'Sorry, I had trouble processing your question. Please try again.');
      
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsgId ? { ...m, text: fallbackText, isStreaming: false } : m)
      );
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handleCopy = useCallback((id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleSpeak = useCallback((id: string, text: string) => {
    ttsService.prepareForMobilePlayback();
    const currentStatus = ttsStatusMap[id] || 'idle';

    if (speakingMsgId === id && (currentStatus === 'playing' || currentStatus === 'generating' || currentStatus === 'loading')) {
      ttsService.stop();
      setSpeakingMsgId(null);
      setTtsStatusMap((prev) => ({ ...prev, [id]: 'stopped' }));
    } else {
      setSpeakingMsgId(id);
      setTtsStatusMap((prev) => ({ ...prev, [id]: 'loading' }));

      const currentConfig = getTTSConfig();
      setTtsConfig(currentConfig);

      const isVi = language === 'vi' || !language;
      const langBcp47 = isEnglish ? 'en-US' : (isVi ? 'vi-VN' : `${language}-${language.toUpperCase()}`);
      ttsService.speak(text, {
        lang: langBcp47,
        provider: isVi ? (currentConfig.provider || 'vieneu') : 'web_speech',
        voice: isVi ? (currentConfig.voice || 'Ngọc Lan') : undefined,
        speaker: isVi ? (currentConfig.voice || 'Ngọc Lan') : undefined,
        onStatusChange: (status) => {
          setTtsStatusMap((prev) => ({ ...prev, [id]: status }));
          setTtsProviderMap((prev) => ({ ...prev, [id]: isVi ? ttsService.getActiveProviderName() : 'web_speech' }));
        },
        onEnd: () => {
          setSpeakingMsgId(null);
          setTtsStatusMap((prev) => ({ ...prev, [id]: 'idle' }));
        },
        onError: () => {
          setSpeakingMsgId(null);
          setTtsStatusMap((prev) => ({ ...prev, [id]: 'error' }));
        }
      });
    }
  }, [language, isEnglish, speakingMsgId, ttsStatusMap]);

  const handleClearChat = useCallback(() => {
    const isGuide = mode === 'tour_guide';
    setMessages([
      {
        id: 'welcome-msg',
        sender: 'assistant',
        text: buildInitialWelcome(language, guideConfig, isGuide, selectedHeritage),
        timestamp: new Date().toISOString(),
        isTourGuideMode: isGuide
      }
    ]);
    aiService.stopSpeaking();
    setSpeakingMsgId(null);
  }, [mode, language, guideConfig, selectedHeritage]);

  const handleSwitchMode = useCallback((newMode: 'tour_guide' | 'cultural_assistant') => {
    setMode(newMode);
    aiService.stopSpeaking();
    setSpeakingMsgId(null);
    setMessages([
      {
        id: 'welcome-' + newMode + '-' + Date.now(),
        sender: 'assistant',
        text: buildInitialWelcome(language, guideConfig, newMode === 'tour_guide', selectedHeritage),
        timestamp: new Date().toISOString(),
        isTourGuideMode: newMode === 'tour_guide'
      }
    ]);
  }, [language, guideConfig, selectedHeritage]);

  const handleOpenVoiceSettings = useCallback(() => {
    setIsVoiceSettingsOpen(true);
  }, []);

  const handleToggleAutoSpeech = useCallback(() => {
    setAutoSpeech(prev => !prev);
  }, []);

  const handleSelectHeritage = useCallback((heritage: HeritageItem) => {
    setSelectedHeritage(heritage);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      
      {/* Mode Switcher & Toolbar */}
      <ChatToolbar
        mode={mode}
        isEnglish={isEnglish}
        ttsConfig={ttsConfig}
        autoSpeech={autoSpeech}
        onSwitchMode={handleSwitchMode}
        onOpenVoiceSettings={handleOpenVoiceSettings}
        onToggleAutoSpeech={handleToggleAutoSpeech}
        onClearChat={handleClearChat}
        ui={ui}
      />

      {/* Offline Mode Banner */}
      {isOffline && (
        <div className="mb-4 p-3 bg-amber-950/60 border border-amber-500/50 rounded-2xl text-amber-300 text-xs flex items-center justify-between gap-3 shadow-md animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="font-bold">{ui('⚡ Chế độ Hướng Dẫn Viên AI Ngoại Tuyến (Offline)','⚡ AI Tour Guide Offline Mode')}</span>
          </div>
          <p className="text-[11px] text-amber-200 hidden sm:block">
            {ui('Trích xuất tri thức di sản & văn hóa trực tiếp từ bộ dữ liệu lưu trữ thiết bị','Using heritage and cultural knowledge stored on this device')}
          </p>
        </div>
      )}

      {/* Profile Header */}
      {mode === 'tour_guide' ? (
        <TourGuideHeader
          guideConfig={guideConfig}
          selectedHeritage={selectedHeritage}
          allHeritages={allHeritages}
          isEnglish={isEnglish}
          ttsConfig={ttsConfig}
          onOpenVoiceSettings={handleOpenVoiceSettings}
          onSelectHeritage={handleSelectHeritage}
          ui={ui}
        />
      ) : (
        <CulturalAssistantHeader ui={ui} />
      )}

      {/* Chat Messages Log */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="bg-stone-900 border border-stone-800 rounded-3xl p-4 sm:p-6 h-[460px] overflow-y-auto space-y-4 shadow-inner"
      >
        {messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            msg={msg}
            guideConfig={guideConfig}
            mode={mode}
            isEnglish={isEnglish}
            ttsStatus={ttsStatusMap[msg.id]}
            ttsProvider={ttsProviderMap[msg.id] || ttsConfig.provider}
            isCopied={copiedId === msg.id}
            onSpeak={handleSpeak}
            onCopy={handleCopy}
            ui={ui}
          />
        ))}

        {loading && !messages.some(m => m.isStreaming) && (
          <div className="flex gap-3 justify-start">
            {mode === 'tour_guide' ? (
              <img 
                src={guideConfig.avatarUrl} 
                alt="Tour Guide"
                className="w-9 h-9 rounded-xl object-cover border border-amber-500/50 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-amber-600/30 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 text-xs font-serif font-bold">
                H
              </div>
            )}
            <div className="bg-stone-800 text-stone-300 p-3.5 rounded-2xl rounded-tl-none border border-stone-700 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span className="text-xs">
                {mode === 'tour_guide' 
                  ? (isEnglish ? `${guideConfig.guideName} is preparing your tour narration...` : `HDV ${guideConfig.guideName} đang chuẩn bị lời thuyết minh cho đoàn...`) 
                  : ui('Trợ lý AI đang tra cứu chính sử...','The AI assistant is researching historical sources...')}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestion Chips */}
      <QuickSuggestionChips
        mode={mode}
        guideName={guideConfig.guideName}
        selectedHeritageName={selectedHeritage?.name || 'di sản này'}
        loading={loading}
        isEnglish={isEnglish}
        onSelectPrompt={handleSendMessage}
        ui={ui}
      />

      {/* Voice Notification Banner */}
      {voiceNotice && (
        <div className="mt-3 px-3 py-2 bg-amber-950/70 border border-amber-600/40 rounded-xl text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="flex-1">{voiceNotice}</span>
          <button 
            onClick={() => setVoiceNotice(null)}
            className="text-amber-400 hover:text-white text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Box with Voice & Send */}
      <div className="mt-3 flex items-center gap-1.5 sm:gap-2 bg-stone-900 border border-stone-700 rounded-2xl p-1.5 sm:p-2 shadow-xl focus-within:border-amber-500">
        <button
          onClick={handleToggleRecord}
          className={`px-3 py-2.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0 min-h-[44px] ${
            isRecording 
              ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-900/50' 
              : 'bg-stone-800 text-stone-200 hover:bg-stone-700 hover:text-amber-300 border border-stone-700'
          }`}
          title={isRecording ? ui('Đang nghe... Bấm để dừng','Listening... Click to stop') : ui('Bấm để nói bằng giọng nói','Click to speak')}
        >
          {isRecording ? (
            <>
              <MicOff className="w-4 h-4 text-white" />
              <span className="hidden xs:inline">{ui('Đang nghe...','Listening...')}</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-amber-400" />
              <span className="hidden xs:inline sm:inline">{ui('Nói','Speak')}</span>
            </>
          )}
        </button>

        <input
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loading) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={loading}
          placeholder={
            isRecording 
              ? ui('Đang lắng nghe giọng nói...','Listening to your voice...') 
              : loading
                ? (isEnglish ? 'Generating response... (Click "Stop" to halt)' : 'AI đang tạo câu trả lời... (Bấm "Dừng" nếu muốn dừng)')
                : mode === 'tour_guide'
                  ? (isEnglish ? `Ask ${guideConfig.guideName}...` : `Hỏi HDV ${guideConfig.guideName}...`)
                  : ui('Hỏi về di sản Việt Nam...','Ask about Vietnamese heritage...')
          }
          className="flex-1 bg-transparent text-base sm:text-sm text-stone-100 placeholder-stone-400 focus:outline-none px-2 py-1 min-w-0 disabled:opacity-60"
        />

        {loading ? (
          <button
            id="btn-chat-stop"
            type="button"
            onClick={handleStopGeneration}
            className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all shadow cursor-pointer flex items-center gap-1.5 text-xs shrink-0 min-h-[44px] active:scale-95 animate-pulse"
            title={ui('Dừng tạo phản hồi','Stop generation')}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{ui('Dừng','Stop')}</span>
          </button>
        ) : (
          <button
            id="btn-chat-send"
            type="button"
            onClick={() => handleSendMessage()}
            disabled={!input.trim()}
            className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow cursor-pointer flex items-center gap-1.5 text-xs shrink-0 min-h-[44px] active:scale-95"
            title={ui('Gửi câu hỏi','Send message')}
          >
            <span>{ui('Gửi','Send')}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Voice Settings Modal */}
      <VoiceSettingsModal
        isOpen={isVoiceSettingsOpen}
        onClose={() => setIsVoiceSettingsOpen(false)}
      />

    </div>
  );
};

export default AIChatAssistant;
