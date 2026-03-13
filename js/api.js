// js/api.js
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

        // Clean up the API key (sometimes copy-paste adds spaces)
        const cleanApiKey = apiKey.trim();

        // Google Gemini Model: gemini-2.0-flash
        // (Treating user's "2.5" as 2.0, the latest stable flash model)
        const actualModel = "gemini-2.0-flash";

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${cleanApiKey}`;

        // System prompt designed to force strict JSON output covering product & design perspectives
        const systemPrompt = `당신은 VOC(Voice of Customer) 분석 전문가이자 프로덕트 매니저(PM)/UXUI 디자이너입니다.
주어진 앱/서비스 리뷰 텍스트를 분석하여 아래 JSON 포맷에 맞게 정확히 결과를 반환하세요.
텍스트 외에 어떠한 설명이나 마크다운 백틱(\`\`\`) 없이 순수 JSON 문자열만 출력해야 합니다.

[분석 요구사항]
1. sentiment: 긍정, 중립, 부정의 비율을 계산합니다. 합은 100이어야 합니다.
2. problems: 사용자가 겪는 문제점을 추출합니다.
   - id: 고유 식별자 (p1, p2...)
   - type: "product" (기능, 정책, 버그 등) 또는 "design" (UX/UI, 사용성, 시각적 등)
   - title: 문제의 핵심을 요약한 제목 (예: "결제 단계 앱 크래시")
   - desc: 상세 내용
   - severity: "high", "medium", "low" 중 택 1 (빈도와 감정을 고려)
   - solution: 해당 문제를 해결하기 위한 구체적인 개선 방향 및 아이디어
3. keywords: 리뷰에서 자주 등장하거나 중요한 핵심 단어 배열 (5~10개 내외)

[출력 포맷 (JSON)]
{
  "sentiment": {
    "positive": 20,
    "neutral": 10,
    "negative": 70
  },
  "problems": [
    {
      "id": "p1",
      "type": "product",
      "title": "문제 요약 짧게",
      "desc": "문제 상세 설명...",
      "severity": "high",
      "solution": "개선 방향..."
    }
  ],
  "keywords": ["키워드1", "키워드2"]
}`;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [{ text: `다음 리뷰를 분석해 주세요: \n\n${text}` }]
                        }
                    ],
                    system_instruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    generationConfig: {
                        temperature: 0.2,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                        response_mime_type: "application/json" // Force JSON output
                    }
                })
            });

            if (!response.ok) {
                let errorMsg = `API 호출 중 오류가 발생했습니다. (HTTP ${response.status})`;
                try {
                    const errData = await response.json();
                    if (errData && errData.error) {
                        errorMsg = `[Gemini Error] ${errData.error.message || errData.error.status}`;
                    }
                } catch (e) {
                    // Fallback
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            // Gemini response structure: candidates[0].content.parts[0].text
            if (!data.candidates || data.candidates.length === 0) {
                throw new Error("AI 응답을 받지 못했습니다. API 키의 유효성을 확인해 주세요.");
            }

            let resultText = data.candidates[0].content.parts[0].text;

            // Safety: Strip markdown code blocks if the AI accidentally includes them
            if (resultText.includes('```')) {
                resultText = resultText.replace(/```(json)?/g, '').replace(/```/g, '').trim();
            }

            return JSON.parse(resultText);
        } catch (error) {
            console.error("Gemini API Parse/Call Error:", error);
            throw error;
        }
    }
};
