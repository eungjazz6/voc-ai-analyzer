// js/ui.js
// VOC Analyzer Pro v9.1 — Dashboard UI Renderer

export const ui = {
    // 내부 상태 저장 (필터링 및 상세 정보 표시용)
    state: {
        problems: [],
        filteredProblems: [],
        rawReviews: [],
        currentKeyword: null,
        selectedProblemId: null,
        currentSeverity: 'all'
    },

    /** 초기화: 원본 리뷰 데이터와 문제점 리스트 동시 저장 */
    init(problems, rawReviews) {
        this.state.problems = problems || [];
        this.state.rawReviews = rawReviews || [];
        this.state.filteredProblems = [...this.state.problems];
        this.setupFilterListeners();
    },

    setupFilterListeners() {
        const filterBtns = document.querySelectorAll('.filter-tag');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const severity = e.currentTarget.dataset.severity;
                this.state.currentSeverity = severity;
                
                // UI 업데이트
                filterBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                // 필터링 및 재렌더링
                this.filterAndRenderProblems();
            });
        });
    },

    /** 별점 평균 렌더링 */
    renderKPIs(totalReviews, avgRating) {
        const elRating = document.getElementById('kpiAvgRating');
        if (elRating) {
            elRating.textContent = avgRating ? avgRating.toFixed(1) : '0.0';
        }
    },

    /** 주요 키워드 및 클릭 시 리뷰 표시 */
    renderKeywords(keywords, reviews) {
        const tagsContainer = document.getElementById('keywordsTags');
        const quotesContainer = document.getElementById('keywordQuotes');

        if (!tagsContainer) return;
        tagsContainer.innerHTML = '';

        if (!keywords || keywords.length === 0) {
            tagsContainer.innerHTML = '<span class="text-muted">키워드가 없습니다.</span>';
            return;
        }

        keywords.forEach(kw => {
            const tag = document.createElement('span');
            tag.className = 'keyword-pill';
            tag.textContent = `${kw.text} (${kw.count || 0})`;
            tag.addEventListener('click', () => {
                // 활성화 스타일
                document.querySelectorAll('.keyword-pill').forEach(tp => tp.classList.remove('active'));
                tag.classList.add('active');
                
                // 관련 리뷰 표시 (원본 데이터 사용)
                this.renderKeywordReviews(kw.text, reviews);
            });
            tagsContainer.appendChild(tag);
        });
    },

    /** 키워드 클릭 시 원본 리뷰에서 매칭하여 모두 표시 */
    renderKeywordReviews(keyword, reviews) {
        const quotesContainer = document.getElementById('keywordQuotes');
        if (!quotesContainer) return;
        quotesContainer.innerHTML = '';

        // 실제 리뷰 원본에서 키워드 매칭 (제목 또는 내용)
        const allReviews = reviews || this.state.rawReviews || [];
        const related = allReviews.filter(r => {
            const content = r.content || '';
            const title = r.title || '';
            return content.includes(keyword) || title.includes(keyword);
        });

        if (related.length === 0) {
            quotesContainer.innerHTML = `<p class="text-muted placeholder-text">'${keyword}'와(과) 관련된 구체적인 리뷰 내용을 찾을 수 없습니다. (매칭된 리뷰 없음)</p>`;
            return;
        }

        // 제한 없이 모든 관련 리뷰 표시
        related.forEach(r => {
            const card = document.createElement('div');
            card.className = 'quote-item';
            
            const titlePart = r.title ? `<strong>${r.title}</strong><br>` : '';
            const contentPart = r.content || '';
            
            card.innerHTML = `${titlePart}${contentPart}`;
            quotesContainer.appendChild(card);
        });
    },

    /** 문제점 목록 필터링 및 렌더링 */
    filterAndRenderProblems() {
        const severity = this.state.currentSeverity;
        if (severity === 'all') {
            this.state.filteredProblems = [...this.state.problems];
        } else {
            this.state.filteredProblems = this.state.problems.filter(p => {
                const score = p.severity_score || 5;
                let sevLabel = 'low';
                if (score >= 8) sevLabel = 'high';
                else if (score >= 5) sevLabel = 'medium';
                return sevLabel === severity;
            });
        }
        this.renderProblemList();
    },

    renderProblemList() {
        const list = document.getElementById('problemList');
        if (!list) return;
        list.innerHTML = '';

        if (this.state.filteredProblems.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding: 20px; text-align: center;">조건에 맞는 문제점이 없습니다.</p>';
            return;
        }

        this.state.filteredProblems.forEach(p => {
            const score = p.severity_score || 5;
            let sevLabel = 'Low';
            let sevClass = 'low';
            if (score >= 8) { sevLabel = 'High'; sevClass = 'high'; }
            else if (score >= 5) { sevLabel = 'Medium'; sevClass = 'medium'; }

            // mock stats for visual detail
            const mentionCount = Math.floor(score * 12.5);
            const percent = Math.floor(score * 3.2);

            const card = document.createElement('div');
            card.className = `problem-card ${this.state.selectedProblemId === p.id ? 'active' : ''}`;
            card.innerHTML = `
                <div class="problem-card-title">${p.title}</div>
                <div class="problem-card-meta">
                    <span class="stats-text">${mentionCount}건 언급 | 전체 대비 ${percent}%</span>
                    <span class="priority-badge ${sevClass}">심각도: ${sevLabel}</span>
                </div>
            `;
            card.addEventListener('click', () => {
                this.state.selectedProblemId = p.id;
                document.querySelectorAll('.problem-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.renderProblemDetail(p, mentionCount, percent, sevLabel, sevClass);
            });
            list.appendChild(card);
        });
    },

    /** 문제 상세 정보 렌더링 */
    renderProblemDetail(p, mentionCount, percent, sevLabel, sevClass) {
        const wrapper = document.getElementById('problemDetailWrapper');
        const content = document.getElementById('problemDetailContent');
        const placeholder = wrapper.querySelector('.problem-detail-placeholder');

        if (placeholder) placeholder.classList.add('hidden');
        content.classList.remove('hidden');

        document.getElementById('detailTitle').textContent = p.title;
        document.getElementById('detailStats').textContent = `${mentionCount}건 언급 | 전체 대비 ${percent}%`;
        
        const badge = document.getElementById('detailBadge');
        badge.textContent = sevLabel;
        badge.className = `priority-badge ${sevClass}`;

        document.getElementById('detailInsight').textContent = p.desc || "상세 인사이트 정보가 없습니다.";

        // 권장 사항
        const productList = document.getElementById('detailProductRec');
        const uxuiList = document.getElementById('detailUxUiRec');
        
        productList.innerHTML = p.product_insight ? `<li>${p.product_insight}</li>` : '<li>제안 사항 없음</li>';
        uxuiList.innerHTML = p.ux_insight ? `<li>${p.ux_insight}</li>` : '<li>제안 사항 없음</li>';

        // 관련 리뷰 추출 로직 (현재는 목업이나, 원본 데이터에서 키워드 매칭 가능)
        const reviewsContainer = document.getElementById('detailReviews');
        reviewsContainer.innerHTML = '';
        
        // 해당 문제 제목의 핵심 단어로 실제 리뷰 필터링 시도
        const coreKeyword = p.title.split(' ')[0]; 
        const related = this.state.rawReviews.filter(r => (r.content || '').includes(coreKeyword)).slice(0, 3);

        if (related.length > 0) {
            related.forEach(r => {
                const item = document.createElement('div');
                item.className = 'quote-item';
                item.style.marginBottom = '8px';
                item.textContent = `"${r.content.substring(0, 150)}${r.content.length > 150 ? '...' : ''}"`;
                reviewsContainer.appendChild(item);
            });
        } else {
            reviewsContainer.innerHTML = '<p class="text-muted">관련 리뷰를 매칭하는 중입니다...</p>';
        }

        // Scroll to top of detail
        wrapper.scrollTop = 0;
    }
};
