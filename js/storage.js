// js/storage.js
// Handles saving and retrieving the OpenAI API key using localStorage

const API_KEY_STORAGE_KEY = 'voc_analyzer_openai_key';

export const storage = {
    /**
     * Save API Key to localStorage
     * @param {string} key - The OpenAI API Key
     */
    saveApiKey(key) {
        if (!key) return;
        localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    },

    /**
     * Get API Key from localStorage
     * @returns {string|null} The stored API key or null if not found
     */
    getApiKey() {
        return localStorage.getItem(API_KEY_STORAGE_KEY);
    },

    /**
     * Remove API Key from localStorage
     */
    removeApiKey() {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
    },

    /**
     * Check if an API key exists
     * @returns {boolean}
     */
    hasApiKey() {
        return !!this.getApiKey();
    },

    /** Analysis History Logic **/
    getHistory() {
        const data = localStorage.getItem('voc_history');
        return data ? JSON.parse(data) : [];
    },

    saveToHistory(analysis) {
        const history = this.getHistory();
        // 최신 결과가 위로 오도록 앞에 추가
        const newHistory = [analysis, ...history].slice(0, 20); 
        localStorage.setItem('voc_history', JSON.stringify(newHistory));
    }
};
