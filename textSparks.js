const newParticlesPerFrame = 50;

const color = (hsl, o) => {
    return `hsla(${hsl.h | 0}, ${hsl.s}%, ${hsl.l}%, ${o})`;
};

class TextSparks
{
    constructor() {

        this.opa    = 0;
        this.tick   = 0;
        this.drawCB = null;
        this.mask   = null;
        // MODIFIED: Select the correct canvas
        this.canvas = window.document.querySelector('#text-spark-canvas');
        if (!this.canvas) {
            console.error("TextSparks: Could not find canvas with ID #text-spark-canvas");
            return;
        }
        this.engine = this.canvas.getContext('2d');

        this.maskTick   = 0;
        this.nextMaskCb = this.nextMask.bind(this);
        this.maskCache  = [];

        this.resize();
        this.fetchData(); // Fetches data from HTML
        this.buildStackCache();

        this.particleMap = new Map();

    }

    buildStackCache() {
        if (!this.stack) {
            console.error("TextSparks: Stack data not fetched or empty before buildStackCache.");
            return;
        }
        this.maskCache = this.stack.map((stack) => {
            return this.buildTextMask(stack.texts);
        });
    }

    fetchData() {
        this.stackId = -1;
        // MODIFIED: Directly use the new div ID
        const dataContainer = document.querySelector('#text-spark-data');
        if (!dataContainer) {
            console.error("TextSparks: Could not find data container with ID #text-spark-data");
            this.stack = []; // Initialize stack as empty to prevent further errors
            return;
        }

        this.stack   = [...dataContainer.querySelectorAll('ul')].map(ul => {
            return {
                ticks   : 0.05 * (ul.hasAttribute('data-time') ? ul.getAttribute('data-time') : 0),
                fadeIn  : ul.hasAttribute('data-fade-in') ? 50 / Number(ul.getAttribute('data-fade-in')) : 50 / 1000, // Default fade in 1s
                fadeOut : ul.hasAttribute('data-fade-out') ? 50 / Number(ul.getAttribute('data-fade-out')) : 50 / 1000, // Default fade out 1s
                texts : [...ul.querySelectorAll('li')].map(li => {
                    return {
                        text : li.innerHTML.trim(),
                        hsl : {
                            h :li.hasAttribute('data-hue') ? Number(li.getAttribute('data-hue')) : 0,
                            s :li.hasAttribute('data-saturation') ? Number(li.getAttribute('data-saturation')) : 100,
                            l :li.hasAttribute('data-lightness') ? Number(li.getAttribute('data-lightness')) : 50
                        }
                    };
                })
            };
        });
         if (this.stack.length === 0) {
            console.warn("TextSparks: No text data found in #text-spark-data. Text animation will be empty.");
        }
    }

    resize() {
        if (!this.canvas) return;
        this.width  = window.innerWidth;
        // Set a fixed height for the text canvas, or make it configurable
        this.height = 150; // Example: 150px height for the top bar text

        this.canvas.setAttribute('width', this.width);
        this.canvas.setAttribute('height', this.height);

        // Rebuild mask on resize if necessary for responsiveness
        if (this.stack && this.stack.length > 0) {
            this.buildStackCache();
            // If a mask is currently active, regenerate it
            if (this.stackId !== -1 && this.maskCache[this.stackId]) {
                this.mask = this.maskCache[this.stackId];
            }
        }
    }

    buildTextMask(texts) {
        if (!texts || texts.length === 0) {
            console.warn("TextSparks: buildTextMask called with no texts.");
            return [];
        }
        const mask = [];

        const textAll = texts.reduce((all, textStack) => {
            return all.concat(textStack.text);
        }, '');

        // Canvas for mask generation should use internal dimensions, not screen dimensions directly
        const maskCanvasWidth        = Math.min(this.width, 800); // Max width for mask generation canvas
        const maskCanvasHeight       = this.height; // Use the actual canvas height for proportion

        const baseFontSize = Math.min(maskCanvasHeight * 0.6, 60); // Adjust base font size based on canvas height, max 60px

        const tempCanvas = document.createElement('canvas');
        const tempEngine = tempCanvas.getContext('2d');

        tempCanvas.setAttribute('width', maskCanvasWidth);
        tempCanvas.setAttribute('height', maskCanvasHeight);

        const font = (size) => {
            return `bold ${size}px Arial`;
        };

        tempEngine.font = font(baseFontSize);
        const m     = tempEngine.measureText(textAll);

        // Adjust font size to fit text within the mask canvas width (e.g., 90% of it)
        const desiredTextWidth = maskCanvasWidth * 0.9;
        let fSize = baseFontSize;
        if (m.width > desiredTextWidth) {
            fSize = (baseFontSize * desiredTextWidth / m.width) | 0;
        }
        fSize = Math.max(fSize, 10); // Minimum font size

        tempEngine.font = font(fSize);
        const fontMetrics = tempEngine.measureText(textAll);
        const fontWidth = fontMetrics.width;
        // Attempt to vertically center based on font metrics if available
        const textHeight = fontMetrics.actualBoundingBoxAscent + fontMetrics.actualBoundingBoxDescent || fSize;


        // Draw text centered in the temporary mask canvas
        const textX = (maskCanvasWidth - fontWidth) / 2;
        const textY = (maskCanvasHeight / 2) + (textHeight / 3) ; // Adjusted for better vertical centering

        tempEngine.fillStyle = '#000'; // Black text on transparent background for mask
        tempEngine.fillText(
            textAll,
            textX,
            textY
        );

        let currentX  = textX;

        Object.values(texts).forEach(textStack => {
            tempEngine.clearRect(0, 0, maskCanvasWidth, maskCanvasHeight); // Clear for each character/segment
            tempEngine.fillStyle = '#000'; // Ensure fillStyle is reset
            tempEngine.font = font(fSize); // Ensure font is reset
            tempEngine.fillText(
                textStack.text,
                currentX,
                textY
            );

            currentX += tempEngine.measureText(textStack.text).width;

            const data     = tempEngine.getImageData(0, 0, maskCanvasWidth, maskCanvasHeight);
            const subStack = [];

            for (let i = 0, max = data.width * data.height; i < max; i++) {
                if (data.data[i * 4 + 3]) { // Check alpha channel
                    subStack.push({
                        // Scale position to be relative to the main canvas dimensions
                        x : (i % data.width) / data.width,
                        y : (i / data.width | 0) / data.height,
                        o : Math.random(),
                        t : Math.random()
                    });
                }
            }
            mask.push({
                hsl : textStack.hsl,
                s   : subStack
            });
        });
        return mask;
    }

    createNewParticle() {
        if (!this.mask || this.mask.length === 0) return;

        for (let i = 0; i < newParticlesPerFrame; i++) {
            let mainIndex   = Math.random() * this.mask.length | 0;
            let subMask     = this.mask[mainIndex];

            if (!subMask || !subMask.s || subMask.s.length === 0) continue;

            let maskElement = subMask.s[Math.random() * subMask.s.length | 0];

            if (subMask && maskElement) {
                let particle = {
                    x   : maskElement.x,
                    y   : maskElement.y,
                    hsl : subMask.hsl,
                    c   : this.prepareParticle
                };
                this.particleMap.set(particle, particle);
            }
        }
    }

    clear() {
        // Make background transparent for overlay
        this.engine.clearRect(0, 0, this.width, this.height);
    }

    randFromList(...rands) {
        return rands.reduce((acc, rand) => {
            return acc + rand;
        }, 0) / rands.length;
    }

    prepareParticle(particle) {
        const r1 = Math.random();
        const r2 = Math.random();
        const r3 = Math.random();

        particle.x += (-0.5 + r1) / (this.width * 0.3); // Adjust particle movement relative to canvas size
        particle.y += (-0.5 + r2) / (this.height * 0.3);
        particle.si = 1 + Math.random() * 2 | 0; // Smaller particles

        particle.s = 0.003 + this.randFromList(r1, r2) / 15; // Slower fade/animation
        particle.l = 0;

        const rad = r3 * Math.PI * 2;
        particle.mx = Math.cos(rad) * (particle.s / (r1 < 0.05 ? 20 : 800)); // Adjusted movement speed
        particle.my = Math.sin(rad) * (particle.s / (r1 < 0.05 ? 20 : 800));

        particle.c = this.drawParticle;
    }

    drawParticle(particle) {
        if (particle.l >= 1) {
            particle.c = null;
            return;
        }

        particle.l += particle.s;
        particle.x += particle.mx;
        particle.y += particle.my;

        // Ensure particle stays within bounds of its own canvas
        if (particle.x * this.width < 0 || particle.x * this.width > this.width || particle.y * this.height < 0 || particle.y * this.height > this.height) {
            particle.c = null; // Remove particle if it goes out of bounds
            return;
        }

        this.engine.fillStyle = color(particle.hsl, this.opa * Math.sin(particle.l * Math.PI));
        this.engine.fillRect(particle.x * this.width, particle.y * this.height, particle.si, particle.si);
    }

    renderParticles() {
        this.particleMap.forEach((particle) => {
            if (particle.c) {
                particle.c.call(this, particle);
            }
            if (!particle.c) {
                this.particleMap.delete(particle);
            }
        });
    }

    drawStatic() {
        if (!this.mask) return;
        let i = 0;
        const particleSizeBase = Math.max(1, this.width / 200); // Scale particle size with canvas width

        this.mask.forEach(subMask => {
            if (!subMask.s) return;
            subMask.s.forEach(pos => {
                i++;
                this.engine.fillStyle = color(subMask.hsl, (1 + Math.cos(pos.x * 5 * pos.y * 5 + this.tick / 10)) / 2 * this.opa * pos.t * 0.5);
                this.engine.fillRect(
                    pos.x * this.width,
                    pos.y * this.height,
                    particleSizeBase,
                    particleSizeBase
                );

                if (i % 2) {
                    return;
                }

                pos.o        += 0.01; // Animation speed for static particles
                const localOpa     = Math.max(0, Math.sin(pos.o * Math.PI * 2));
                const padding = localOpa * this.width / 250; // Scale padding

                this.engine.fillStyle = color(subMask.hsl, this.opa * localOpa * 0.2);

                const arcRadius = Math.max(1, this.width / 600) + padding; // Scale arc radius
                const rectSize = particleSizeBase + padding * 2;

                if (pos.t < 0.5) {
                    this.engine.beginPath();
                    this.engine.arc(
                        pos.x * this.width,
                        pos.y * this.height,
                        arcRadius,
                        0,
                        Math.PI * 2
                    );
                    this.engine.fill();
                } else {
                    this.engine.fillRect(
                        pos.x * this.width - padding,
                        pos.y * this.height - padding,
                        rectSize,
                        rectSize
                    );
                }
            });
        });
    }

    draw() {
        if (!this.engine || !this.canvas) return; // Ensure engine and canvas are available
        this.tick++;

        if (this.nextMaskCb) this.nextMaskCb();
        this.createNewParticle();
        this.clear(); // Clears with transparent background

        this.engine.globalCompositeOperation = 'lighter';
        this.drawStatic();
        this.renderParticles();
        this.engine.globalCompositeOperation = 'source-over';

        if (!this.drawCB) { // Bind drawCB only once
             this.drawCB = this.draw.bind(this);
        }
        requestAnimationFrame(this.drawCB);
    }

    fadeInMask() {
        if (!this.stack || !this.stack[this.stackId]) return;
        this.opa += this.stack[this.stackId].fadeIn || 0.02; // Default fade speed

        if (this.opa >= 1) {
            this.opa = 1;
            this.afterFadeIn();
        }
    }

    afterFadeIn() {
        this.opa = 1;
        if (!this.stack || !this.stack[this.stackId]) return;

        if (this.stack[this.stackId].ticks) {
            this.maskTick   = 0;
            this.nextMaskCb = this.tickMask.bind(this);
        } else {
            // If no ticks, hold the mask indefinitely or until manually changed
            this.nextMaskCb = () => {};
        }
    }

    fadeOutMask() {
        if (!this.stack || !this.stack[this.stackId]) return;
        this.opa -= this.stack[this.stackId].fadeOut || 0.02; // Default fade speed

        if (this.opa <= 0) {
            this.afterFadeOut();
        }
    }

    afterFadeOut() {
        this.opa = 0;
        this.nextMaskCb = this.nextMask.bind(this);
    }

    tickMask() {
        if (!this.stack || !this.stack[this.stackId]) return;
        this.maskTick++;

        if (this.maskTick >= this.stack[this.stackId].ticks) {
            if (this.stack[this.stackId].fadeOut) {
                this.nextMaskCb = this.fadeOutMask.bind(this);
            } else {
                this.afterFadeOut(); // If no fadeOut defined, just go to next mask
            }
        }
    }

    nextMask() {
        if (!this.stack || this.stack.length === 0) {
             this.nextMaskCb = () => {}; // No stack, do nothing
             return;
        }
        this.stackId++;
        if (this.stackId >= this.stack.length) {
            this.stackId = 0; // Loop back to the first text
        }

        this.mask = this.maskCache[this.stackId];
        if (!this.mask) { // If mask is somehow undefined
            console.error("TextSparks: Mask not found for stackId", this.stackId);
            this.nextMaskCb = this.nextMask.bind(this); // Try to load next mask
            return;
        }

        if (this.stack[this.stackId].fadeIn) {
            this.nextMaskCb = this.fadeInMask.bind(this);
        } else {
            this.opa = 1; // No fade in, just show
            this.afterFadeIn();
        }
    }

    run() {
        if (!this.canvas || !this.engine) {
            console.error("TextSparks: Canvas or engine not initialized. Cannot run.");
            return;
        }
        // Bind drawCB here if not already bound
        if (!this.drawCB) {
            this.drawCB = this.draw.bind(this);
        }
        this.drawCB(); // Start animation loop
    }
}
