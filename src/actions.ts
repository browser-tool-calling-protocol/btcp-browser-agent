/**
 * Browser Tool Calling Protocol - Action Handlers
 *
 * Command execution handlers using native browser APIs.
 */

import type { BrowserManager, ScreencastFrame } from './browser.js';
import type {
  Command,
  Response,
  NavigateCommand,
  ClickCommand,
  TypeCommand,
  FillCommand,
  CheckCommand,
  UncheckCommand,
  DoubleClickCommand,
  FocusCommand,
  DragCommand,
  FrameCommand,
  GetByRoleCommand,
  GetByTextCommand,
  GetByLabelCommand,
  GetByPlaceholderCommand,
  PressCommand,
  ScreenshotCommand,
  EvaluateCommand,
  WaitCommand,
  ScrollCommand,
  SelectCommand,
  HoverCommand,
  ContentCommand,
  StorageGetCommand,
  StorageSetCommand,
  StorageClearCommand,
  DialogCommand,
  GetAttributeCommand,
  GetTextCommand,
  IsVisibleCommand,
  IsEnabledCommand,
  IsCheckedCommand,
  CountCommand,
  BoundingBoxCommand,
  ConsoleCommand,
  ErrorsCommand,
  KeyboardCommand,
  WheelCommand,
  TapCommand,
  ClipboardCommand,
  HighlightCommand,
  ClearCommand,
  SelectAllCommand,
  InnerTextCommand,
  InnerHtmlCommand,
  InputValueCommand,
  SetValueCommand,
  DispatchEventCommand,
  AddScriptCommand,
  AddStyleCommand,
  EmulateMediaCommand,
  GetByAltTextCommand,
  GetByTitleCommand,
  GetByTestIdCommand,
  NthCommand,
  WaitForUrlCommand,
  WaitForLoadStateCommand,
  SetContentCommand,
  MouseMoveCommand,
  MouseDownCommand,
  MouseUpCommand,
  WaitForFunctionCommand,
  ScrollIntoViewCommand,
  KeyDownCommand,
  KeyUpCommand,
  InsertTextCommand,
  MultiSelectCommand,
  ScreencastStartCommand,
  ScreencastStopCommand,
  InputMouseCommand,
  InputKeyboardCommand,
  InputTouchCommand,
  NavigateData,
  ScreenshotData,
  EvaluateData,
  ContentData,
  SnapshotData,
  ScreencastStartData,
  ScreencastStopData,
  InputEventData,
} from './types.js';
import { successResponse, errorResponse } from './protocol.js';
import { describe } from './describe.js';

// Screencast frame callback
let screencastFrameCallback: ((frame: ScreencastFrame) => void) | null = null;

/**
 * Set the callback for screencast frames
 */
export function setScreencastFrameCallback(
  callback: ((frame: ScreencastFrame) => void) | null
): void {
  screencastFrameCallback = callback;
}

/**
 * Convert errors to AI-friendly messages
 */
export function toAIFriendlyError(error: unknown, selector: string): Error {
  const message = error instanceof Error ? error.message : String(error);

  // Element not found
  if (message.includes('not found') || message.includes('null')) {
    return new Error(
      `Element "${selector}" not found. Run 'snapshot' to see current page elements.`
    );
  }

  // Element not visible
  if (message.includes('not visible') || message.includes('hidden')) {
    return new Error(
      `Element "${selector}" is not visible. Try scrolling it into view or check if it's hidden.`
    );
  }

  return error instanceof Error ? error : new Error(message);
}

/**
 * Get element and throw if not found
 */
function getRequiredElement(browser: BrowserManager, selector: string): Element {
  const element = browser.getElement(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element;
}

/**
 * Handle help request - returns documentation for an action
 */
function handleHelpRequest(command: Command): Response {
  const action = command.action;
  const info = describe(action === 'help' ? undefined : action);

  // Return help response using describe()
  return successResponse(command.id, {
    type: 'help',
    ...info,
  });
}

/**
 * Execute a command and return a response
 *
 * If command.help is true, returns documentation for the action instead of executing.
 * This enables AI agents to self-correct by calling the same action with help: true.
 */
export async function executeCommand(command: Command, browser: BrowserManager): Promise<Response> {
  // Handle help request - return documentation instead of executing
  if (command.help) {
    return handleHelpRequest(command);
  }

  try {
    switch (command.action) {
      case 'launch':
        return await handleLaunch(command, browser);
      case 'navigate':
        return await handleNavigate(command, browser);
      case 'click':
        return await handleClick(command, browser);
      case 'type':
        return await handleType(command, browser);
      case 'fill':
        return await handleFill(command, browser);
      case 'check':
        return await handleCheck(command, browser);
      case 'uncheck':
        return await handleUncheck(command, browser);
      case 'dblclick':
        return await handleDoubleClick(command, browser);
      case 'focus':
        return await handleFocus(command, browser);
      case 'drag':
        return await handleDrag(command, browser);
      case 'frame':
        return await handleFrame(command, browser);
      case 'mainframe':
        return await handleMainFrame(command, browser);
      case 'getbyrole':
        return await handleGetByRole(command, browser);
      case 'getbytext':
        return await handleGetByText(command, browser);
      case 'getbylabel':
        return await handleGetByLabel(command, browser);
      case 'getbyplaceholder':
        return await handleGetByPlaceholder(command, browser);
      case 'press':
        return await handlePress(command, browser);
      case 'screenshot':
        return await handleScreenshot(command, browser);
      case 'snapshot':
        return await handleSnapshot(command, browser);
      case 'evaluate':
        return await handleEvaluate(command, browser);
      case 'wait':
        return await handleWait(command, browser);
      case 'scroll':
        return await handleScroll(command, browser);
      case 'select':
        return await handleSelect(command, browser);
      case 'hover':
        return await handleHover(command, browser);
      case 'content':
        return await handleContent(command, browser);
      case 'close':
        return await handleClose(command, browser);
      case 'storage_get':
        return await handleStorageGet(command, browser);
      case 'storage_set':
        return await handleStorageSet(command, browser);
      case 'storage_clear':
        return await handleStorageClear(command, browser);
      case 'dialog':
        return await handleDialog(command, browser);
      case 'back':
        return await handleBack(command, browser);
      case 'forward':
        return await handleForward(command, browser);
      case 'reload':
        return await handleReload(command, browser);
      case 'url':
        return await handleUrl(command, browser);
      case 'title':
        return await handleTitle(command, browser);
      case 'getattribute':
        return await handleGetAttribute(command, browser);
      case 'gettext':
        return await handleGetText(command, browser);
      case 'isvisible':
        return await handleIsVisible(command, browser);
      case 'isenabled':
        return await handleIsEnabled(command, browser);
      case 'ischecked':
        return await handleIsChecked(command, browser);
      case 'count':
        return await handleCount(command, browser);
      case 'boundingbox':
        return await handleBoundingBox(command, browser);
      case 'console':
        return await handleConsole(command, browser);
      case 'errors':
        return await handleErrors(command, browser);
      case 'keyboard':
        return await handleKeyboard(command, browser);
      case 'wheel':
        return await handleWheel(command, browser);
      case 'tap':
        return await handleTap(command, browser);
      case 'clipboard':
        return await handleClipboard(command, browser);
      case 'highlight':
        return await handleHighlight(command, browser);
      case 'clear':
        return await handleClear(command, browser);
      case 'selectall':
        return await handleSelectAll(command, browser);
      case 'innertext':
        return await handleInnerText(command, browser);
      case 'innerhtml':
        return await handleInnerHtml(command, browser);
      case 'inputvalue':
        return await handleInputValue(command, browser);
      case 'setvalue':
        return await handleSetValue(command, browser);
      case 'dispatch':
        return await handleDispatch(command, browser);
      case 'addscript':
        return await handleAddScript(command, browser);
      case 'addstyle':
        return await handleAddStyle(command, browser);
      case 'emulatemedia':
        return await handleEmulateMedia(command, browser);
      case 'getbyalttext':
        return await handleGetByAltText(command, browser);
      case 'getbytitle':
        return await handleGetByTitle(command, browser);
      case 'getbytestid':
        return await handleGetByTestId(command, browser);
      case 'nth':
        return await handleNth(command, browser);
      case 'waitforurl':
        return await handleWaitForUrl(command, browser);
      case 'waitforloadstate':
        return await handleWaitForLoadState(command, browser);
      case 'setcontent':
        return await handleSetContent(command, browser);
      case 'mousemove':
        return await handleMouseMove(command, browser);
      case 'mousedown':
        return await handleMouseDown(command, browser);
      case 'mouseup':
        return await handleMouseUp(command, browser);
      case 'waitforfunction':
        return await handleWaitForFunction(command, browser);
      case 'scrollintoview':
        return await handleScrollIntoView(command, browser);
      case 'keydown':
        return await handleKeyDown(command, browser);
      case 'keyup':
        return await handleKeyUp(command, browser);
      case 'inserttext':
        return await handleInsertText(command, browser);
      case 'multiselect':
        return await handleMultiSelect(command, browser);
      case 'screencast_start':
        return await handleScreencastStart(command, browser);
      case 'screencast_stop':
        return await handleScreencastStop(command, browser);
      case 'input_mouse':
        return await handleInputMouse(command, browser);
      case 'input_keyboard':
        return await handleInputKeyboard(command, browser);
      case 'input_touch':
        return await handleInputTouch(command, browser);
      default: {
        const unknownCommand = command as { id: string; action: string };
        return errorResponse(unknownCommand.id, `Unknown action: ${unknownCommand.action}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(command.id, message);
  }
}

// Handler implementations

async function handleLaunch(
  command: Command & { action: 'launch' },
  browser: BrowserManager
): Promise<Response> {
  await browser.launch(command);
  return successResponse(command.id, { launched: true });
}

async function handleNavigate(
  command: NavigateCommand,
  browser: BrowserManager
): Promise<Response<NavigateData>> {
  const win = browser.getWindow();
  const doc = browser.getDocument();

  // Navigate to the URL
  win.location.href = command.url;

  // Wait for navigation to complete
  await new Promise<void>((resolve) => {
    const checkComplete = () => {
      if (doc.readyState === 'complete') {
        resolve();
      } else {
        setTimeout(checkComplete, 100);
      }
    };
    checkComplete();
  });

  return successResponse(command.id, {
    url: win.location.href,
    title: doc.title,
  });
}

async function handleClick(command: ClickCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  try {
    // Focus the element first
    if (element instanceof HTMLElement) {
      element.focus();
    }

    // Dispatch mouse events
    const clickCount = command.clickCount ?? 1;
    for (let i = 0; i < clickCount; i++) {
      browser.dispatchMouseEvent(element, 'mousedown', { button: getButton(command.button) });
      browser.dispatchMouseEvent(element, 'mouseup', { button: getButton(command.button) });
      browser.dispatchMouseEvent(element, 'click', { button: getButton(command.button) });

      if (command.delay && i < clickCount - 1) {
        await sleep(command.delay);
      }
    }
  } catch (error) {
    throw toAIFriendlyError(error, command.selector);
  }

  return successResponse(command.id, { clicked: true });
}

async function handleType(command: TypeCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  try {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      throw new Error('Element is not an input or textarea');
    }

    // Focus the element
    element.focus();

    // Clear if requested
    if (command.clear) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Type character by character
    for (const char of command.text) {
      browser.dispatchKeyboardEvent(element, 'keydown', char);
      browser.dispatchKeyboardEvent(element, 'keypress', char);
      element.value += char;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      browser.dispatchKeyboardEvent(element, 'keyup', char);

      if (command.delay) {
        await sleep(command.delay);
      }
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (error) {
    throw toAIFriendlyError(error, command.selector);
  }

  return successResponse(command.id, { typed: true });
}

async function handleFill(command: FillCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  try {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      throw new Error('Element is not an input or textarea');
    }

    element.focus();
    element.value = command.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } catch (error) {
    throw toAIFriendlyError(error, command.selector);
  }

  return successResponse(command.id, { filled: true });
}

async function handleCheck(command: CheckCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  try {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('Element is not a checkbox or radio');
    }

    if (!element.checked) {
      element.click();
    }
  } catch (error) {
    throw toAIFriendlyError(error, command.selector);
  }

  return successResponse(command.id, { checked: true });
}

async function handleUncheck(command: UncheckCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  try {
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('Element is not a checkbox');
    }

    if (element.checked) {
      element.click();
    }
  } catch (error) {
    throw toAIFriendlyError(error, command.selector);
  }

  return successResponse(command.id, { unchecked: true });
}

async function handleDoubleClick(
  command: DoubleClickCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  try {
    browser.dispatchMouseEvent(element, 'dblclick');
  } catch (error) {
    throw toAIFriendlyError(error, command.selector);
  }

  return successResponse(command.id, { clicked: true });
}

async function handleFocus(command: FocusCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  try {
    if (element instanceof HTMLElement) {
      element.focus();
    }
  } catch (error) {
    throw toAIFriendlyError(error, command.selector);
  }

  return successResponse(command.id, { focused: true });
}

async function handleDrag(command: DragCommand, browser: BrowserManager): Promise<Response> {
  const source = getRequiredElement(browser, command.source);
  const target = getRequiredElement(browser, command.target);

  // Simplified drag and drop simulation
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  browser.dispatchMouseEvent(source, 'mousedown', {
    clientX: sourceRect.left + sourceRect.width / 2,
    clientY: sourceRect.top + sourceRect.height / 2,
  });

  browser.dispatchMouseEvent(target, 'mousemove', {
    clientX: targetRect.left + targetRect.width / 2,
    clientY: targetRect.top + targetRect.height / 2,
  });

  browser.dispatchMouseEvent(target, 'mouseup', {
    clientX: targetRect.left + targetRect.width / 2,
    clientY: targetRect.top + targetRect.height / 2,
  });

  // Dispatch drag events
  source.dispatchEvent(
    new DragEvent('dragstart', { bubbles: true, cancelable: true })
  );
  target.dispatchEvent(
    new DragEvent('drop', { bubbles: true, cancelable: true })
  );
  source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true }));

  return successResponse(command.id, { dragged: true });
}

async function handleFrame(command: FrameCommand, browser: BrowserManager): Promise<Response> {
  await browser.switchToFrame({
    selector: command.selector,
    name: command.name,
    url: command.url,
  });
  return successResponse(command.id, { switched: true });
}

async function handleMainFrame(
  command: Command & { action: 'mainframe' },
  browser: BrowserManager
): Promise<Response> {
  browser.switchToMainFrame();
  return successResponse(command.id, { switched: true });
}

async function handleGetByRole(
  command: GetByRoleCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();

  // Find elements by role
  const elements = Array.from(doc.querySelectorAll(`[role="${command.role}"]`));

  // Also check implicit roles
  const implicitElements = findElementsByImplicitRole(doc, command.role);
  const allElements = [...elements, ...implicitElements];

  // Filter by name if provided
  let element: Element | undefined;
  if (command.name) {
    element = allElements.find((el) => {
      const name = getAccessibleName(el);
      return name && name.includes(command.name!);
    });
  } else {
    element = allElements[0];
  }

  if (!element) {
    throw new Error(`Element not found with role "${command.role}"${command.name ? ` and name "${command.name}"` : ''}`);
  }

  switch (command.subaction) {
    case 'click':
      if (element instanceof HTMLElement) element.click();
      return successResponse(command.id, { clicked: true });
    case 'fill':
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = command.value ?? '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return successResponse(command.id, { filled: true });
    case 'check':
      if (element instanceof HTMLInputElement) {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return successResponse(command.id, { checked: true });
    case 'hover':
      browser.dispatchMouseEvent(element, 'mouseenter');
      browser.dispatchMouseEvent(element, 'mouseover');
      return successResponse(command.id, { hovered: true });
  }
}

async function handleGetByText(
  command: GetByTextCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();

  // Find element by text content
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let element: Element | null = null;

  while (walker.nextNode()) {
    const el = walker.currentNode as Element;
    const text = el.textContent?.trim();
    if (text) {
      const matches = command.exact ? text === command.text : text.includes(command.text);
      if (matches) {
        element = el;
        break;
      }
    }
  }

  if (!element) {
    throw new Error(`Element not found with text "${command.text}"`);
  }

  switch (command.subaction) {
    case 'click':
      if (element instanceof HTMLElement) element.click();
      return successResponse(command.id, { clicked: true });
    case 'hover':
      browser.dispatchMouseEvent(element, 'mouseenter');
      browser.dispatchMouseEvent(element, 'mouseover');
      return successResponse(command.id, { hovered: true });
  }
}

async function handleGetByLabel(
  command: GetByLabelCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();

  // Find label element
  const labels = Array.from(doc.querySelectorAll('label'));
  const label = labels.find((l) => l.textContent?.includes(command.label));

  if (!label) {
    throw new Error(`Label not found: "${command.label}"`);
  }

  // Find associated input
  let element: Element | null = null;
  const forId = label.getAttribute('for');
  if (forId) {
    element = doc.getElementById(forId);
  } else {
    element = label.querySelector('input, textarea, select');
  }

  if (!element) {
    throw new Error(`No input found for label "${command.label}"`);
  }

  switch (command.subaction) {
    case 'click':
      if (element instanceof HTMLElement) element.click();
      return successResponse(command.id, { clicked: true });
    case 'fill':
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = command.value ?? '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return successResponse(command.id, { filled: true });
    case 'check':
      if (element instanceof HTMLInputElement) {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return successResponse(command.id, { checked: true });
  }
}

async function handleGetByPlaceholder(
  command: GetByPlaceholderCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const element = doc.querySelector(`[placeholder="${command.placeholder}"]`);

  if (!element) {
    throw new Error(`Element not found with placeholder "${command.placeholder}"`);
  }

  switch (command.subaction) {
    case 'click':
      if (element instanceof HTMLElement) element.click();
      return successResponse(command.id, { clicked: true });
    case 'fill':
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = command.value ?? '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return successResponse(command.id, { filled: true });
  }
}

async function handlePress(command: PressCommand, browser: BrowserManager): Promise<Response> {
  const doc = browser.getDocument();
  const element = command.selector
    ? getRequiredElement(browser, command.selector)
    : doc.activeElement || doc.body;

  browser.dispatchKeyboardEvent(element, 'keydown', command.key);
  browser.dispatchKeyboardEvent(element, 'keypress', command.key);
  browser.dispatchKeyboardEvent(element, 'keyup', command.key);

  return successResponse(command.id, { pressed: true });
}

async function handleScreenshot(
  command: ScreenshotCommand,
  browser: BrowserManager
): Promise<Response<ScreenshotData>> {
  const base64 = await browser.screenshot({
    format: command.format,
    quality: command.quality,
    fullPage: command.fullPage,
    selector: command.selector,
  });

  return successResponse(command.id, { base64 });
}

async function handleSnapshot(
  command: Command & {
    action: 'snapshot';
    interactive?: boolean;
    maxDepth?: number;
    compact?: boolean;
    selector?: string;
  },
  browser: BrowserManager
): Promise<Response<SnapshotData>> {
  const { tree, refs } = await browser.getSnapshot({
    interactive: command.interactive,
    maxDepth: command.maxDepth,
    compact: command.compact,
    selector: command.selector,
  });

  const simpleRefs: Record<string, { role: string; name?: string }> = {};
  for (const [ref, data] of Object.entries(refs)) {
    simpleRefs[ref] = { role: data.role, name: data.name };
  }

  return successResponse(command.id, {
    snapshot: tree || 'Empty page',
    refs: Object.keys(simpleRefs).length > 0 ? simpleRefs : undefined,
  });
}

async function handleEvaluate(
  command: EvaluateCommand,
  browser: BrowserManager
): Promise<Response<EvaluateData>> {
  const win = browser.getWindow();

  // Use Function constructor to evaluate in the window context
  const fn = new Function(`return (${command.script})`);
  const result = fn.call(win);

  return successResponse(command.id, { result });
}

async function handleWait(command: WaitCommand, browser: BrowserManager): Promise<Response> {
  if (command.selector) {
    await browser.waitForElement(command.selector, {
      state: command.state,
      timeout: command.timeout,
    });
  } else if (command.timeout) {
    await sleep(command.timeout);
  }

  return successResponse(command.id, { waited: true });
}

async function handleScroll(command: ScrollCommand, browser: BrowserManager): Promise<Response> {
  const win = browser.getWindow();

  if (command.selector) {
    const element = getRequiredElement(browser, command.selector);
    element.scrollIntoView({ behavior: 'smooth' });

    if (command.x !== undefined || command.y !== undefined) {
      element.scrollBy(command.x ?? 0, command.y ?? 0);
    }
  } else {
    let deltaX = command.x ?? 0;
    let deltaY = command.y ?? 0;

    if (command.direction) {
      const amount = command.amount ?? 100;
      switch (command.direction) {
        case 'up':
          deltaY = -amount;
          break;
        case 'down':
          deltaY = amount;
          break;
        case 'left':
          deltaX = -amount;
          break;
        case 'right':
          deltaX = amount;
          break;
      }
    }

    win.scrollBy(deltaX, deltaY);
  }

  return successResponse(command.id, { scrolled: true });
}

async function handleSelect(command: SelectCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('Element is not a select');
  }

  const values = Array.isArray(command.values) ? command.values : [command.values];

  for (const option of element.options) {
    option.selected = values.includes(option.value);
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));

  return successResponse(command.id, { selected: values });
}

async function handleHover(command: HoverCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  browser.dispatchMouseEvent(element, 'mouseenter');
  browser.dispatchMouseEvent(element, 'mouseover');

  return successResponse(command.id, { hovered: true });
}

async function handleContent(
  command: ContentCommand,
  browser: BrowserManager
): Promise<Response<ContentData>> {
  const doc = browser.getDocument();

  let html: string;
  if (command.selector) {
    const element = getRequiredElement(browser, command.selector);
    html = element.innerHTML;
  } else {
    html = doc.documentElement.outerHTML;
  }

  return successResponse(command.id, { html });
}

async function handleClose(
  command: Command & { action: 'close' },
  browser: BrowserManager
): Promise<Response> {
  await browser.close();
  return successResponse(command.id, { closed: true });
}

async function handleStorageGet(
  command: StorageGetCommand,
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  const storage = command.type === 'local' ? win.localStorage : win.sessionStorage;

  if (command.key) {
    const value = storage.getItem(command.key);
    return successResponse(command.id, { key: command.key, value });
  } else {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        data[key] = storage.getItem(key);
      }
    }
    return successResponse(command.id, { data });
  }
}

async function handleStorageSet(
  command: StorageSetCommand,
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  const storage = command.type === 'local' ? win.localStorage : win.sessionStorage;

  storage.setItem(command.key, command.value);

  return successResponse(command.id, { set: true });
}

async function handleStorageClear(
  command: StorageClearCommand,
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  const storage = command.type === 'local' ? win.localStorage : win.sessionStorage;

  storage.clear();

  return successResponse(command.id, { cleared: true });
}

async function handleDialog(command: DialogCommand, browser: BrowserManager): Promise<Response> {
  browser.setDialogHandler(command.response, command.promptText);
  return successResponse(command.id, { handler: 'set', response: command.response });
}

async function handleBack(
  command: Command & { action: 'back' },
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  win.history.back();
  return successResponse(command.id, { url: win.location.href });
}

async function handleForward(
  command: Command & { action: 'forward' },
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  win.history.forward();
  return successResponse(command.id, { url: win.location.href });
}

async function handleReload(
  command: Command & { action: 'reload' },
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  win.location.reload();
  return successResponse(command.id, { url: win.location.href });
}

async function handleUrl(
  command: Command & { action: 'url' },
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  return successResponse(command.id, { url: win.location.href });
}

async function handleTitle(
  command: Command & { action: 'title' },
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  return successResponse(command.id, { title: doc.title });
}

async function handleGetAttribute(
  command: GetAttributeCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const value = element.getAttribute(command.attribute);
  return successResponse(command.id, { attribute: command.attribute, value });
}

async function handleGetText(command: GetTextCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const text = element.textContent;
  return successResponse(command.id, { text });
}

async function handleIsVisible(
  command: IsVisibleCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = browser.getElement(command.selector);
  let visible = false;

  if (element instanceof HTMLElement) {
    const style = browser.getWindow().getComputedStyle(element);
    visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  return successResponse(command.id, { visible });
}

async function handleIsEnabled(
  command: IsEnabledCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const enabled = !(element as HTMLInputElement).disabled;
  return successResponse(command.id, { enabled });
}

async function handleIsChecked(
  command: IsCheckedCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const checked = (element as HTMLInputElement).checked ?? false;
  return successResponse(command.id, { checked });
}

async function handleCount(command: CountCommand, browser: BrowserManager): Promise<Response> {
  const elements = browser.getElements(command.selector);
  return successResponse(command.id, { count: elements.length });
}

async function handleBoundingBox(
  command: BoundingBoxCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const rect = element.getBoundingClientRect();
  return successResponse(command.id, {
    box: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
  });
}

async function handleConsole(command: ConsoleCommand, browser: BrowserManager): Promise<Response> {
  if (command.clear) {
    browser.clearConsoleMessages();
    return successResponse(command.id, { cleared: true });
  }

  const messages = browser.getConsoleMessages();
  return successResponse(command.id, { messages });
}

async function handleErrors(command: ErrorsCommand, browser: BrowserManager): Promise<Response> {
  if (command.clear) {
    browser.clearPageErrors();
    return successResponse(command.id, { cleared: true });
  }

  const errors = browser.getPageErrors();
  return successResponse(command.id, { errors });
}

async function handleKeyboard(
  command: KeyboardCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const element = doc.activeElement || doc.body;

  browser.dispatchKeyboardEvent(element, 'keydown', command.keys);
  browser.dispatchKeyboardEvent(element, 'keypress', command.keys);
  browser.dispatchKeyboardEvent(element, 'keyup', command.keys);

  return successResponse(command.id, { pressed: command.keys });
}

async function handleWheel(command: WheelCommand, browser: BrowserManager): Promise<Response> {
  const doc = browser.getDocument();
  let target: Element = doc.body;

  if (command.selector) {
    target = getRequiredElement(browser, command.selector);
  }

  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaX: command.deltaX ?? 0,
    deltaY: command.deltaY ?? 0,
  });

  target.dispatchEvent(event);

  return successResponse(command.id, { scrolled: true });
}

async function handleTap(command: TapCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const rect = element.getBoundingClientRect();

  browser.dispatchTouchEvent(element, 'touchstart', [
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
  ]);
  browser.dispatchTouchEvent(element, 'touchend', [
    { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
  ]);

  return successResponse(command.id, { tapped: true });
}

async function handleClipboard(
  command: ClipboardCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();

  switch (command.operation) {
    case 'copy':
      doc.execCommand('copy');
      return successResponse(command.id, { copied: true });
    case 'paste':
      doc.execCommand('paste');
      return successResponse(command.id, { pasted: true });
    case 'read':
      try {
        const text = await navigator.clipboard.readText();
        return successResponse(command.id, { text });
      } catch {
        return errorResponse(command.id, 'Clipboard access denied');
      }
    default:
      return errorResponse(command.id, 'Unknown clipboard operation');
  }
}

async function handleHighlight(
  command: HighlightCommand,
  browser: BrowserManager
): Promise<Response> {
  browser.highlightElement(command.selector);
  return successResponse(command.id, { highlighted: true });
}

async function handleClear(command: ClearCommand, browser: BrowserManager): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return successResponse(command.id, { cleared: true });
}

async function handleSelectAll(
  command: SelectAllCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.select();
  }

  return successResponse(command.id, { selected: true });
}

async function handleInnerText(
  command: InnerTextCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const text = (element as HTMLElement).innerText;
  return successResponse(command.id, { text });
}

async function handleInnerHtml(
  command: InnerHtmlCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const html = element.innerHTML;
  return successResponse(command.id, { html });
}

async function handleInputValue(
  command: InputValueCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const value = (element as HTMLInputElement).value;
  return successResponse(command.id, { value });
}

async function handleSetValue(
  command: SetValueCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = command.value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  return successResponse(command.id, { set: true });
}

async function handleDispatch(
  command: DispatchEventCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  const event = new CustomEvent(command.event, {
    bubbles: true,
    cancelable: true,
    detail: command.eventInit,
  });

  element.dispatchEvent(event);

  return successResponse(command.id, { dispatched: command.event });
}

async function handleAddScript(
  command: AddScriptCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const script = doc.createElement('script');

  if (command.content) {
    script.textContent = command.content;
  } else if (command.url) {
    script.src = command.url;
  }

  doc.head.appendChild(script);

  return successResponse(command.id, { added: true });
}

async function handleAddStyle(
  command: AddStyleCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();

  if (command.content) {
    const style = doc.createElement('style');
    style.textContent = command.content;
    doc.head.appendChild(style);
  } else if (command.url) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = command.url;
    doc.head.appendChild(link);
  }

  return successResponse(command.id, { added: true });
}

async function handleEmulateMedia(
  command: EmulateMediaCommand,
  _browser: BrowserManager
): Promise<Response> {
  // Note: Limited support in browser context
  // This would require CSS media query manipulation
  return successResponse(command.id, {
    emulated: true,
    note: 'Media emulation has limited support in browser context',
  });
}

async function handleGetByAltText(
  command: GetByAltTextCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const images = Array.from(doc.querySelectorAll('img[alt]'));

  const element = images.find((img) => {
    const alt = img.getAttribute('alt');
    return command.exact ? alt === command.text : alt?.includes(command.text);
  });

  if (!element) {
    throw new Error(`Image not found with alt text "${command.text}"`);
  }

  switch (command.subaction) {
    case 'click':
      if (element instanceof HTMLElement) element.click();
      return successResponse(command.id, { clicked: true });
    case 'hover':
      browser.dispatchMouseEvent(element, 'mouseenter');
      browser.dispatchMouseEvent(element, 'mouseover');
      return successResponse(command.id, { hovered: true });
  }
}

async function handleGetByTitle(
  command: GetByTitleCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const elements = Array.from(doc.querySelectorAll('[title]'));

  const element = elements.find((el) => {
    const title = el.getAttribute('title');
    return command.exact ? title === command.text : title?.includes(command.text);
  });

  if (!element) {
    throw new Error(`Element not found with title "${command.text}"`);
  }

  switch (command.subaction) {
    case 'click':
      if (element instanceof HTMLElement) element.click();
      return successResponse(command.id, { clicked: true });
    case 'hover':
      browser.dispatchMouseEvent(element, 'mouseenter');
      browser.dispatchMouseEvent(element, 'mouseover');
      return successResponse(command.id, { hovered: true });
  }
}

async function handleGetByTestId(
  command: GetByTestIdCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const element = doc.querySelector(`[data-testid="${command.testId}"]`);

  if (!element) {
    throw new Error(`Element not found with test ID "${command.testId}"`);
  }

  switch (command.subaction) {
    case 'click':
      if (element instanceof HTMLElement) element.click();
      return successResponse(command.id, { clicked: true });
    case 'fill':
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = command.value ?? '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return successResponse(command.id, { filled: true });
    case 'check':
      if (element instanceof HTMLInputElement) {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return successResponse(command.id, { checked: true });
    case 'hover':
      browser.dispatchMouseEvent(element, 'mouseenter');
      browser.dispatchMouseEvent(element, 'mouseover');
      return successResponse(command.id, { hovered: true });
  }
}

async function handleNth(command: NthCommand, browser: BrowserManager): Promise<Response> {
  const elements = browser.getElements(command.selector);
  const index = command.index === -1 ? elements.length - 1 : command.index;
  const element = elements[index];

  if (!element) {
    throw new Error(`Element at index ${command.index} not found for selector "${command.selector}"`);
  }

  switch (command.subaction) {
    case 'click':
      if (element instanceof HTMLElement) element.click();
      return successResponse(command.id, { clicked: true });
    case 'fill':
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = command.value ?? '';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return successResponse(command.id, { filled: true });
    case 'check':
      if (element instanceof HTMLInputElement) {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return successResponse(command.id, { checked: true });
    case 'hover':
      browser.dispatchMouseEvent(element, 'mouseenter');
      browser.dispatchMouseEvent(element, 'mouseover');
      return successResponse(command.id, { hovered: true });
    case 'text':
      const text = element.textContent;
      return successResponse(command.id, { text });
  }
}

async function handleWaitForUrl(
  command: WaitForUrlCommand,
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  const timeout = command.timeout ?? 5000;

  await browser.waitFor(
    () => win.location.href.includes(command.url),
    timeout
  );

  return successResponse(command.id, { url: win.location.href });
}

async function handleWaitForLoadState(
  command: WaitForLoadStateCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const timeout = command.timeout ?? 5000;

  await browser.waitFor(() => {
    switch (command.state) {
      case 'load':
        return doc.readyState === 'complete';
      case 'domcontentloaded':
        return doc.readyState !== 'loading';
      case 'networkidle':
        // Can't truly detect network idle in browser context
        return doc.readyState === 'complete';
      default:
        return true;
    }
  }, timeout);

  return successResponse(command.id, { state: command.state });
}

async function handleSetContent(
  command: SetContentCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  doc.documentElement.innerHTML = command.html;
  return successResponse(command.id, { set: true });
}

async function handleMouseMove(
  command: MouseMoveCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const element = doc.elementFromPoint(command.x, command.y) || doc.body;

  browser.dispatchMouseEvent(element, 'mousemove', {
    clientX: command.x,
    clientY: command.y,
  });

  return successResponse(command.id, { moved: true, x: command.x, y: command.y });
}

async function handleMouseDown(
  command: MouseDownCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const element = doc.activeElement || doc.body;

  browser.dispatchMouseEvent(element, 'mousedown', {
    button: getButton(command.button),
  });

  return successResponse(command.id, { down: true });
}

async function handleMouseUp(command: MouseUpCommand, browser: BrowserManager): Promise<Response> {
  const doc = browser.getDocument();
  const element = doc.activeElement || doc.body;

  browser.dispatchMouseEvent(element, 'mouseup', {
    button: getButton(command.button),
  });

  return successResponse(command.id, { up: true });
}

async function handleWaitForFunction(
  command: WaitForFunctionCommand,
  browser: BrowserManager
): Promise<Response> {
  const win = browser.getWindow();
  const timeout = command.timeout ?? 5000;

  await browser.waitFor(() => {
    const fn = new Function(`return (${command.expression})`);
    return !!fn.call(win);
  }, timeout);

  return successResponse(command.id, { waited: true });
}

async function handleScrollIntoView(
  command: ScrollIntoViewCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return successResponse(command.id, { scrolled: true });
}

async function handleKeyDown(command: KeyDownCommand, browser: BrowserManager): Promise<Response> {
  const doc = browser.getDocument();
  browser.dispatchKeyboardEvent(doc.activeElement, 'keydown', command.key);
  return successResponse(command.id, { down: true, key: command.key });
}

async function handleKeyUp(command: KeyUpCommand, browser: BrowserManager): Promise<Response> {
  const doc = browser.getDocument();
  browser.dispatchKeyboardEvent(doc.activeElement, 'keyup', command.key);
  return successResponse(command.id, { up: true, key: command.key });
}

async function handleInsertText(
  command: InsertTextCommand,
  browser: BrowserManager
): Promise<Response> {
  const doc = browser.getDocument();
  const element = doc.activeElement;

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    element.value = element.value.slice(0, start) + command.text + element.value.slice(end);
    element.selectionStart = element.selectionEnd = start + command.text.length;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  return successResponse(command.id, { inserted: true });
}

async function handleMultiSelect(
  command: MultiSelectCommand,
  browser: BrowserManager
): Promise<Response> {
  const element = getRequiredElement(browser, command.selector);

  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('Element is not a select');
  }

  for (const option of element.options) {
    option.selected = command.values.includes(option.value);
  }

  element.dispatchEvent(new Event('change', { bubbles: true }));

  return successResponse(command.id, { selected: command.values });
}

async function handleScreencastStart(
  command: ScreencastStartCommand,
  browser: BrowserManager
): Promise<Response<ScreencastStartData>> {
  const callback = screencastFrameCallback || (() => {});

  await browser.startScreencast(callback, {
    format: command.format,
    quality: command.quality,
    maxWidth: command.maxWidth,
    maxHeight: command.maxHeight,
    interval: command.everyNthFrame ? command.everyNthFrame * 16 : undefined,
  });

  return successResponse(command.id, {
    started: true,
    format: command.format ?? 'jpeg',
    quality: command.quality ?? 80,
  });
}

async function handleScreencastStop(
  command: ScreencastStopCommand,
  browser: BrowserManager
): Promise<Response<ScreencastStopData>> {
  await browser.stopScreencast();
  return successResponse(command.id, { stopped: true });
}

async function handleInputMouse(
  command: InputMouseCommand,
  browser: BrowserManager
): Promise<Response<InputEventData>> {
  const doc = browser.getDocument();
  const element = doc.elementFromPoint(command.x, command.y) || doc.body;

  const eventType =
    command.type === 'mousePressed'
      ? 'mousedown'
      : command.type === 'mouseReleased'
        ? 'mouseup'
        : command.type === 'mouseMoved'
          ? 'mousemove'
          : 'wheel';

  browser.dispatchMouseEvent(element, eventType, {
    button: getButton(command.button),
    clickCount: command.clickCount,
    clientX: command.x,
    clientY: command.y,
  });

  return successResponse(command.id, { injected: true });
}

async function handleInputKeyboard(
  command: InputKeyboardCommand,
  browser: BrowserManager
): Promise<Response<InputEventData>> {
  const doc = browser.getDocument();

  const eventType =
    command.type === 'keyDown'
      ? 'keydown'
      : command.type === 'keyUp'
        ? 'keyup'
        : 'keypress';

  browser.dispatchKeyboardEvent(doc.activeElement, eventType, command.key || '', {
    code: command.code,
  });

  return successResponse(command.id, { injected: true });
}

async function handleInputTouch(
  command: InputTouchCommand,
  browser: BrowserManager
): Promise<Response<InputEventData>> {
  const doc = browser.getDocument();
  const firstPoint = command.touchPoints[0];
  const element = doc.elementFromPoint(firstPoint?.x ?? 0, firstPoint?.y ?? 0) || doc.body;

  const eventType =
    command.type === 'touchStart'
      ? 'touchstart'
      : command.type === 'touchEnd'
        ? 'touchend'
        : command.type === 'touchMove'
          ? 'touchmove'
          : 'touchcancel';

  browser.dispatchTouchEvent(element, eventType, command.touchPoints);

  return successResponse(command.id, { injected: true });
}

// Helper functions

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getButton(button?: 'left' | 'right' | 'middle' | 'none'): number {
  switch (button) {
    case 'right':
      return 2;
    case 'middle':
      return 1;
    case 'none':
      return -1;
    default:
      return 0;
  }
}

function getAccessibleName(el: Element): string {
  // aria-label
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // aria-labelledby
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (labels.length) return labels.join(' ');
  }

  // Text content for buttons and links
  if (el.tagName === 'BUTTON' || el.tagName === 'A') {
    return el.textContent?.trim() || '';
  }

  // Value for inputs
  if (el.tagName === 'INPUT') {
    const input = el as HTMLInputElement;
    if (['button', 'submit', 'reset'].includes(input.type)) {
      return input.value || input.type;
    }
  }

  return '';
}

function findElementsByImplicitRole(doc: Document, role: string): Element[] {
  const elements: Element[] = [];

  switch (role) {
    case 'button':
      elements.push(...Array.from(doc.querySelectorAll('button')));
      elements.push(...Array.from(doc.querySelectorAll('input[type="button"]')));
      elements.push(...Array.from(doc.querySelectorAll('input[type="submit"]')));
      elements.push(...Array.from(doc.querySelectorAll('input[type="reset"]')));
      break;
    case 'link':
      elements.push(...Array.from(doc.querySelectorAll('a[href]')));
      break;
    case 'textbox':
      elements.push(...Array.from(doc.querySelectorAll('input[type="text"]')));
      elements.push(...Array.from(doc.querySelectorAll('input[type="email"]')));
      elements.push(...Array.from(doc.querySelectorAll('input[type="password"]')));
      elements.push(...Array.from(doc.querySelectorAll('input[type="tel"]')));
      elements.push(...Array.from(doc.querySelectorAll('input[type="url"]')));
      elements.push(...Array.from(doc.querySelectorAll('input:not([type])')));
      elements.push(...Array.from(doc.querySelectorAll('textarea')));
      break;
    case 'checkbox':
      elements.push(...Array.from(doc.querySelectorAll('input[type="checkbox"]')));
      break;
    case 'radio':
      elements.push(...Array.from(doc.querySelectorAll('input[type="radio"]')));
      break;
    case 'combobox':
      elements.push(...Array.from(doc.querySelectorAll('select:not([multiple])')));
      break;
    case 'listbox':
      elements.push(...Array.from(doc.querySelectorAll('select[multiple]')));
      break;
    case 'heading':
      elements.push(...Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')));
      break;
    case 'img':
      elements.push(...Array.from(doc.querySelectorAll('img:not([alt=""])')));
      break;
    case 'navigation':
      elements.push(...Array.from(doc.querySelectorAll('nav')));
      break;
    case 'main':
      elements.push(...Array.from(doc.querySelectorAll('main')));
      break;
  }

  return elements;
}
