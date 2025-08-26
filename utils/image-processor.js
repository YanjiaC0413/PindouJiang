/**
 * image-processor.js
 * 
 * This file contains utility functions for advanced image processing,
 * such as filtering, to achieve artistic effects like cartoonization.
 */

/**
 * Applies a Bilateral Filter to the image data.
 * This filter smooths the image while preserving edges, which is great for a cartoon effect.
 * 
 * @param {ImageData} imageData - The original image data from a canvas.
 * @param {number} spatialSigma - The standard deviation for the spatial distance (kernel size). Controls how much the filter blurs.
 * @param {number} colorSigma - The standard deviation for the color distance. Controls how much different colors are blended.
 * @returns {ImageData} - The processed image data.
 */
function applyBilateralFilter(imageData, spatialSigma = 5, colorSigma = 20) {
    const { data, width, height } = imageData;
    const new_data = new Uint8ClampedArray(data.length);
    const radius = Math.ceil(spatialSigma * 2);

    // Pre-calculate Gaussian values for speed
    const spatialGaussian = new Array(radius * 2 + 1).fill(0).map((_, i) => {
        const x = i - radius;
        return Math.exp(-(x * x) / (2 * spatialSigma * spatialSigma));
    });
    const colorGaussian = new Array(256).fill(0).map((_, i) => {
        return Math.exp(-(i * i) / (2 * colorSigma * colorSigma));
    });

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let totalWeight = 0;
            let sumR = 0, sumG = 0, sumB = 0;
            const centerIndex = (y * width + x) * 4;
            const r0 = data[centerIndex];
            const g0 = data[centerIndex + 1];
            const b0 = data[centerIndex + 2];

            for (let j = -radius; j <= radius; j++) {
                for (let i = -radius; i <= radius; i++) {
                    const currentX = x + i;
                    const currentY = y + j;

                    if (currentX >= 0 && currentX < width && currentY >= 0 && currentY < height) {
                        const currentIndex = (currentY * width + currentX) * 4;
                        const r1 = data[currentIndex];
                        const g1 = data[currentIndex + 1];
                        const b1 = data[currentIndex + 2];

                        const spatialWeight = spatialGaussian[i + radius] * spatialGaussian[j + radius];
                        const colorWeight = colorGaussian[Math.abs(r0 - r1)] * colorGaussian[Math.abs(g0 - g1)] * colorGaussian[Math.abs(b0 - b1)];

                        const weight = spatialWeight * colorWeight;

                        totalWeight += weight;
                        sumR += r1 * weight;
                        sumG += g1 * weight;
                        sumB += b1 * weight;
                    }
                }
            }

            new_data[centerIndex] = sumR / totalWeight;
            new_data[centerIndex + 1] = sumG / totalWeight;
            new_data[centerIndex + 2] = sumB / totalWeight;
            new_data[centerIndex + 3] = data[centerIndex + 3]; // Keep original alpha
        }
    }

    return new ImageData(new_data, width, height);
}

module.exports = {
    applyBilateralFilter,
};
