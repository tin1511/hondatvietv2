import { HERITAGE_DATABASE } from '../data/vietnamHeritageData';

type HeritageRecord = {
  id?: string;
  name?: string;
  vietnameseName?: string;
  province?: string;
  address?: string;
  period?: string;
  history?: string;
  culturalSignificance?: string;
  interestingFacts?: string[];
  category?: string;
  description?: string;
  suggestedQuestions?: string[];
  [key: string]: unknown;
};

const records = HERITAGE_DATABASE as unknown as HeritageRecord[];

function normalize(text: unknown): string {
  return String(text ?? '')
    .toLocaleLowerCase('vi-VN')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textOf(record: HeritageRecord): string {
  return [
    record.name, record.vietnameseName, record.province, record.address,
    record.period, record.history, record.culturalSignificance,
    record.category, record.description,
    ...(Array.isArray(record.interestingFacts) ? record.interestingFacts : [])
  ].filter(Boolean).join(' ');
}

function scoreRecord(query: string, record: HeritageRecord): number {
  const q = normalize(query);
  const name = normalize(record.name);
  const vnName = normalize(record.vietnameseName);
  const province = normalize(record.province);
  const all = normalize(textOf(record));
  const tokens = [...new Set(q.split(' ').filter(token => token.length > 1))];
  let score = 0;

  if (q && name === q) score += 20;
  if (q && name.includes(q)) score += 14;
  if (q && vnName && vnName.includes(q)) score += 14;
  if (province && q.includes(province)) score += 8;

  for (const token of tokens) {
    if (name.split(' ').includes(token) || vnName.split(' ').includes(token)) score += 5;
    else if (name.includes(token) || vnName.includes(token)) score += 3;
    if (province.split(' ').includes(token)) score += 2;
    if (all.includes(token)) score += 1;
  }
  return score;
}

function formatRecord(record: HeritageRecord): string {
  const title = record.vietnameseName || record.name || 'Di sản Việt Nam';
  const location = record.address || record.province;
  const lines = [
    `🏛️ **${title}**`,
    location ? `📍 **Địa điểm:** ${location}` : '',
    record.period ? `🕰️ **Thời kỳ:** ${record.period}` : '',
    record.history ? `📜 **Lịch sử:**\n${record.history}` : '',
    record.culturalSignificance ? `✨ **Giá trị văn hóa:**\n${record.culturalSignificance}` : '',
    Array.isArray(record.interestingFacts) && record.interestingFacts.length
      ? `💡 **Điều thú vị:**\n${record.interestingFacts.slice(0, 5).map(f => `• ${f}`).join('\n')}`
      : ''
  ].filter(Boolean);
  if (lines.length === 1) {
    lines.push('Kho dữ liệu hiện chưa có phần mô tả chi tiết đã được xác minh cho địa điểm này.');
  }
  return lines.join('\n\n');
}

import { knowledgeBaseService } from './knowledgeBaseService';

/**
 * Local retrieval-based tour guide. It queries knowledgeBaseService (IndexedDB + 34 provinces verified dataset)
 * and bundled heritage records; it strictly does NOT call Gemini or remote AI providers when answering.
 */
export async function generateOfflineTourGuideReply(
  message: string,
  currentHeritageContext?: unknown
): Promise<string> {
  const query = String(message ?? '').trim();
  if (!query) {
    return 'Dạ em chào quý vị! Quý vị muốn tìm hiểu di tích, danh lam thắng cảnh, lịch sử hay nét văn hóa nào của 34 tỉnh thành Việt Nam?';
  }

  const contextText = currentHeritageContext && typeof currentHeritageContext === 'object'
    ? Object.values(currentHeritageContext as Record<string, unknown>)
        .filter(value => typeof value === 'string')
        .join(' ')
    : '';
  const contextPlaceId = currentHeritageContext && typeof currentHeritageContext === 'object' && 'id' in currentHeritageContext
    ? String((currentHeritageContext as any).id)
    : undefined;

  const searchQuery = contextText && !normalize(query).includes(normalize(contextText))
    ? `${query} ${contextText}`
    : query;

  // 1. Try Knowledge Base Service (IndexedDB + 34 Administrative Units Verified Dataset)
  try {
    const kbResult = await knowledgeBaseService.searchAndSynthesizeAnswer(searchQuery, contextPlaceId);
    if (kbResult.matched && kbResult.place) {
      return `⚡ **[HƯỚNG DẪN VIÊN TRI THỨC DI SẢN VIỆT NAM]**\n\n${kbResult.answer}\n\n---\n\n_Dữ liệu được truy xuất trực tiếp từ Kho tri thức du lịch đã xác minh và lưu trữ ngoại tuyến trên thiết bị (Chi phí 0đ, không phụ thuộc AI bên thứ ba)._`;
    }
  } catch (err) {
    console.warn('KnowledgeBase lookup error:', err);
  }

  // 2. Fallback to bundled heritage database records
  const matches = records
    .map(record => ({ record, score: scoreRecord(searchQuery, record) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!matches.length) {
    return [
      '⚡ **[HƯỚNG DẪN VIÊN TRI THỨC DU LỊCH]**',
      'Kho tri thức hiện chưa có bản ghi đủ phù hợp hoặc đã kiểm duyệt chính thức cho câu hỏi này. Hệ thống tuân thủ nguyên tắc không tự bịa đặt thông tin.',
      'Bạn hãy thử nhập tên di tích, danh thắng hoặc tỉnh/thành cụ thể (ví dụ: _Văn Miếu, Cố đô Huế, Phố cổ Hội An, Tràng An, Đền Hùng, Fansipan, Chợ nổi Cái Răng, Mũi Cà Mau..._).'
    ].join('\n\n');
  }

  const bestScore = matches[0].score;
  const answer = matches.map(item => formatRecord(item.record)).join('\n\n---\n\n');
  const confidenceNote = bestScore >= 14
    ? 'Đã tìm thấy kết quả khớp trong kho dữ liệu di sản địa phương.'
    : 'Đây là kết quả tìm kiếm gần đúng; hãy kiểm tra tên địa điểm để chắc chắn hơn.';

  return `⚡ **[HƯỚNG DẪN VIÊN TRI THỨC DU LỊCH]**\n\n${answer}\n\n---\n\n_${confidenceNote} Nội dung được truy xuất từ kho dữ liệu đã xác minh; không phát sinh chi phí gọi mô hình ngôn ngữ._`;
}