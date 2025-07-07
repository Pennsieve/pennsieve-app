export class CanvasRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.context = this.getContext();
        this.pixelRatio = options.pixelRatio || window.devicePixelRatio || 1;
        this.renderQueue = [];
    }

    getContext() {
        if (!this.canvas) {
            throw new RenderingError('Canvas element is required');
        }

        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new RenderingError('Failed to get 2D rendering context');
        }

        return context;
    }

    renderChannel(channelData, viewport, styling) {
        try {
            this.validateRenderParams(channelData, viewport, styling);

            switch (channelData.type) {
                case 'CONTINUOUS':
                    return this.renderContinuousChannel(channelData, viewport, styling);
                case 'UNIT':
                    return this.renderEventChannel(channelData, viewport, styling);
                default:
                    throw new RenderingError(`Unsupported channel type: ${channelData.type}`);
            }
        } catch (error) {
            console.error(`Failed to render channel ${channelData.id}:`, error);
            return false;
        }
    }

    renderContinuousChannel(channelData, viewport, styling) {
        const path = this.createChannelPath(channelData, viewport);
        this.applyChannelStyling(styling);
        this.context.stroke(path);
        return true;
    }

    batchRender(renderOperations) {
        this.context.save();

        try {
            renderOperations.forEach(operation => {
                operation(this.context);
            });
        } finally {
            this.context.restore();
        }
    }
}