// Number of new particles to create per animation frame.
const newParticlesPerFrame = 50;

/**
 * Generates an HSLA color string.
 * @param {object} hsl - An object with h, s, l properties for hue, saturation, lightness.
 * @param {number} o - Opacity value.
 * @returns {string} HSLA color string.
 */
const color = (hsl, o) => {
  return `hsla(${hsl.h | 0}, ${hsl.s}%, ${hsl.l}%, ${o})`;
};

class TextSparks {
  constructor() {
    this.opa = 0; // Current opacity of the text/particles
    this.tick = 0; // Animation tick counter
    this.drawCB = null; // Callback for requestAnimationFrame
    this.mask = null; // Current text mask being animated
    this.canvas = window.document.querySelector('canvas');
    this.engine = this.canvas.getContext('2d');
    this.maskTick = 0; // Counter for current mask display duration
    this.nextMaskCb = this.nextMask.bind(this); // Callback for mask state transitions
    this.maskCache = []; // Cache for pre-built text masks

    this.resize(); // Adjust canvas to window size
    this.fetchData(); // Load text data from DOM
    this.buildStackCache(); // Pre-render all text masks
    this.particleMap = new Map(); // Holds active animated particles
  }

  /**
   * Pre-builds all text masks from the fetched data.
   */
  buildStackCache() {
    this.maskCache = this.stack.map((stackItem) => {
      return this.buildTextMask(stackItem.texts);
    });
  }

  /**
   * Fetches text data and animation parameters from DOM elements.
   */
  fetchData() {
    this.stackId = -1; // Index of the current text stack
    this.stack = [...document.querySelectorAll('div > ul')].map(ul => {
      return {
        ticks: 0.05 * (ul.hasAttribute('data-time') ? Number(ul.getAttribute('data-time')) : 0), // Duration to display mask
        fadeIn: ul.hasAttribute('data-fade-in') ? 50 / Number(ul.getAttribute('data-fade-in')) : 0, // Fade-in speed
        fadeOut: ul.hasAttribute('data-fade-out') ? 50 / Number(ul.getAttribute('data-fade-out')) : 0, // Fade-out speed
        texts: [...ul.querySelectorAll('li')].map(li => {
          return {
            text: li.innerHTML.trim(),
            hsl: {
              h: li.hasAttribute('data-hue') ? Number(li.getAttribute('data-hue')) : 0,
              s: li.hasAttribute('data-saturation') ? Number(li.getAttribute('data-saturation')) : 100,
              l: li.hasAttribute('data-lightness') ? Number(li.getAttribute('data-lightness')) : 50
            },
            role: li.getAttribute('data-role') || '' // Role of the text (e.g., 'main-name', 'sections')
          };
        })
      };
    });
  }

  /**
   * Resizes the canvas to fit the window dimensions.
   */
  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.setAttribute('width', this.width);
    this.canvas.setAttribute('height', this.height);
  }

  /**
   * Helper function to generate particle data from text on a canvas.
   * @param {CanvasRenderingContext2D} engine - The 2D rendering context of the temporary canvas.
   * @param {string} text - The text string to draw.
   * @param {string} fontStyle - The font style to use for drawing.
   * @param {number} x - The x-coordinate to draw the text.
   * @param {number} y - The y-coordinate to draw the text.
   * @param {number} canvasWidth - The width of the temporary canvas.
   * @param {number} canvasHeight - The height of the temporary canvas.
   * @param {boolean} isSectionText - Flag indicating if the text is for sections (affects particle generation).
   * @param {object} hsl - HSL color object for the particles.
   * @returns {object} An object containing HSL color and the array of particle positions.
   */
  _createTextParticles(engine, text, fontStyle, x, y, canvasWidth, canvasHeight, isSectionText, hsl) {
    engine.clearRect(0, 0, canvasWidth, canvasHeight);
    engine.font = fontStyle;
    // Set textBaseline and fillText/strokeText as per original logic for each role
    if (isSectionText) {
        engine.textBaseline = 'bottom';
    } else if (text.role === 'center-name') { // Assuming text object is passed or role is passed
        engine.textBaseline = 'middle';
    } else {
        engine.textBaseline = 'top';
    }
    engine.fillText(text, x, y);
    engine.strokeStyle = '#FFFFFF';
    engine.lineWidth = 1;
    engine.strokeText(text, x, y);

    const data = engine.getImageData(0, 0, canvasWidth, canvasHeight);
    const subStack = [];
    for (let i = 0; i < data.data.length; i += 4) {
      if (data.data[i + 3] > 0) { // Check alpha channel
        const pixelIndex = i / 4;
        const particleData = {
          x: (pixelIndex % canvasWidth) / canvasWidth, // Normalize coordinates
          y: Math.floor(pixelIndex / canvasWidth) / canvasHeight, // Normalize coordinates
          o: Math.random(), // Initial offset for animation
          t: Math.random(), // Timing randomizer for animation
          isSectionText: isSectionText
        };
        subStack.push(particleData);
        if (isSectionText) {
          // Push section text particles twice for higher density, as per original logic.
          subStack.push(particleData);
        }
      }
    }
    return { hsl: hsl, s: subStack };
  }


  /**
   * Builds a text mask for a given set of texts.
   * This involves drawing text onto a temporary canvas and extracting pixel data
   * to create particle positions.
   * @param {Array<object>} texts - Array of text objects to build the mask from.
   * @returns {Array<object>} Array of mask data (particle positions and colors).
   */
  buildTextMask(texts) {
    const mask = [];
    const canvasWidth = 400; // Increased from 200
    const canvasHeight = 200; // Increased from 150

    const mainNameTexts = texts.filter(t => t.role === 'main-name');
    const sectionsTexts = texts.filter(t => t.role === 'sections');
    const centerNameTexts = texts.filter(t => t.role === 'center-name');

    const tempCanvas = document.createElement('canvas');
    const tempEngine = tempCanvas.getContext('2d');
    tempCanvas.setAttribute('width', canvasWidth);
    tempCanvas.setAttribute('height', canvasHeight);

    const font = (size) => `bold ${size}px Arial`;
    tempEngine.fillStyle = '#000'; // Not strictly necessary if clearing before each draw

    // Process 'main-name' texts
    if (mainNameTexts.length > 0) {
      const mainNameString = mainNameTexts.map(t => t.text).join('');
      const baseMainFontSize = 40;
      tempEngine.font = font(baseMainFontSize);
      let metrics = tempEngine.measureText(mainNameString);
      let fSizeMain = Math.min(baseMainFontSize, (canvasWidth * 0.9 / metrics.width) * baseMainFontSize);
      fSizeMain = Math.max(fSizeMain, 1); // Ensure font size is at least 1
      const currentFontStyle = font(fSizeMain);
      metrics = tempEngine.measureText(mainNameString); // Re-measure with adjusted font size
      const fontWidthMain = metrics.width;
      const yMainName = 10;
      let currentXMainName = (canvasWidth - fontWidthMain) / 2;

      mainNameTexts.forEach(textStack => {
        tempEngine.textBaseline = 'top';
        mask.push(this._createTextParticles(tempEngine, textStack.text, currentFontStyle, currentXMainName, yMainName, canvasWidth, canvasHeight, false, textStack.hsl));
        currentXMainName += tempEngine.measureText(textStack.text).width;
      });
    }

    // Process 'center-name' texts
    if (centerNameTexts.length > 0) {
      const centerNameString = centerNameTexts.map(t => t.text).join('');
      const baseCenterFontSize = 40;
      tempEngine.font = font(baseCenterFontSize);
      let metrics = tempEngine.measureText(centerNameString);
      let fSizeCenterName = Math.min(baseCenterFontSize, (canvasWidth * 0.9 / metrics.width) * baseCenterFontSize);
      fSizeCenterName = Math.max(fSizeCenterName, 1); // Ensure font size is at least 1
      const currentFontStyle = font(fSizeCenterName);
      metrics = tempEngine.measureText(centerNameString); // Re-measure
      const fontWidthCenter = metrics.width;
      const yCenterName = canvasHeight / 2;
      let currentXCenterName = (canvasWidth - fontWidthCenter) / 2;

      centerNameTexts.forEach(textStack => {
        tempEngine.textBaseline = 'middle';
        mask.push(this._createTextParticles(tempEngine, textStack.text, currentFontStyle, currentXCenterName, yCenterName, canvasWidth, canvasHeight, false, textStack.hsl));
        currentXCenterName += tempEngine.measureText(textStack.text).width;
      });
    }

    // Process 'sections' texts
    if (sectionsTexts.length > 0) {
      const sectionsString = sectionsTexts.map(t => t.text).join(' '); // Join with spaces for better measurement
      let fSizeMainVal = 30; // Default if mainNameTexts was empty or font not parsed
      if (mainNameTexts.length > 0) {
          // Attempt to get fSizeMain from the main name section if available
          // This assumes mainNameTexts processing has set a font like 'bold 40px Arial'
          // A more robust way would be to store fSizeMain from the previous block.
          const fontMatch = tempEngine.font.match(/(\d+)px/);
          if (fontMatch && fontMatch[1]) {
            fSizeMainVal = parseFloat(fontMatch[1]);
          }
      }
      const baseSectionsFontSize = fSizeMainVal * 0.6;
      tempEngine.font = font(baseSectionsFontSize);
      let metrics = tempEngine.measureText(sectionsString);
      let fSizeSections = Math.min(baseSectionsFontSize, (canvasWidth * 0.9 / metrics.width) * baseSectionsFontSize);
      fSizeSections = Math.max(fSizeSections, 1); // Ensure font size is at least 1
      const currentFontStyle = font(fSizeSections);
      metrics = tempEngine.measureText(sectionsString); // Re-measure
      const fontWidthSections = metrics.width;
      const ySections = canvasHeight - 10;
      let currentXSections = (canvasWidth - fontWidthSections) / 2;

      sectionsTexts.forEach(textStack => {
        tempEngine.textBaseline = 'bottom';
        mask.push(this._createTextParticles(tempEngine, textStack.text, currentFontStyle, currentXSections, ySections, canvasWidth, canvasHeight, true, textStack.hsl));
        currentXSections += tempEngine.measureText(textStack.text).width + tempEngine.measureText(' ').width; // Add space width
      });
    }
    return mask;
  }

  /**
   * Creates new animated particles based on the current text mask.
   */
  createNewParticle() {
    if (!this.mask || this.mask.length === 0) return; // Don't create particles if no mask

    for (let i = 0; i < newParticlesPerFrame; i++) {
      // Pick a random sub-mask (character/section)
      const subMaskIndex = Math.random() * this.mask.length | 0;
      const subMask = this.mask[subMaskIndex];

      if (!subMask || !subMask.s || subMask.s.length === 0) continue; // Skip if subMask is empty

      // Pick a random particle position from the sub-mask
      const maskElement = subMask.s[Math.random() * subMask.s.length | 0];

      if (maskElement) {
        const particle = {
          x: maskElement.x, // Initial position from mask
          y: maskElement.y,
          hsl: subMask.hsl, // Color from mask
          c: this.prepareParticle // Initial behavior function for the particle
        };
        this.particleMap.set(particle, particle); // Add to active particles
      }
    }
  }

  /**
   * Debug logging function, logs at a throttled rate.
   * @param {any} logMessage - Message to log.
   * @param {number} timesPerFrame - Approximate number of times this might be called per frame, for throttling.
   */
  secLog(logMessage, timesPerFrame) {
    // Logs roughly once per second if called 60 times per second (assuming 60fps)
    if (Math.random() < 1 / (60 * timesPerFrame)) {
      console.log(logMessage);
    }
  }

  /**
   * Clears the canvas.
   */
  clear() {
    this.engine.fillStyle = '#111'; // Background color
    this.engine.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Calculates the average of a list of numbers.
   * @param  {...number} rands - Numbers to average.
   * @returns {number} The average.
   */
  calculateAverage(...rands) {
    return rands.reduce((acc, rand) => acc + rand, 0) / rands.length;
  }

  /**
   * Initializes a newly created particle's properties for animation.
   * @param {object} particle - The particle object to prepare.
   */
  prepareParticle(particle) {
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Math.random();
    const rad = r3 * Math.PI * 2; // Random angle

    // Slightly offset initial position for a more dynamic feel
    particle.x += (-0.5 + r1) / 300;
    particle.y += (-0.5 + r2) / 300;

    particle.si = 1 + Math.random() * 4 | 0; // Particle size
    particle.s = (0.003 + this.calculateAverage(r1, r2) / 10) / 4; // Particle speed/lifetime factor
    particle.l = 0; // Lifetime progress (0 to 1)
    // Movement vector components
    particle.mx = Math.cos(rad) * (particle.s / (r1 < 0.05 ? 10 : 400)); // Faster movement for some particles
    particle.my = Math.sin(rad) * (particle.s / (r1 < 0.05 ? 10 : 400));
    particle.c = this.drawParticle; // Set next behavior to draw
  }

  /**
   * Draws an individual animated particle and updates its state.
   * @param {object} particle - The particle to draw.
   */
  drawParticle(particle) {
    if (particle.l >= 1) { // If lifetime is over
      particle.c = null; // Mark for removal
      return;
    }

    particle.l += particle.s; // Increment lifetime
    particle.x += particle.mx; // Move particle
    particle.y += particle.my;

    // Draw the particle with opacity based on its lifetime (fade in/out)
    this.engine.fillStyle = color(particle.hsl, this.opa * Math.sin(particle.l * Math.PI));
    this.engine.fillRect(particle.x * this.width, particle.y * this.height, particle.si, particle.si);
  }

  /**
   * Renders all active animated particles.
   */
  renderParticles() {
    this.particleMap.forEach((particle) => {
      if (particle.c) {
        particle.c.call(this, particle); // Execute particle's current behavior
      }
      if (!particle.c) {
        this.particleMap.delete(particle); // Remove particle if marked
      }
    });
  }

  /**
   * Draws the static part of the text mask (glowing, fixed particles).
   */
  drawStatic() {
    if (!this.mask) return; // Don't draw if no mask

    let i = 0;
    const step = 0.01 / 4; // Animation step for static particle glow

    this.mask.forEach(subMask => {
      if (!subMask || !subMask.s) return; // Skip if subMask or its particles are undefined
      subMask.s.forEach(pos => {
        i++;

        let baseParticleWidth;
        // Different base size for section text particles
        if (pos.isSectionText) {
          baseParticleWidth = this.width / 250;
        } else {
          baseParticleWidth = this.width / 150;
        }

        // Draw the main static particle
        this.engine.fillStyle = color(subMask.hsl, (1 + Math.cos(pos.x * 5 * pos.y * 5 + this.tick / 10)) / 2 * this.opa * pos.t * 0.5);
        this.engine.fillRect(
          pos.x * this.width,
          pos.y * this.height,
          baseParticleWidth,
          baseParticleWidth
        );

        // Skip glow effect for every other particle for performance/visual variety
        if (i % 2) {
          return;
        }

        pos.o += step; // Increment animation offset for glow effect
        const glowOpacity = Math.max(0, Math.sin(pos.o * Math.PI * 2));
        const padding = glowOpacity * baseParticleWidth * 0.5; // Glow size

        this.engine.fillStyle = color(subMask.hsl, this.opa * glowOpacity * 0.2); // Glow color and opacity

        // Draw either a circular or rectangular glow based on random factor 't'
        if (pos.t < 0.5) { // Circular glow
          this.engine.beginPath();
          this.engine.arc(
            pos.x * this.width,
            pos.y * this.height,
            (baseParticleWidth / 2) + padding,
            0,
            Math.PI * 2
          );
          this.engine.fill();
        } else { // Rectangular glow
          this.engine.fillRect(
            pos.x * this.width - padding,
            pos.y * this.height - padding,
            baseParticleWidth + padding * 2,
            baseParticleWidth + padding * 2
          );
        }
      });
    });
  }

  /**
   * Main animation loop.
   * Called recursively via requestAnimationFrame.
   */
  draw() {
    this.tick++; // Increment global animation tick
    this.nextMaskCb(); // Execute current mask state logic (fade in, display, fade out)

    this.createNewParticle(); // Generate new animated particles
    this.clear(); // Clear canvas

    // Use 'lighter' composite operation for additive blending of colors (glow effects)
    this.engine.globalCompositeOperation = 'lighter';
    this.drawStatic(); // Draw the static, glowing text mask
    this.renderParticles(); // Draw and update animated particles
    this.engine.globalCompositeOperation = 'source-over'; // Reset composite operation

    requestAnimationFrame(this.drawCB); // Request next animation frame
  }

  /**
   * Handles the fade-in state for the current mask.
   */
  fadeInMask() {
    this.opa += this.stack[this.stackId].fadeIn; // Increase opacity
    if (this.opa >= 1) {
      this.opa = 1;
      this.afterFadeIn(); // Transition to next state
    }
  }

  /**
   * Called after fade-in is complete. Transitions to displaying the mask or to idle.
   */
  afterFadeIn() {
    this.opa = 1;
    if (this.stack[this.stackId].ticks) { // If mask has a display duration
      this.maskTick = 0;
      this.nextMaskCb = this.tickMask.bind(this); // Start ticking display duration
    } else {
      this.nextMaskCb = () => {}; // Idle state if no duration (e.g., wait for manual advance)
    }
  }

  /**
   * Handles the fade-out state for the current mask.
   */
  fadeOutMask() {
    this.opa -= this.stack[this.stackId].fadeOut; // Decrease opacity
    if (this.opa <= 0) {
      this.afterFadeOut(); // Transition to next state
    }
  }

  /**
   * Called after fade-out is complete. Transitions to loading the next mask.
   */
  afterFadeOut() {
    this.opa = 0;
    this.nextMaskCb = this.nextMask.bind(this); // Prepare to load next mask
  }

  /**
   * Handles the display duration of the current mask.
   */
  tickMask() {
    this.maskTick++;
    if (this.maskTick >= this.stack[this.stackId].ticks) { // If display duration is over
      if (this.stack[this.stackId].fadeOut) {
        this.nextMaskCb = this.fadeOutMask.bind(this); // Start fade-out
      } else {
        this.afterFadeOut(); // Or directly go to after fade-out if no fade defined
      }
    }
  }

  /**
   * Loads the next text mask in the sequence.
   */
  nextMask() {
    this.stackId++;
    if (this.stackId >= this.stack.length) {
      this.stackId = 0; // Loop back to the first mask
    }
    this.mask = this.maskCache[this.stackId]; // Get pre-built mask from cache
    this.particleMap.clear(); // Clear any existing animated particles from previous mask

    if (this.stack[this.stackId].fadeIn) {
      this.nextMaskCb = this.fadeInMask.bind(this); // Start fade-in for new mask
    } else {
      // If no fade-in, make it immediately visible and go to display/idle state
      this.opa = 1;
      this.afterFadeIn();
    }
  }

  /**
   * Starts the animation.
   */
  run() {
    this.drawCB = this.draw.bind(this); // Set up the main draw loop callback
    this.drawCB(); // Start the animation
  }
}

// Create an instance of TextSparks and run the animation.
const textSparksAnimation = new TextSparks();
textSparksAnimation.run();
