// js/api-gemini.js
// Handles communication with Google Gemini API

export const api = {
    /**
     * Send review text to Gemini for analysis
     * @param {string} text - The review text to analyze
     * @param {string} apiKey - The Gemini API Key
     * @returns {Promise<Object>} The parsed JSON result
     */
    async analyzeVOC(text, apiKey) {
        if (!apiKey) throw new Error("API 키가 설정되지 않았습니다.");
        if (!text || text.trim() === '') throw new Error("분석할 텍스트가 없습니다.");

        const cleanApiKey = apiKey.trim();

        // Basic validation: Gemini API keys should not contain Korean characters or be extremely long prompts
        if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(cleanApiKey) || cleanApiKey.length > 100) {
            throw new Error("API 키 형식이 올바르지 않습니다. 혹시 실수로 프롬프트나 다른 텍스트를 복사해서 넣으셨나요? (AI Studio에서 발급받은 'AIza...'로 시작하는 키여야 합니다.)");
        }

        const actualModel = "gemini-2.5-flash";
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${cleanApiKey}`;

        const systemPrompt = `당신은 VOC 분석 전문가이자 시니어 프로덕트 매니저(PM), UX 리서처입니다.
제공된 리뷰 데이터를 분석하여 다음 요구사항을 충족하는 JSON으로만 응답하세요.

[요구사항]
1. 감정 분석: 전체 리뷰 문단의 긍정, 중립, 부정 비율 계산 (합계 100).
2. 트렌드 요약: 전체 리뷰 데이터의 주요 흐름을 한 문단으로 명확히 요약.
3. 리뷰 트렌드 차트용 데이터 (Mock Data): 제공된 데이터 기반으로 가상의 주간 단위(Week 1~4) 리뷰 개수 추이(긍/부/중립) 시뮬레이션.
   - 키값 'trend_data' 배열로 주차별 데이터 제공.
4. 핵심 키워드: 반복 등장하거나 중요한 키워드 추출 (TF-IDF 고려). 
   - 각 키워드에 대해 빈도수(count)와 평균 감정 점수(-1 ~ +1 사이의 소수점) 제공.
5. 핵심 문제점 분석 및 개선 아이디어 (Problems):
   - 부정 리뷰 중심으로 핵심 문제 도출. 문제 빈도와 감정 강도 기반.
   - title: 문제 요약 제목.
   - desc: 상세 문제 설명 및 사용자 불만 근거.
   - severity_score: 문제 영향도(1~10). 빈도수와 감정점수를 바탕으로 중요도 계산.
   - impact_score: 비즈니스/사용자 경험 영향도 (1~10).
   - effort_score: 개발 난이도 (1~10).
   - product_insight: 프로덕트 기획 관점의 개선 방향 (기능 추가/제거/정책 변경 제안).
   - ux_insight: UX/UI 관점의 개선 방향 (사용성 문제 해결, 네비게이션 개선 등).

[응답 포맷]
{
  "sentiment": { "positive": 0, "neutral": 0, "negative": 0 },
  "summary": "전체 리뷰 트렌드 요약",
  "trend_data": [
    { "period": "Week 1", "positive": 10, "neutral": 5, "negative": 15 },
    { "period": "Week 2", "positive": 12, "neutral": 4, "negative": 20 }
  ],
  "keywords": [
    { "text": "단어", "count": 10, "sentiment_score": -0.8 }
  ],
  "problems": [
    {
      "id": "p1",
      "title": "요약",
      "desc": "상세 설명",
      "severity_score": 8,
      "impact_score": 9,
      "effort_score": 4,
      "product_insight": "프로덕트 개선 제안",
      "ux_insight": "UX/UI 개선 제안"
    }
  ]
}

[필수] 결과는 반드시 유효한 JSON이어야 하며, 제어 문자나 줄바꿈은 반드시 이스케이프하세요.`;

        try {
            // Pre-processing: simple emoji cleaning
            const cleanedText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

            const body = {
                contents: [{ parts: [{ text: `다음 VOC 데이터를 전처리하고 분석하여 인사이트를 도출해 주세요:\n${cleanedText}` }] }],
                system_instruction: { parts: [{ text: systemPrompt }] },
                generationConfig: {
                    temperature: 0.1,
                    response_mime_type: "application/json"
                }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                console.error("Gemini API Error Response:", errData);
                const msg = errData.error?.message || `API 연결 실패 (${response.status})`;
                throw new Error(msg);
            }

            const data = await response.json();
            let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!resultText) throw new Error("AI 응답이 비어있습니다.");

            // 1. Clean markdown
            resultText = resultText.replace(/```(json)?/g, '').replace(/```/g, '').trim();

            // 2. Extra cautious cleaning for common LLM JSON errors
            const startIdx = resultText.indexOf('{');
            const endIdx = resultText.lastIndexOf('}');
            if (startIdx !== -1 && endIdx !== -1) {
                resultText = resultText.substring(startIdx, endIdx + 1);
            }

            // 3. Fix literal newlines in strings which cause "Unterminated string" error
            const sanitizedText = resultText.replace(/"([^"]*)"/g, (match, p1) => {
                const cleaned = p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
                return `"${cleaned}"`;
            });

            try {
                return JSON.parse(sanitizedText);
            } catch (e) {
                console.warn("Sanitized JSON parse failed, trying desperate cleanup...", e);
                const lastAttempt = sanitizedText.replace(/[\n\r\t]/g, ' ');
                return JSON.parse(lastAttempt);
            }
        } catch (error) {
            console.error("Gemini API Error:", error);
            throw error;
        }
    }
};
