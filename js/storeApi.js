// js/storeApi.js
// Handles fetching reviews from the Apple App Store RSS feed

export const storeApi = {
    /**
     * Fetch reviews from App Store
     * @param {string} appId - The Apple App Store ID (e.g. 362057947)
     * @param {number} targetCount - 50, 100, or 200
     * @param {number} maxRating - 0: All, 1: 1 only, 2: 2 or less, 3: 3 or less
     * @returns {Promise<Array>} Array of filtered review objects
     */
    async searchApp(term) {
        if (!term) throw new Error("검색어를 입력해주세요.");

        const baseUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=kr&entity=software&limit=1`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(baseUrl)}`;

        try {
            let response = await fetch(baseUrl);
            let data;

            if (!response.ok) {
                console.warn(`Search direct fetch failed, trying proxy...`);
                response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`검색 서비스 응답 오류 (HTTP ${response.status})`);
                const proxyData = await response.json();
                data = JSON.parse(proxyData.contents);
            } else {
                data = await response.json();
            }

            if (!data.results || data.results.length === 0) {
                throw new Error("검색 결과가 없습니다. 앱 이름을 정확히 입력하거나 ID를 직접 입력해 주세요.");
            }

            const result = data.results[0];
            return {
                id: result.trackId.toString(),
                name: result.trackName,
                seller: result.sellerName,
                icon: result.artworkUrl100
            };
        } catch (error) {
            console.error("Search Error:", error);
            throw new Error(`앱 검색 중 오류가 발생했습니다: ${error.message}`);
        }
    },

    async fetchReviews(appId, targetCount = 50, maxRating = 0) {
        if (!appId) throw new Error("앱 ID를 입력해주세요.");

        // iTunes RSS API limitation: max 50 items per page, max 10 pages.
        const itemsPerPage = 50;
        const totalPages = Math.ceil(targetCount / itemsPerPage);
        let allReviews = [];

        for (let page = 1; page <= totalPages; page++) {
            const baseUrl = `https://itunes.apple.com/kr/rss/customerreviews/page=${page}/id=${appId}/sortby=mostrecent/json`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(baseUrl)}`;

            let data;
            try {
                // Try direct fetch first
                let response = await fetch(baseUrl);

                if (!response.ok) {
                    console.warn(`Direct fetch failed (HTTP ${response.status}), trying proxy...`);
                    response = await fetch(proxyUrl);
                    if (!response.ok) throw new Error(`Proxy fetch failed (HTTP ${response.status})`);
                    const proxyData = await response.json();
                    data = JSON.parse(proxyData.contents);
                } else {
                    data = await response.json();
                }

                if (!data.feed || !data.feed.entry) {
                    // It's possible we reached the end of reviews
                    break;
                }

                // Apple's RSS feed format puts the app info in the first entry sometimes,
                // but usually inside customerreviews it's strictly reviews if the app has reviews.
                // We map raw entry data into our desired format
                let rawEntries = data.feed.entry;
                if (!Array.isArray(rawEntries)) {
                    rawEntries = [rawEntries];
                }

                const pageReviews = rawEntries
                    .filter(entry => entry && entry['im:rating'] && entry.content)
                    .map(entry => {
                        return {
                            id: entry.id ? entry.id.label : Math.random().toString(),
                            author: entry.author ? entry.author.name.label : '알 수 없음',
                            rating: parseInt(entry['im:rating'].label, 10),
                            title: entry.title ? entry.title.label : '',
                            content: entry.content ? entry.content.label : ''
                        };
                    });

                allReviews = allReviews.concat(pageReviews);

            } catch (error) {
                console.error(`Page ${page} process error:`, error);
                if (page === 1) {
                    throw new Error(`리뷰 수집 실패: ${error.message}. 앱 ID가 정확한지 확인해 주세요.`);
                } else {
                    break;
                }
            }
        }

        // Apply Ranking/Rating filters
        let filteredReviews = allReviews;
        maxRating = parseInt(maxRating, 10);
        if (maxRating > 0) {
            filteredReviews = filteredReviews.filter(r => {
                if (maxRating === 1) return r.rating === 1;
                return r.rating <= maxRating;
            });
        }

        // Slice to exact target count if it exceeds
        if (filteredReviews.length > targetCount) {
            filteredReviews = filteredReviews.slice(0, targetCount);
        }

        return filteredReviews;
    }
};
