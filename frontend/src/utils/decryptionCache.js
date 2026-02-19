/**
 * Decryption Cache - Singleton cache for decrypted file blob URLs
 * Prevents duplicate decryption of the same encrypted file
 */

class DecryptionCache {
    constructor() {
        this.cache = new Map();
        this.pendingDecryptions = new Map(); // Track in-progress decryptions
    }

    /**
     * Get cached blob URL for a file
     * @param {string} fileUrl - The encrypted file URL
     * @returns {string|null} - Cached blob URL or null
     */
    get(fileUrl) {
        const cached = this.cache.get(fileUrl);
        if (cached) {
            return cached.blobUrl;
        }
        return null;
    }

    /**
     * Store decrypted blob URL in cache
     * @param {string} fileUrl - The encrypted file URL
     * @param {string} blobUrl - The decrypted blob URL
     * @param {object} metadata - Additional metadata (mimeType, size, etc.)
     */
    set(fileUrl, blobUrl, metadata = {}) {
        this.cache.set(fileUrl, {
            blobUrl,
            metadata,
            timestamp: Date.now()
        });
    }

    /**
     * Check if a decryption is already in progress
     * @param {string} fileUrl - The encrypted file URL
     * @returns {Promise|null} - Pending promise or null
     */
    getPending(fileUrl) {
        return this.pendingDecryptions.get(fileUrl) || null;
    }

    /**
     * Mark a decryption as in-progress
     * @param {string} fileUrl - The encrypted file URL
     * @param {Promise} promise - The decryption promise
     */
    setPending(fileUrl, promise) {
        this.pendingDecryptions.set(fileUrl, promise);

        // Auto-cleanup when done
        promise.finally(() => {
            this.pendingDecryptions.delete(fileUrl);
        });
    }

    /**
     * Remove a file from cache and revoke its blob URL
     * @param {string} fileUrl - The encrypted file URL
     */
    remove(fileUrl) {
        const cached = this.cache.get(fileUrl);
        if (cached && cached.blobUrl && cached.blobUrl.startsWith('blob:')) {
            URL.revokeObjectURL(cached.blobUrl);
        }
        this.cache.delete(fileUrl);
    }

    clear() {
        for (const cached of this.cache.values()) {
            if (cached.blobUrl && cached.blobUrl.startsWith('blob:')) {
                URL.revokeObjectURL(cached.blobUrl);
            }
        }
        this.cache.clear();
        this.pendingDecryptions.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        return {
            cacheSize: this.cache.size,
            pendingCount: this.pendingDecryptions.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

// Export singleton instance
export const decryptionCache = new DecryptionCache();

// Cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        decryptionCache.clear();
    });
}
