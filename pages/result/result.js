// pages/result/result.js
const { palettes, findClosestColor } = require('../../utils/colors.js');

Page({
    data: {
        pixelSize: 20,
        pixelGrid: [],
        colorList: [],
        scale: 1,
        tempImagePath: '',
        colorData: null,
        exportCanvasWidth: 1,
        exportCanvasHeight: 1,
    },

    onLoad: function (options) {
        const eventChannel = this.getOpenerEventChannel();
        eventChannel.on('acceptDataFromOpenerPage', (data) => {
            this.setData({
                tempImagePath: data.tempImagePath,
                pixelSize: data.pixelSize,
                colorData: data.colorData,
            });
            this.drawResultImage();
        });
    },

    drawResultImage() {
        const { colorData } = this.data;
        if (colorData && colorData.pixelGrid && colorData.colorList) {
            this.setData({
                pixelGrid: colorData.pixelGrid,
                colorList: colorData.colorList,
            });
        } else {
            console.error("drawResultImage received invalid colorData:", colorData);
            wx.showToast({
                title: '图纸数据错误',
                icon: 'none'
            });
        }
    },

    onReady() {
        // Use onReady to ensure the components are rendered before we query their sizes
        // A small delay might be needed to ensure the grid data has been fully processed
        setTimeout(() => {
            this.calculateInitialScale();
        }, 200);
    },

    calculateInitialScale() {
        const query = wx.createSelectorQuery().in(this);
        query.select('.movable-area').boundingClientRect();
        query.select('.pixel-grid').boundingClientRect();
        query.exec((res) => {
            const areaRect = res[0];
            const gridRect = res[1];

            if (areaRect && gridRect && gridRect.width > 0 && gridRect.height > 0) {
                const widthScale = areaRect.width / gridRect.width;
                const heightScale = areaRect.height / gridRect.height;
                // We only want to scale down if the image is larger than the area, not scale up.
                const scale = Math.min(widthScale, heightScale, 1);

                this.setData({
                    scale: scale,
                });
            }
        });
    },

    zoomIn() {
        let newScale = this.data.scale + 0.2;
        if (newScale > 8) {
            newScale = 8;
        }
        this.setData({
            scale: newScale
        });
    },

    zoomOut() {
        let newScale = this.data.scale - 0.2;
        if (newScale < 0.3) {
            newScale = 0.3;
        }
        this.setData({
            scale: newScale
        });
    },

    generatePixelGrid() {
        const { src, pixelSize, brand } = this.data;
        const palette = palettes[brand];
        const that = this;

        const query = wx.createSelectorQuery();
        query.select('#analysisCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
                const canvas = res[0].node;
                const ctx = canvas.getContext('2d');
                const img = canvas.createImage();

                img.src = src;
                img.onload = () => {
                    const imgWidth = img.width;
                    const imgHeight = img.height;

                    that.setData({
                        canvasWidth: imgWidth,
                        canvasHeight: imgHeight,
                    });

                    canvas.width = imgWidth;
                    canvas.height = imgHeight;

                    ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

                    const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight).data;
                    const grid = [];
                    const colorMap = {};

                    for (let y = 0; y < imgHeight; y += pixelSize) {
                        const row = [];
                        for (let x = 0; x < imgWidth; x += pixelSize) {
                            const i = (y * imgWidth + x) * 4;

                            const r = imageData[i];
                            const g = imageData[i + 1];
                            const b = imageData[i + 2];

                            const closestColor = findClosestColor([r, g, b], palette);

                            row.push({
                                color: `rgb(${closestColor.rgb[0]},${closestColor.rgb[1]},${closestColor.rgb[2]})`,
                                code: closestColor.code,
                            });

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

                    that.setData({
                        pixelGrid: grid,
                        colorList: Object.values(colorMap).sort((a, b) => b.count - a.count),
                    });
                };

                img.onerror = () => {
                    wx.showToast({ title: '加载图片失败', icon: 'none' });
                };
            });
    },

    download() {
        wx.showLoading({
            title: '正在生成高清图...',
        });
        this.drawAndSaveCanvas();
    },

    drawAndSaveCanvas() {
        const { pixelGrid, colorList, brand } = this.data;
        if (!pixelGrid || pixelGrid.length === 0) {
            wx.hideLoading();
            wx.showToast({ title: '没有图纸数据', icon: 'none' });
            return;
        }

        // --- Constants for drawing ---
        const CELL_SIZE = 60;
        const RULER_SIZE = 40;
        const GRID_FONT_SIZE = 16;

        // --- Constants for Legend ---
        const LEGEND_PADDING = 40;
        const LEGEND_TITLE_HEIGHT = 60;
        const LEGEND_ITEM_HEIGHT = 40;
        const LEGEND_COLUMNS = 3;
        const LEGEND_COL_WIDTH = 300;
        const LEGEND_SWATCH_SIZE = 24;
        const LEGEND_FONT_SIZE = 18;

        // --- Calculate Dimensions ---
        const gridHeight = pixelGrid.length;
        const gridWidth = pixelGrid[0].length;

        const gridRenderWidth = gridWidth * CELL_SIZE;
        const gridRenderHeight = gridHeight * CELL_SIZE;

        const numLegendRows = Math.ceil(colorList.length / LEGEND_COLUMNS);
        const legendHeight = LEGEND_TITLE_HEIGHT + (numLegendRows * LEGEND_ITEM_HEIGHT) + LEGEND_PADDING;

        const canvasWidth = Math.max(gridRenderWidth + RULER_SIZE, (LEGEND_COLUMNS * LEGEND_COL_WIDTH) + RULER_SIZE);
        const canvasHeight = gridRenderHeight + RULER_SIZE + legendHeight;

        this.setData({ exportCanvasWidth: canvasWidth, exportCanvasHeight: canvasHeight }, () => {
            const query = wx.createSelectorQuery();
            query.select('#exportCanvas')
                .fields({ node: true, size: true })
                .exec((res) => {
                    if (!res[0] || !res[0].node) {
                        wx.hideLoading();
                        wx.showToast({ title: '导出画布失败', icon: 'none' });
                        return;
                    }
                    const canvas = res[0].node;
                    const ctx = canvas.getContext('2d');

                    canvas.width = canvasWidth;
                    canvas.height = canvasHeight;

                    // 1. Draw background
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

                    // 2. Draw rulers
                    ctx.fillStyle = '#f0f0f0';
                    ctx.fillRect(0, 0, canvasWidth, RULER_SIZE); // Top ruler
                    ctx.fillRect(0, 0, RULER_SIZE, canvasHeight); // Left ruler
                    ctx.fillStyle = '#333333';
                    ctx.font = `normal ${LEGEND_FONT_SIZE - 2}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    for (let x = 0; x < gridWidth; x++) {
                        ctx.fillText(x + 1, (x + 0.5) * CELL_SIZE + RULER_SIZE, RULER_SIZE / 2);
                    }
                    for (let y = 0; y < gridHeight; y++) {
                        ctx.fillText(y + 1, RULER_SIZE / 2, (y + 0.5) * CELL_SIZE + RULER_SIZE);
                    }

                    // 3. Draw the pixel grid
                    pixelGrid.forEach((row, y) => {
                        row.forEach((cell, x) => {
                            const cellX = x * CELL_SIZE + RULER_SIZE;
                            const cellY = y * CELL_SIZE + RULER_SIZE;
                            ctx.fillStyle = cell.color;
                            ctx.fillRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
                            ctx.strokeStyle = '#dddddd';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(cellX, cellY, CELL_SIZE, CELL_SIZE);
                            ctx.fillStyle = '#ffffff';
                            ctx.font = `normal bold ${GRID_FONT_SIZE}px sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                            ctx.shadowOffsetX = 1;
                            ctx.shadowOffsetY = 1;
                            ctx.shadowBlur = 2;
                            ctx.fillText(cell.code, cellX + CELL_SIZE / 2, cellY + CELL_SIZE / 2);
                            ctx.shadowColor = 'transparent';
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 0;
                            ctx.shadowBlur = 0;
                        });
                    });

                    // 4. Draw the legend
                    const legendStartY = gridRenderHeight + RULER_SIZE + LEGEND_PADDING;
                    ctx.fillStyle = '#000000';
                    ctx.font = `bold ${LEGEND_FONT_SIZE + 4}px sans-serif`;
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'top';
                    ctx.fillText(`材料清单 (${brand})`, RULER_SIZE, legendStartY);

                    colorList.forEach((item, index) => {
                        const col = index % LEGEND_COLUMNS;
                        const row = Math.floor(index / LEGEND_COLUMNS);
                        const itemX = RULER_SIZE + (col * LEGEND_COL_WIDTH);
                        const itemY = legendStartY + LEGEND_TITLE_HEIGHT + (row * LEGEND_ITEM_HEIGHT);

                        ctx.fillStyle = item.color;
                        ctx.fillRect(itemX, itemY, LEGEND_SWATCH_SIZE, LEGEND_SWATCH_SIZE);

                        ctx.fillStyle = '#333333';
                        ctx.font = `normal ${LEGEND_FONT_SIZE}px sans-serif`;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        const text = `${item.name} (${item.code}) - 数量: ${item.count}`;
                        ctx.fillText(text, itemX + LEGEND_SWATCH_SIZE + 10, itemY + LEGEND_SWATCH_SIZE / 2);
                    });

                    // 5. Export the final image
                    wx.canvasToTempFilePath({
                        canvas: canvas,
                        destWidth: canvasWidth,
                        destHeight: canvasHeight,
                        success: (res) => {
                            wx.hideLoading();
                            wx.saveImageToPhotosAlbum({
                                filePath: res.tempFilePath,
                                success: () => wx.showToast({ title: '高清图已保存' }),
                                fail: () => wx.showToast({ title: '保存失败', icon: 'none' }),
                            });
                        },
                        fail: () => {
                            wx.hideLoading();
                            wx.showToast({ title: '生成图片失败', icon: 'none' });
                        },
                    });
                });
        });
    },
});
