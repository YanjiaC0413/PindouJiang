// utils/colors.js
const mardPaletteData = require('../mard_palette.js');

/**
 * Converts a HEX color string to an RGB array.
 * @param {string} hex The hex color string (e.g., "#RRGGBB").
 * @returns {number[]|null} An array [r, g, b] or null if the hex is invalid.
 */
function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string') return null;
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
}

// Process the palette data to include RGB values for distance calculation.
// We also filter out any colors that might have an invalid hex code.
const processedPalette = mardPaletteData.map(color => ({
    ...color,
    rgb: hexToRgb(color.hex)
})).filter(color => color.rgb !== null);


// 计算两种颜色之间的欧氏距离
function colorDistance(rgb1, rgb2) {
    // ... existing code ...
    if (!rgb1 || !rgb2) return Infinity;
    const rDiff = rgb1[0] - rgb2[0];
    const gDiff = rgb1[1] - rgb2[1];
    const bDiff = rgb1[2] - rgb2[2];
    return Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
}

// 在调色板中找到最接近的颜色
function findClosestColor(rgb, palette) {
    if (!rgb || rgb.some(c => c === undefined)) {
        // 如果输入的rgb无效，返回一个默认颜色避免崩溃
        return palette.find(p => p.name.includes('Black')) || palette[0];
    }

    let closestColor = palette[0];
    let minDistance = colorDistance(rgb, closestColor.rgb);

    for (let i = 1; i < palette.length; i++) {
        const distance = colorDistance(rgb, palette[i].rgb);
        if (distance < minDistance) {
            minDistance = distance;
            closestColor = palette[i];
        }
    }
    return closestColor;
}

module.exports = {
    palette: processedPalette,
    findClosestColor,
};