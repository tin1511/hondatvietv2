/**
 * AI Intent Classifier for Hồn Đất Việt
 * Zero-model, ultra-fast (<1ms) heuristic & rule classifier.
 * Categorizes queries to prune unnecessary context, tailor system instructions,
 * and accelerate response latency.
 */

export type UserIntent = 
  | 'GREETING'
  | 'CULINARY'
  | 'HERITAGE_MONUMENT'
  | 'TICKETS_HOURS'
  | 'ITINERARY'
  | 'WEATHER'
  | 'FOLLOW_UP'
  | 'GENERAL';

export interface IntentClassificationResult {
  intent: UserIntent;
  confidence: number;
  location?: string;
  topic?: string;
  isPureGreeting?: boolean;
  fastGreetingReply?: { vi: string; en: string };
  suggestedFocus: string;
}

// Common Vietnamese locations / cities in heritage database
const VIETNAM_LOCATIONS: { name: string; aliases: string[]; province: string }[] = [
  { name: 'Hội An', aliases: ['hội an', 'hoi an', 'phố cổ hội an'], province: 'Quảng Nam' },
  { name: 'Huế', aliases: ['huế', 'hue', 'cố đô huế', 'thừa thiên huế'], province: 'Thừa Thiên Huế' },
  { name: 'Hà Nội', aliases: ['hà nội', 'ha noi', 'thủ đô', 'thăng long', 'hồ gươm'], province: 'Hà Nội' },
  { name: 'Đà Nẵng', aliases: ['đà nẵng', 'da nang', 'bà nà', 'ngũ hành sơn'], province: 'Đà Nẵng' },
  { name: 'Ninh Bình', aliases: ['ninh bình', 'ninh binh', 'tràng an', 'bái đính', 'tam cốc'], province: 'Ninh Bình' },
  { name: 'Quảng Ninh', aliases: ['hạ long', 'ha long', 'vịnh hạ long', 'quảng ninh'], province: 'Quảng Ninh' },
  { name: 'Quảng Bình', aliases: ['phong nha', 'kẻ bàng', 'sơn đoòng', 'quảng bình'], province: 'Quảng Bình' },
  { name: 'TP. Hồ Chí Minh', aliases: ['sài gòn', 'sai gon', 'tp hcm', 'tphcm', 'hồ chí minh', 'bến thành'], province: 'TP. Hồ Chí Minh' },
  { name: 'Sa Pa', aliases: ['sa pa', 'sapa', 'fansipan', 'lào cai'], province: 'Lào Cai' }
];

export function classifyUserIntent(rawMessage: string, currentContext?: any): IntentClassificationResult {
  const query = (rawMessage || '').trim().toLowerCase();
  
  // 1. Detect location mentioned in query
  let detectedLocation: string | undefined;
  for (const loc of VIETNAM_LOCATIONS) {
    if (loc.aliases.some(alias => query.includes(alias))) {
      detectedLocation = loc.name;
      break;
    }
  }

  // Fallback to location from current context if not explicitly mentioned in query
  if (!detectedLocation && currentContext?.province) {
    detectedLocation = currentContext.province;
  }

  // 2. Pure Greeting Detection (e.g., "xin chào", "hello", "chào bạn", "chào em", "chào em bảo an", "hi")
  const greetingPatterns = [
    /^(xin\s+)?chào(\s+(bạn|em|ad|admin|bảo\s+an|hdv|mọi\s+người|đoàn))?[\s!\.?,~]*$/i,
    /^(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening)[\s!\.?,~]*$/i,
    /^(bạn|em)\s+(là\s+ai|tên\s+gì)[\s!\.?,~]*$/i
  ];

  const isPureGreeting = greetingPatterns.some(pattern => pattern.test(query));
  if (isPureGreeting) {
    return {
      intent: 'GREETING',
      confidence: 0.98,
      location: detectedLocation,
      isPureGreeting: true,
      fastGreetingReply: {
        vi: `Dạ em chào quý anh chị trong đoàn! Em là Bảo An - Hướng dẫn viên du lịch văn hóa của Hồn Đất Việt. Rất vui được đồng hành cùng mọi người! Quý vị muốn em thuyết minh về di tích lịch sử, giới thiệu đặc sản món ngon hay tư vấn lịch trình tham quan hôm nay ạ?`,
        en: `Hello and welcome! I’m Bao An, your dedicated cultural tour guide at Hồn Đất Việt. Delighted to accompany you! Would you like me to introduce historical heritage sites, authentic local cuisine, or craft an optimized travel itinerary today?`
      },
      suggestedFocus: 'Lời chào thân thiện, giới thiệu vai trò hướng dẫn viên và gợi mở 3 hướng tìm hiểu (di tích, ẩm thực, lịch trình).'
    };
  }

  // 3. Culinary Intent Detection
  const culinaryKeywords = [
    'ăn gì', 'món ăn', 'đặc sản', 'ẩm thực', 'quán ngon', 'quán ăn', 'quán cà phê', 'ăn uống',
    'chợ đêm', 'bún', 'phở', 'bánh', 'cao lầu', 'mì quảng', 'cơm gà', 'chè', 'nem', 'bánh mì',
    'bánh tráng', 'chả cá', 'cơm tấm', 'hủ tiếu', 'thức uống', 'ăn sáng', 'ăn trưa', 'ăn tối'
  ];
  if (culinaryKeywords.some(kw => query.includes(kw))) {
    return {
      intent: 'CULINARY',
      confidence: 0.92,
      location: detectedLocation,
      topic: 'Ẩm thực & Món ngon bản địa',
      suggestedFocus: detectedLocation 
        ? `Tập trung hoàn toàn vào đặc sản và quán ăn nức tiếng tại ${detectedLocation}. Không chuyển hướng sang lịch sử di tích trừ phi có liên quan trực tiếp đến món ăn.`
        : 'Tập trung vào đặc sản truyền thống, hương vị đặc trưng và địa chỉ quán chuẩn vị dân bản xứ.'
    };
  }

  // 4. Ticket, Opening Hours & Practical Visiting Tips Intent
  const practicalKeywords = [
    'vé', 'giá vé', 'giờ mở cửa', 'mở cửa', 'đóng cửa', 'thời gian tham quan', 'bao nhiêu tiền',
    'quy định', 'trang phục', 'mặc gì', 'gửi xe', 'chỗ để xe', 'đường đi', 'lối vào', 'bản đồ tham quan'
  ];
  if (practicalKeywords.some(kw => query.includes(kw))) {
    return {
      intent: 'TICKETS_HOURS',
      confidence: 0.9,
      location: detectedLocation,
      topic: 'Thông tin tham quan & Quy định',
      suggestedFocus: 'Cung cấp lưu ý thực tế, nhắc nhở trang phục lịch sự và khuyên du khách kiểm tra bảng giá chính thức tại điểm đến; tuyệt đối không tự bịa đặt giá vé.'
    };
  }

  // 5. Itinerary Planning Intent
  const itineraryKeywords = [
    'lịch trình', '1 ngày', '2 ngày', '3 ngày', 'kế hoạch', 'tour', 'đi đâu', 'buổi sáng', 'buổi chiều',
    'buổi tối', 'hành trình', 'lộ trình', 'tham quan trong ngày', 'gợi ý chuyến đi'
  ];
  if (itineraryKeywords.some(kw => query.includes(kw))) {
    return {
      intent: 'ITINERARY',
      confidence: 0.9,
      location: detectedLocation,
      topic: 'Lịch trình tham quan tối ưu',
      suggestedFocus: 'Chia rõ khung giờ sáng - trưa - chiều - tối, kết hợp hài hòa giữa di sản văn hóa, trải nghiệm làng nghề và thưởng thức ẩm thực.'
    };
  }

  // 6. Weather & Best Travel Time Intent
  const weatherKeywords = [
    'thời tiết', 'mùa nào đẹp', 'tháng mấy', 'mùa mưa', 'mùa khô', 'nắng', 'nhiệt độ', 'dự báo', 'khí hậu', 'mùa lễ hội'
  ];
  if (weatherKeywords.some(kw => query.includes(kw))) {
    return {
      intent: 'WEATHER',
      confidence: 0.88,
      location: detectedLocation,
      topic: 'Thời tiết & Thời điểm tham quan lý tưởng',
      suggestedFocus: 'Mô tả khí hậu theo mùa, thời điểm lý tưởng trong năm và thời gian ánh sáng vàng (golden hour) để chụp ảnh đẹp.'
    };
  }

  // 7. Follow-up Question Intent (e.g. "còn món ăn thì sao?", "thế còn chùa cầu?", "ngoài ra còn gì nữa?")
  const followUpKeywords = [
    'còn', 'thế còn', 'tiếp theo', 'ngoài ra', 'ở đó có gì nữa', 'thế à', 'vậy thì', 'sao nữa', 'như thế nào nữa'
  ];
  if (followUpKeywords.some(kw => query.startsWith(kw) || query.includes(kw))) {
    return {
      intent: 'FOLLOW_UP',
      confidence: 0.85,
      location: detectedLocation,
      topic: 'Hỏi nối tiếp ngữ cảnh trước',
      suggestedFocus: 'Kết nối mượt mà với câu hỏi trước, trả lời ngay thắc mắc mới mà không cần lặp lại toàn bộ thông tin cũ.'
    };
  }

  // 8. Heritage, History & Architecture Intent
  const heritageKeywords = [
    'di tích', 'lịch sử', 'chùa', 'đền', 'thành', 'lăng', 'cố đô', 'triều đại', 'vua', 'kiến trúc',
    'xây dựng năm nào', 'ai xây', 'ý nghĩa', 'truyền thuyết', 'sự tích', 'cổ phục', 'bảo vật', 'khảo cổ'
  ];
  if (heritageKeywords.some(kw => query.includes(kw))) {
    return {
      intent: 'HERITAGE_MONUMENT',
      confidence: 0.9,
      location: detectedLocation,
      topic: 'Lịch sử & Di sản văn hóa',
      suggestedFocus: 'Phân biệt rạch ròi giữa chính sử đã xác minh và truyền thuyết dân gian. Làm nổi bật giá trị kiến trúc và chiều sâu văn hóa.'
    };
  }

  // Default General Intent
  return {
    intent: 'GENERAL',
    confidence: 0.7,
    location: detectedLocation,
    suggestedFocus: 'Trả lời súc tích, cấu trúc rõ ràng bằng Markdown, tập trung trực tiếp vào ý hỏi của du khách.'
  };
}
