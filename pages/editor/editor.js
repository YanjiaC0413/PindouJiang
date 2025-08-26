// pages/editor/editor.js
const { palette, findClosestColor } = require('../../utils/colors.js');
const { applyBilateralFilter } = require('../../utils/image-processor.js');

Page({
    data: {
        src: '',
        pixelSize: 20,
        canvasWidth: 300,
        canvasHeight: 300,
        sourceCanvasWidth: 300,
        sourceCanvasHeight: 300,
        originalImageData: null,
        isImageLoaded: false,
    },

    onLoad(options) {
        this.pixelCanvas = null; // Initialize pixelCanvas
        this.setData({
            src: options.src,
        });
    },

    onReady() {
        this.loadAndCacheImageData();
    },

    // Step 1: Load image, draw it to a hidden canvas, and cache its pixel data
    loadAndCacheImageData() {
        const { src } = this.data;
        const query = wx.createSelectorQuery();
        query.select('#sourceCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0] || !res[0].node) {
                    console.error('Failed to find sourceCanvas. Ensure the canvas element is rendered and the ID is correct.');
                    wx.showToast({ title: '加载画布失败', icon: 'none' });
                    return;
                }

                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');
                const img = canvas.createImage();

                img.src = src;
                img.onload = () => {
                    const aspectRatio = img.width / img.height;
                    const baseSize = 300;
                    let drawWidth = baseSize;
                    let drawHeight = baseSize;

                    if (aspectRatio > 1) {
                        drawHeight = baseSize / aspectRatio;
                    } else {
                        drawWidth = baseSize * aspectRatio;
                    }

                    const finalWidth = Math.floor(drawWidth);
                    const finalHeight = Math.floor(drawHeight);

                    this.setData({
                        canvasWidth: finalWidth,
                        canvasHeight: finalHeight,
                        sourceCanvasWidth: finalWidth,
                        sourceCanvasHeight: finalHeight,
                    });

                    canvas.width = finalWidth;
                    canvas.height = finalHeight;

                    ctx.drawImage(img, 0, 0, finalWidth, finalHeight);

                    const imageData = ctx.getImageData(0, 0, finalWidth, finalHeight);
                    this.setData({
                        originalImageData: imageData,
                        isImageLoaded: true,
                    });

                    this.pixelateAndDraw();
                };

                img.onerror = () => {
                    wx.showToast({ title: '加载图片失败', icon: 'none' });
                };
            });
    },

    // Step 2: Perform pixelation using cached data and draw to the visible canvas
    pixelateAndDraw() {
        if (!this.data.isImageLoaded) {
            return;
        }

        const { pixelSize, originalImageData } = this.data;
        const query = wx.createSelectorQuery();
        query.select('#pixelCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                if (!res[0] || !res[0].node) {
                    console.error('Failed to find pixelCanvas. Ensure the canvas element is rendered and the ID is correct.');
                    wx.showToast({ title: '加载画布失败', icon: 'none' });
                    return;
                }
                const canvas = res[0].node;
                this.pixelCanvas = canvas; // Store canvas instance
                const ctx = canvas.getContext('2d');

                const imageData = originalImageData.data;
                const width = originalImageData.width;
                const height = originalImageData.height;

                canvas.width = width;
                canvas.height = height;

                for (let y = 0; y < height; y += pixelSize) {
                    for (let x = 0; x < width; x += pixelSize) {
                        const offsetX = Math.min(x + Math.floor(pixelSize / 2), width - 1);
                        const offsetY = Math.min(y + Math.floor(pixelSize / 2), height - 1);

                        const i = (offsetY * width + offsetX) * 4;

                        const r = imageData[i];
                        const g = imageData[i + 1];
                        const b = imageData[i + 2];

                        if (r === undefined || g === undefined || b === undefined) {
                            continue;
                        }

                        const closestColor = findClosestColor([r, g, b], palette);
                        ctx.fillStyle = `rgb(${closestColor.rgb[0]},${closestColor.rgb[1]},${closestColor.rgb[2]})`;
                        ctx.fillRect(x, y, pixelSize, pixelSize);
                    }
                }
            });
    },

    onSliderChange(e) {
        this.setData({ pixelSize: e.detail.value });
        this.pixelateAndDraw();
    },

    generate() {
        if (!this.data.isImageLoaded) {
            wx.showToast({ title: '图片尚未处理完成', icon: 'none' });
            return;
        }
        this.pixelateAndDraw();

        setTimeout(() => {
            if (!this.pixelCanvas) {
                wx.showToast({ title: '画布尚未准备好', icon: 'none' });
                return;
            }
            wx.canvasToTempFilePath({
                canvas: this.pixelCanvas,
                success: (res) => {
                    const eventChannel = this.getOpenerEventChannel();
                    wx.navigateTo({
                        url: '/pages/result/result',
                        success: (navRes) => {
                            navRes.eventChannel.emit('acceptDataFromOpenerPage', {
                                tempImagePath: res.tempFilePath,
                                pixelSize: this.data.pixelSize,
                                colorData: this.getColorData(),
                                brand: 'MARD', // Default brand
                            });
                        },
                    });
                },
                fail: (err) => {
                    console.error('Failed to generate temp file path:', err);
                    wx.showToast({ title: '生成图纸失败', icon: 'none' });
                },
            });
        }, 200);
    },

    getColorData() {
        if (!this.data.isImageLoaded) return {};

        const { pixelSize, originalImageData } = this.data;
        const imageData = originalImageData.data;
        const width = originalImageData.width;
        const height = originalImageData.height;

        const grid = [];
        const colorMap = {};

        for (let y = 0; y < height; y += pixelSize) {
            const row = [];
            for (let x = 0; x < width; x += pixelSize) {
                const offsetX = Math.min(x + Math.floor(pixelSize / 2), width - 1);
                const offsetY = Math.min(y + Math.floor(pixelSize / 2), height - 1);
                const i = (offsetY * width + offsetX) * 4;
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];

                if (r === undefined || g === undefined || b === undefined) {
                    row.push({ color: 'transparent', code: '' });
                    continue;
                };

                const closestColor = findClosestColor([r, g, b], palette);

                row.push({
                    color: `rgb(${closestColor.rgb[0]},${closestColor.rgb[1]},${closestColor.rgb[2]})`,
                    code: closestColor.code,
                });

                // Aggregate for the material list
                const colorKey = closestColor.code;
                if (colorMap[colorKey]) {
                    colorMap[colorKey].count++;
                } else {
                    colorMap[colorKey] = {
                        ...closestColor,
                        color: `rgb(${closestColor.rgb[0]},${closestColor.rgb[1]},${closestColor.rgb[2]})`,
                        count: 1,
                    };
                }
            }
            grid.push(row);
        }

        const colorList = Object.values(colorMap).sort((a, b) => b.count - a.count);

        return { pixelGrid: grid, colorList: colorList };
    }
});
