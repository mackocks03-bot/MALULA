/**
 * Generates a unique transaction hash
 * Format: NEWHOPE + 12 uppercase alphanumeric characters
 */
export function generateTxHash() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let hash = 'NEWHOPE';
    for (let i = 0; i < 12; i++) {
        hash += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return hash;
}

/**
 * Returns a nicely formatted current date string
 * Example: Sep 03, 2026
 */
export function getFormattedDate() {
    const options = { year: 'numeric', month: 'short', day: '2-digit' };
    return new Date().toLocaleDateString('en-US', options);
}
