import { storage } from './storage.js';
import { api } from './api-gemini.js?v=702';
import { ui } from './ui.js';
import { storeApi } from './storeApi.js?v=702';

// DOM Elements (Initially null, populated in init)
let els = {};

function populateElements() {
    try {
        els = {
            settingsBtn: document.getElementById('navSettingsBtn'), // index.html id is navSettingsBtn
            settingsModal: document.getElementById('settingsModal'),
            closeSettingsBtn: document.getElementById('closeSettingsBtn'),
            saveSettingsBtn: document.getElementById('saveSettingsBtn'),
            apiKeyInput: document.getElementById('apiKey'),

            reviewInput: document.getElementById('reviewInput'),
            analyzeBtn: document.getElementById('analyzeBtn'),

            dashboardEmptyState: document.getElementById('dashboardEmptyState'),
            dashboardLoadingState: document.getElementById('dashboardLoadingState'),
            dashboardResults: document.getElementById('dashboardResults'),

            viewToggles: document.querySelectorAll('.btn-toggle'),

            // App Store Elements
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            appIdInput: document.getElementById('appIdInput'),
            reviewCount: document.getElementById('reviewCount'),
            fetchReviewsBtn: document.getElementById('fetchReviewsBtn'),
            fetchedReviewsContainer: document.getElementById('fetchedReviewsContainer'),
            fetchedCount: document.getElementById('fetchedCount'),
            clearReviewsBtn: document.getElementById('clearReviewsBtn'),
            reviewsList: document.getElementById('reviewsList'),

            // New Sidebar Elements
            btnNewAnalysis: document.getElementById('btnNewAnalysis'),
            historyList: document.getElementById('historyList')
        };
        console.log("DOM Elements populated.");
    } catch (e) {
        console.error("Error populating elements:", e);
    }
}

// Global state to store the latest raw response
let currentAnalysisResult = null;
let currentView = 'product'; // 'product' or 'design'
let inputMode = 'manual'; // 'manual' or 'store'
let fetchedReviewsData = [];

// ------------------------------------------------------------------
// Initialization
// ------------------------------------------------------------------
function init() {
    console.log("VOC Analyzer: Initializing...");
    populateElements();
    setupEventListeners();

    // 초기 상태 설정 (manual 탭 활성화)
    inputMode = 'manual';
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (tabBtns && tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            const isManual = btn.dataset.tab === 'manual';
            btn.classList.toggle('active', isManual);
        });
    }
    if (tabContents && tabContents.length > 0) {
        tabContents.forEach(content => {
            const isManual = content.id === 'tab-manual';
            content.classList.toggle('active', isManual);
            if (isManual) {
                content.style.setProperty('display', 'block', 'important');
            } else {
                content.style.setProperty('display', 'none', 'important');
            }
        });
    }

    // Automatically open settings if no API key is found
    if (storage && !storage.hasApiKey()) {
        openSettings();
    }

    renderHistory();
}

// ------------------------------------------------------------------
// Event Listeners
// ------------------------------------------------------------------
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // Settings Modal
    els.settingsBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openSettings();
    });
    els.btnNewAnalysis?.addEventListener('click', (e) => {
        e.preventDefault();
        handleNewAnalysis();
    });
    els.closeSettingsBtn?.addEventListener('click', closeSettings);
    els.saveSettingsBtn?.addEventListener('click', saveSettings);

    // Close modal on outside click
    els.settingsModal?.addEventListener('click', (e) => {
        if (e.target === els.settingsModal) closeSettings();
    });

    // Analyze Button
    els.analyzeBtn?.addEventListener('click', handleAnalyze);

    // Problem View Toggle
    els.viewToggles?.forEach(btn => {
        btn.addEventListener('click', (e) => {
            els.viewToggles.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // Input Tabs Toggle (Direct query for safety)
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    console.log(`Setting up ${tabBtns.length} tab buttons...`);

    if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.dataset.tab;
                console.log("Tab Switching to:", targetTab);

                tabBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');

                tabContents.forEach(content => {
                    if (content.id === `tab-${targetTab}`) {
                        content.classList.add('active');
                        content.style.setProperty('display', 'block', 'important');
                    } else {
                        content.classList.remove('active');
                        content.style.setProperty('display', 'none', 'important');
                    }
                });

                inputMode = targetTab;
            });
        });
    }

    // App Store Actions
    els.fetchReviewsBtn?.addEventListener('click', handleFetchReviews);
    els.clearReviewsBtn?.addEventListener('click', handleClearReviews);
}

// ------------------------------------------------------------------
// Fetch App Store Reviews Logic
// ------------------------------------------------------------------
async function handleFetchReviews() {
    const appId = els.appIdInput.value.trim();
    if (!appId) {
        alert("앱스토어 앱 ID를 입력해주세요.");
        els.appIdInput.focus();
        return;
    }

    const count = parseInt(els.reviewCount.value, 10) || 50;

    // UI Loading state for fetch button
    els.fetchReviewsBtn.disabled = true;
    els.fetchReviewsBtn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin:0;"></div> 수집 중...';

    try {
        let finalAppId = appId;

        // If input is not a numeric ID (must be all digits), search for it
        if (!/^\d+$/.test(appId)) {
            console.log("Searching for app:", appId);
            const searchResult = await storeApi.searchApp(appId);
            finalAppId = searchResult.id;

            // Update input with the found ID and show context
            els.appIdInput.value = `${searchResult.name} (${finalAppId})`;
            console.log(`Found App: ${searchResult.name} (ID: ${finalAppId})`);
        }

        fetchedReviewsData = await storeApi.fetchReviews(finalAppId, count, 0);
        renderFetchedReviewsUI(fetchedReviewsData);
    } catch (error) {
        console.error("Fetch Error:", error);
        alert(error.message);
    } finally {
        els.fetchReviewsBtn.disabled = false;
        els.fetchReviewsBtn.innerHTML = '<i data-lucide="search"></i> 리뷰 수집하기';
        if (window.lucide) window.lucide.createIcons();
    }
}

function renderFetchedReviewsUI(reviews) {
    els.fetchedReviewsContainer.classList.remove('hidden');
    els.fetchedCount.textContent = `수집 완료: ${reviews.length}개`;
    els.reviewsList.innerHTML = '';

    if (reviews.length === 0) {
        els.reviewsList.innerHTML = '<p class="text-muted" style="text-align:center; padding: 1rem;">가져올 수 있는 리뷰가 없습니다.</p>';
        return;
    }

    reviews.forEach(r => {
        const card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = `
            <div class="review-card-header">
                <span>${r.author}</span>
                <span class="review-card-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            </div>
            <div class="review-card-title">${r.title}</div>
            <div class="review-card-text">${r.content}</div>
        `;
        els.reviewsList.appendChild(card);
    });
}

function handleClearReviews() {
    fetchedReviewsData = [];
    els.fetchedReviewsContainer.classList.add('hidden');
    els.reviewsList.innerHTML = '';
    els.appIdInput.value = '';
}

function handleNewAnalysis() {
    // Reset state and UI
    currentAnalysisResult = null;
    fetchedReviewsData = [];
    els.reviewInput.value = '';
    els.appIdInput.value = '';
    els.fetchedReviewsContainer.classList.add('hidden');
    els.reviewsList.innerHTML = '';
    
    // UI states
    setDashboardState('empty');
    
    // Sidebar active state
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    els.btnNewAnalysis.classList.add('active');
}

function renderHistory() {
    if (!els.historyList) return;
    const history = storage.getHistory();
    els.historyList.innerHTML = '';

    if (history.length === 0) {
        // 타이틀은 index.html에 있고, 목록만 비움
        return;
    }

    history.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.textContent = item.appName || item.title || `분석 ${history.length - index}`;
        div.addEventListener('click', () => {
            loadAnalysisFromHistory(item);
        });
        els.historyList.appendChild(div);
    });
}

function loadAnalysisFromHistory(item) {
    console.log("Loading analysis from history:", item);
    currentAnalysisResult = item.result;
    
    // Sidebar active state 관리 (필요시)
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));

    // Render results
    ui.init(item.result.problems, item.reviews);
    ui.renderKPIs(item.reviews.length, item.avgRating);
    ui.renderKeywords(item.result.keywords, item.reviews);
    ui.filterAndRenderProblems();

    setDashboardState('results');
}


// ------------------------------------------------------------------
// State Changes
// ------------------------------------------------------------------
function setDashboardState(state) {
    els.dashboardEmptyState.classList.add('hidden');
    els.dashboardLoadingState.classList.add('hidden');
    els.dashboardResults.classList.add('hidden');

    const mainLayout = document.querySelector('.main-layout');
    mainLayout.classList.remove('state-empty', 'state-loading', 'state-results');
    mainLayout.classList.add(`state-${state}`);

    switch (state) {
        case 'empty':
            els.dashboardEmptyState.classList.remove('hidden');
            break;
        case 'loading':
            els.dashboardLoadingState.classList.remove('hidden');
            break;
        case 'results':
            els.dashboardResults.classList.remove('hidden');
            break;
    }
}

function setAnalyzeButtonState(isLoading) {
    if (isLoading) {
        els.analyzeBtn.disabled = true;
        els.analyzeBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></div> 분석 중...';
    } else {
        els.analyzeBtn.disabled = false;
        els.analyzeBtn.innerHTML = '<i data-lucide="sparkles"></i> AI로 분석하기';
        if (window.lucide) window.lucide.createIcons();
    }
}

// ------------------------------------------------------------------
// Settings Logic
// ------------------------------------------------------------------
function openSettings() {
    const key = storage.getApiKey();
    if (key) els.apiKeyInput.value = key;
    els.settingsModal.classList.remove('hidden');
}

function closeSettings() {
    els.settingsModal.classList.add('hidden');
}

function saveSettings() {
    const key = els.apiKeyInput.value.trim();
    if (key) {
        storage.saveApiKey(key);
        closeSettings();
        // Optional: Show brief toast notification here
    } else {
        alert("API 키를 입력해주세요.");
    }
}

// ------------------------------------------------------------------
// Core Logic: Analysis
// ------------------------------------------------------------------
async function handleAnalyze() {
    let textToAnalyze = "";

    if (inputMode === 'manual') {
        textToAnalyze = els.reviewInput.value.trim();
        if (!textToAnalyze) {
            alert("분석할 리뷰 텍스트를 입력해주세요.");
            els.reviewInput.focus();
            return;
        }
    } else {
        if (fetchedReviewsData.length === 0) {
            alert("먼저 앱스토어 리뷰를 수집해주세요.");
            return;
        }
        // Format reviews to provide enough context for the LLM
        textToAnalyze = fetchedReviewsData.map(r => `[별점: ${r.rating}점 / 제목: ${r.title}]\n${r.content}`).join('\n\n---다음 리뷰---\n\n');
    }

    // 1. Check for API Key
    const apiKey = storage.getApiKey();
    if (!apiKey) {
        alert("Google Gemini API 키가 필요합니다. 우측 상단 설정 아이콘에서 키를 등록해주세요.");
        openSettings();
        return;
    }

    // 2. Enter Loading State
    setDashboardState('loading');
    setAnalyzeButtonState(true);

    try {
        // 3. Call OpenAI API
        const result = await api.analyzeVOC(textToAnalyze, apiKey);

        // 4. Store result locally
        currentAnalysisResult = result;

        // 5. Transform and Render UI (Calculate missing display stats)
        const totalLines = textToAnalyze.split('\n').filter(l => l.trim().length > 0).length;
        const totalReviewsCount = inputMode === 'manual' ? totalLines : fetchedReviewsData.length;

        let avgRating = 4.2; // default mock
        if (inputMode === 'store' && fetchedReviewsData.length > 0) {
            const sum = fetchedReviewsData.reduce((acc, r) => acc + (r.rating || 5), 0);
            avgRating = sum / fetchedReviewsData.length;
        }

        // 새로운 UI 초기화 및 렌더링 호출
        const normalizedReviews = inputMode === 'manual' 
            ? textToAnalyze.split('\n').filter(l => l.trim().length > 0).map(l => ({ content: l, author: 'User', rating: 5 }))
            : fetchedReviewsData;

        ui.init(result.problems, normalizedReviews);
        ui.renderKPIs(totalReviewsCount, avgRating);
        ui.renderKeywords(result.keywords, normalizedReviews);
        ui.filterAndRenderProblems(); // 목록 및 첫 번째 항목(필요시) 렌더링

        // 6. Save to History
        const appName = inputMode === 'store' ? els.appIdInput.value.split('(')[0].trim() : "직접 입력 분석";
        storage.saveToHistory({
            id: Date.now(),
            appName,
            title: appName,
            result,
            reviews: normalizedReviews,
            avgRating,
            timestamp: new Date().toISOString()
        });
        renderHistory();

        // 7. Show Results and scroll to them
        setDashboardState('results');

        setTimeout(() => {
            els.dashboardResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

    } catch (error) {
        console.error("Analysis Failed:", error);
        alert(`분석에 실패했습니다.\n${error.message}`);
        setDashboardState('empty'); // Fall back to empty state on error
    } finally {
        setAnalyzeButtonState(false);
    }
}

// Start app
document.addEventListener('DOMContentLoaded', init);
