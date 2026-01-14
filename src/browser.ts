/**
 * Browser Tool Calling Protocol - Browser Manager
 *
 * Manages browser automation using native browser APIs.
 * This is the browser-context equivalent of the Playwright-based BrowserManager.
 */

import type {
  LaunchCommand,
  TrackedRequest,
  ConsoleMessage,
  PageError,
  DeviceDescriptor,
} from './types.js';
import {
  type RefMap,
  type EnhancedSnapshot,
  getEnhancedSnapshot,
  parseRef,
  findElementByRef,
} from './snapshot.js';

// Screencast frame data
export interface ScreencastFrame {
  data: string; // base64 encoded image
  metadata: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
    timestamp: number;
  };
}

// Screencast options
export interface ScreencastOptions {
  format?: 'jpeg' | 'png';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  interval?: number; // milliseconds between frames
}

/**
 * Built-in device descriptors
 */
const DEVICES: Record<string, DeviceDescriptor> = {
  'iPhone 12': {
    name: 'iPhone 12',
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iPhone 13': {
    name: 'iPhone 13',
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'iPhone 14': {
    name: 'iPhone 14',
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'Pixel 5': {
    name: 'Pixel 5',
    viewport: { width: 393, height: 851 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
  },
  'iPad Pro': {
    name: 'iPad Pro',
    viewport: { width: 1024, height: 1366 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  Desktop: {
    name: 'Desktop',
    viewport: { width: 1280, height: 720 },
    userAgent: navigator.userAgent,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
};

/**
 * Manages browser automation in-browser using native APIs
 */
export class BrowserManager {
  private targetWindow: Window;
  private targetDocument: Document;
  private isActive: boolean = false;
  private activeFrame: HTMLIFrameElement | null = null;
  private trackedRequests: TrackedRequest[] = [];
  private consoleMessages: ConsoleMessage[] = [];
  private pageErrors: PageError[] = [];
  private refMap: RefMap = {};
  private dialogHandler: ((event: Event) => void) | null = null;
  private highlightedElements: Map<Element, HTMLElement> = new Map();
  private screencastInterval: ReturnType<typeof setInterval> | null = null;
  private screencastCallback: ((frame: ScreencastFrame) => void) | null = null;
  private extraHeaders: Record<string, string> = {};
  private originalFetch: typeof fetch | null = null;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;

  constructor(targetWindow?: Window, targetDocument?: Document) {
    this.targetWindow = targetWindow || window;
    this.targetDocument = targetDocument || document;
  }

  /**
   * Check if browser manager is active
   */
  isLaunched(): boolean {
    return this.isActive;
  }

  /**
   * Launch/initialize the browser manager
   */
  async launch(options: LaunchCommand): Promise<void> {
    if (options.targetWindow) {
      this.targetWindow = options.targetWindow;
    }
    if (options.targetDocument) {
      this.targetDocument = options.targetDocument;
    }

    this.isActive = true;
    this.setupConsoleTracking();
    this.setupErrorTracking();
    this.setupRequestTracking();
  }

  /**
   * Get enhanced snapshot with refs
   */
  async getSnapshot(options?: {
    interactive?: boolean;
    maxDepth?: number;
    compact?: boolean;
    selector?: string;
  }): Promise<EnhancedSnapshot> {
    const doc = this.getDocument();
    const snapshot = getEnhancedSnapshot(doc, options);
    this.refMap = snapshot.refs;
    return snapshot;
  }

  /**
   * Get the cached ref map from last snapshot
   */
  getRefMap(): RefMap {
    return this.refMap;
  }

  /**
   * Get element from a ref
   */
  getElementFromRef(refArg: string): Element | null {
    const ref = parseRef(refArg);
    if (!ref) return null;

    return findElementByRef(ref, this.refMap, this.getDocument());
  }

  /**
   * Check if a selector looks like a ref
   */
  isRef(selector: string): boolean {
    return parseRef(selector) !== null;
  }

  /**
   * Get element - supports both refs and regular selectors
   */
  getElement(selectorOrRef: string): Element | null {
    // Check if it's a ref first
    const element = this.getElementFromRef(selectorOrRef);
    if (element) return element;

    // Otherwise treat as regular selector
    return this.getDocument().querySelector(selectorOrRef);
  }

  /**
   * Get all elements matching selector
   */
  getElements(selector: string): Element[] {
    return Array.from(this.getDocument().querySelectorAll(selector));
  }

  /**
   * Get the current document (handles iframes)
   */
  getDocument(): Document {
    if (this.activeFrame) {
      return this.activeFrame.contentDocument || this.targetDocument;
    }
    return this.targetDocument;
  }

  /**
   * Get the current window (handles iframes)
   */
  getWindow(): Window {
    if (this.activeFrame && this.activeFrame.contentWindow) {
      return this.activeFrame.contentWindow;
    }
    return this.targetWindow;
  }

  /**
   * Switch to a frame by selector, name, or URL
   */
  async switchToFrame(options: { selector?: string; name?: string; url?: string }): Promise<void> {
    const doc = this.targetDocument;

    if (options.selector) {
      const frame = doc.querySelector(options.selector) as HTMLIFrameElement;
      if (!frame || frame.tagName !== 'IFRAME') {
        throw new Error(`Frame not found: ${options.selector}`);
      }
      this.activeFrame = frame;
    } else if (options.name) {
      const frames = Array.from(doc.querySelectorAll('iframe'));
      const frame = frames.find((f) => f.name === options.name);
      if (!frame) {
        throw new Error(`Frame not found with name: ${options.name}`);
      }
      this.activeFrame = frame;
    } else if (options.url) {
      const frames = Array.from(doc.querySelectorAll('iframe'));
      const frame = frames.find((f) => f.src.includes(options.url!));
      if (!frame) {
        throw new Error(`Frame not found with URL: ${options.url}`);
      }
      this.activeFrame = frame;
    }
  }

  /**
   * Switch back to main frame
   */
  switchToMainFrame(): void {
    this.activeFrame = null;
  }

  /**
   * Set up dialog handler
   * Note: In browser context, we can't intercept native dialogs (alert, confirm, prompt).
   * We can only handle beforeunload. For full dialog support, the page would need
   * to use custom dialog implementations.
   */
  setDialogHandler(_response: 'accept' | 'dismiss', _promptText?: string): void {
    // Remove existing handler if any
    if (this.dialogHandler) {
      this.targetWindow.removeEventListener('beforeunload', this.dialogHandler);
    }

    // Native browser dialogs cannot be intercepted from JavaScript
    // This method is provided for API compatibility
  }

  /**
   * Clear dialog handler
   */
  clearDialogHandler(): void {
    if (this.dialogHandler) {
      this.targetWindow.removeEventListener('beforeunload', this.dialogHandler);
      this.dialogHandler = null;
    }
  }

  /**
   * Set up console message tracking
   */
  private setupConsoleTracking(): void {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;
    const originalDebug = console.debug;

    const trackMessage = (type: string, args: unknown[]) => {
      this.consoleMessages.push({
        type,
        text: args.map((a) => String(a)).join(' '),
        timestamp: Date.now(),
      });
    };

    console.log = (...args) => {
      trackMessage('log', args);
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      trackMessage('warning', args);
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      trackMessage('error', args);
      originalError.apply(console, args);
    };

    console.info = (...args) => {
      trackMessage('info', args);
      originalInfo.apply(console, args);
    };

    console.debug = (...args) => {
      trackMessage('debug', args);
      originalDebug.apply(console, args);
    };
  }

  /**
   * Set up error tracking
   */
  private setupErrorTracking(): void {
    this.targetWindow.addEventListener('error', (event) => {
      this.pageErrors.push({
        message: event.message || 'Unknown error',
        timestamp: Date.now(),
      });
    });

    this.targetWindow.addEventListener('unhandledrejection', (event) => {
      this.pageErrors.push({
        message: String(event.reason) || 'Unhandled promise rejection',
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Set up request tracking
   */
  private setupRequestTracking(): void {
    // Track fetch requests
    this.originalFetch = this.targetWindow.fetch;
    const self = this;

    this.targetWindow.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      const headers = init?.headers || {};

      self.trackedRequests.push({
        url,
        method,
        headers: headers as Record<string, string>,
        timestamp: Date.now(),
        resourceType: 'fetch',
      });

      // Add extra headers if set
      const mergedHeaders = { ...self.extraHeaders, ...headers };
      const mergedInit = { ...init, headers: mergedHeaders };

      return self.originalFetch!.call(self.targetWindow, input, mergedInit);
    };

    // Track XHR requests
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHROpen = this.originalXHROpen;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      self.trackedRequests.push({
        url: typeof url === 'string' ? url : url.href,
        method,
        headers: {},
        timestamp: Date.now(),
        resourceType: 'xhr',
      });

      return originalXHROpen.call(this, method, url, async ?? true, username, password);
    };
  }

  /**
   * Get tracked requests
   */
  getRequests(filter?: string): TrackedRequest[] {
    if (filter) {
      return this.trackedRequests.filter((r) => r.url.includes(filter));
    }
    return this.trackedRequests;
  }

  /**
   * Clear tracked requests
   */
  clearRequests(): void {
    this.trackedRequests = [];
  }

  /**
   * Start request tracking (for compatibility)
   */
  startRequestTracking(): void {
    // Already started in launch()
  }

  /**
   * Get console messages
   */
  getConsoleMessages(): ConsoleMessage[] {
    return this.consoleMessages;
  }

  /**
   * Clear console messages
   */
  clearConsoleMessages(): void {
    this.consoleMessages = [];
  }

  /**
   * Get page errors
   */
  getPageErrors(): PageError[] {
    return this.pageErrors;
  }

  /**
   * Clear page errors
   */
  clearPageErrors(): void {
    this.pageErrors = [];
  }

  /**
   * Set extra HTTP headers (for fetch/XHR requests)
   */
  async setExtraHeaders(headers: Record<string, string>): Promise<void> {
    this.extraHeaders = headers;
  }

  /**
   * Highlight an element (for debugging)
   */
  highlightElement(selector: string): void {
    const element = this.getElement(selector);
    if (!element) return;

    // Remove existing highlight if any
    this.removeHighlight(element);

    // Create highlight overlay
    const rect = element.getBoundingClientRect();
    const highlight = this.getDocument().createElement('div');
    highlight.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(255, 0, 0, 0.2);
      border: 2px solid red;
      pointer-events: none;
      z-index: 999999;
    `;

    this.getDocument().body.appendChild(highlight);
    this.highlightedElements.set(element, highlight);
  }

  /**
   * Remove highlight from an element
   */
  removeHighlight(element: Element): void {
    const highlight = this.highlightedElements.get(element);
    if (highlight) {
      highlight.remove();
      this.highlightedElements.delete(element);
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    for (const highlight of this.highlightedElements.values()) {
      highlight.remove();
    }
    this.highlightedElements.clear();
  }

  /**
   * Get device descriptor
   */
  getDevice(deviceName: string): DeviceDescriptor | undefined {
    return DEVICES[deviceName];
  }

  /**
   * List available devices
   */
  listDevices(): string[] {
    return Object.keys(DEVICES);
  }

  /**
   * Check if screencast is active
   */
  isScreencasting(): boolean {
    return this.screencastInterval !== null;
  }

  /**
   * Start screencast - capture frames at regular intervals
   */
  async startScreencast(
    callback: (frame: ScreencastFrame) => void,
    options?: ScreencastOptions
  ): Promise<void> {
    if (this.screencastInterval) {
      throw new Error('Screencast already active');
    }

    this.screencastCallback = callback;
    const interval = options?.interval || 100; // Default 10 FPS

    const captureFrame = async () => {
      try {
        const canvas = await this.captureCanvas(options);
        if (!canvas) return;

        const format = options?.format || 'jpeg';
        const quality = options?.quality || 80;
        const dataUrl = canvas.toDataURL(
          `image/${format}`,
          format === 'jpeg' ? quality / 100 : undefined
        );

        // Remove data URL prefix to get base64
        const base64 = dataUrl.split(',')[1];

        const frame: ScreencastFrame = {
          data: base64,
          metadata: {
            width: canvas.width,
            height: canvas.height,
            scrollX: this.getWindow().scrollX,
            scrollY: this.getWindow().scrollY,
            timestamp: Date.now(),
          },
        };

        if (this.screencastCallback) {
          this.screencastCallback(frame);
        }
      } catch {
        // Ignore capture errors
      }
    };

    // Capture first frame immediately
    await captureFrame();

    // Set up interval
    this.screencastInterval = setInterval(captureFrame, interval);
  }

  /**
   * Stop screencast
   */
  async stopScreencast(): Promise<void> {
    if (this.screencastInterval) {
      clearInterval(this.screencastInterval);
      this.screencastInterval = null;
    }
    this.screencastCallback = null;
  }

  /**
   * Capture the viewport as a canvas
   */
  private async captureCanvas(options?: ScreencastOptions): Promise<HTMLCanvasElement | null> {
    // Note: This uses html2canvas-like approach
    // In production, you might want to use a library like html2canvas
    // or rely on browser extension APIs for actual screenshot capability

    const doc = this.getDocument();
    const win = this.getWindow();

    const width = Math.min(options?.maxWidth || win.innerWidth, win.innerWidth);
    const height = Math.min(options?.maxHeight || win.innerHeight, win.innerHeight);

    const canvas = doc.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Note: Actual DOM-to-canvas rendering requires html2canvas or similar
    // This is a simplified placeholder that just captures what we can

    return canvas;
  }

  /**
   * Take a screenshot
   */
  async screenshot(options?: {
    format?: 'png' | 'jpeg';
    quality?: number;
    fullPage?: boolean;
    selector?: string;
  }): Promise<string> {
    const canvas = await this.captureCanvas({
      format: options?.format,
      quality: options?.quality,
    });

    if (!canvas) {
      throw new Error('Failed to capture screenshot');
    }

    const format = options?.format || 'png';
    const quality = options?.quality || 80;
    const dataUrl = canvas.toDataURL(
      `image/${format}`,
      format === 'jpeg' ? quality / 100 : undefined
    );

    return dataUrl.split(',')[1]; // Return base64 without data URL prefix
  }

  /**
   * Simulate mouse events
   */
  dispatchMouseEvent(
    element: Element,
    type: string,
    options?: {
      button?: number;
      clickCount?: number;
      clientX?: number;
      clientY?: number;
    }
  ): void {
    const rect = element.getBoundingClientRect();
    const clientX = options?.clientX ?? rect.left + rect.width / 2;
    const clientY = options?.clientY ?? rect.top + rect.height / 2;

    // Try to create event with view parameter first (standard browsers)
    // Fall back to no view for jsdom which has strict type checking
    let event: MouseEvent;
    try {
      event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: this.getWindow(),
        button: options?.button ?? 0,
        clientX,
        clientY,
      });
    } catch {
      // Fallback for jsdom which may reject the view parameter
      event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: options?.button ?? 0,
        clientX,
        clientY,
      });
    }

    element.dispatchEvent(event);
  }

  /**
   * Simulate keyboard events
   */
  dispatchKeyboardEvent(
    element: Element | null,
    type: string,
    key: string,
    options?: {
      code?: string;
      ctrlKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
      metaKey?: boolean;
    }
  ): void {
    const target = element || this.getDocument().activeElement || this.getDocument().body;

    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key,
      code: options?.code || key,
      ctrlKey: options?.ctrlKey,
      altKey: options?.altKey,
      shiftKey: options?.shiftKey,
      metaKey: options?.metaKey,
    });

    target.dispatchEvent(event);
  }

  /**
   * Simulate touch events
   */
  dispatchTouchEvent(
    element: Element,
    type: string,
    touchPoints: Array<{ x: number; y: number; id?: number }>
  ): void {
    const touches = touchPoints.map((point, index) => {
      return new Touch({
        identifier: point.id ?? index,
        target: element,
        clientX: point.x,
        clientY: point.y,
      });
    });

    const event = new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches,
      targetTouches: touches,
      changedTouches: touches,
    });

    element.dispatchEvent(event);
  }

  /**
   * Wait for a condition
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error('Timeout waiting for condition');
  }

  /**
   * Wait for an element to appear
   */
  async waitForElement(
    selector: string,
    options?: {
      timeout?: number;
      state?: 'visible' | 'hidden' | 'attached' | 'detached';
    }
  ): Promise<Element | null> {
    const timeout = options?.timeout ?? 5000;
    const state = options?.state ?? 'visible';

    await this.waitFor(() => {
      const element = this.getElement(selector);

      switch (state) {
        case 'attached':
          return element !== null;
        case 'detached':
          return element === null;
        case 'visible':
          if (!element) return false;
          const style = this.getWindow().getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden';
        case 'hidden':
          if (!element) return true;
          const hiddenStyle = this.getWindow().getComputedStyle(element);
          return hiddenStyle.display === 'none' || hiddenStyle.visibility === 'hidden';
        default:
          return false;
      }
    }, timeout);

    return this.getElement(selector);
  }

  /**
   * Close and clean up
   */
  async close(): Promise<void> {
    // Stop screencast
    await this.stopScreencast();

    // Clear highlights
    this.clearHighlights();

    // Restore original fetch/XHR
    if (this.originalFetch) {
      this.targetWindow.fetch = this.originalFetch;
    }
    if (this.originalXHROpen) {
      XMLHttpRequest.prototype.open = this.originalXHROpen;
    }

    // Clear state
    this.trackedRequests = [];
    this.consoleMessages = [];
    this.pageErrors = [];
    this.refMap = {};
    this.extraHeaders = {};
    this.isActive = false;
  }
}
