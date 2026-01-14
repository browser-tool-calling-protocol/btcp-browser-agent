/**
 * Browser Tool Calling Protocol - Command Protocol
 *
 * Handles command parsing, validation, and response formatting.
 */

import { z } from 'zod';
import type { Command, Response, SuccessResponse, ErrorResponse } from './types.js';

// Base command schema
const baseCommandSchema = z.object({
  id: z.string(),
  action: z.string(),
});

// Navigation
const navigateSchema = baseCommandSchema.extend({
  action: z.literal('navigate'),
  url: z.string(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional(),
  headers: z.record(z.string()).optional(),
});

// Click
const clickSchema = baseCommandSchema.extend({
  action: z.literal('click'),
  selector: z.string(),
  button: z.enum(['left', 'right', 'middle']).optional(),
  clickCount: z.number().optional(),
  delay: z.number().optional(),
});

// Type
const typeSchema = baseCommandSchema.extend({
  action: z.literal('type'),
  selector: z.string(),
  text: z.string(),
  delay: z.number().optional(),
  clear: z.boolean().optional(),
});

// Fill
const fillSchema = baseCommandSchema.extend({
  action: z.literal('fill'),
  selector: z.string(),
  value: z.string(),
});

// Check/Uncheck
const checkSchema = baseCommandSchema.extend({
  action: z.literal('check'),
  selector: z.string(),
});

const uncheckSchema = baseCommandSchema.extend({
  action: z.literal('uncheck'),
  selector: z.string(),
});

// Upload
const uploadSchema = baseCommandSchema.extend({
  action: z.literal('upload'),
  selector: z.string(),
  files: z.union([z.string(), z.array(z.string())]),
});

// Double click
const dblclickSchema = baseCommandSchema.extend({
  action: z.literal('dblclick'),
  selector: z.string(),
});

// Focus
const focusSchema = baseCommandSchema.extend({
  action: z.literal('focus'),
  selector: z.string(),
});

// Drag
const dragSchema = baseCommandSchema.extend({
  action: z.literal('drag'),
  source: z.string(),
  target: z.string(),
});

// Frame
const frameSchema = baseCommandSchema.extend({
  action: z.literal('frame'),
  selector: z.string().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
});

const mainframeSchema = baseCommandSchema.extend({
  action: z.literal('mainframe'),
});

// Semantic locators
const getByRoleSchema = baseCommandSchema.extend({
  action: z.literal('getbyrole'),
  role: z.string(),
  name: z.string().optional(),
  subaction: z.enum(['click', 'fill', 'check', 'hover']),
  value: z.string().optional(),
});

const getByTextSchema = baseCommandSchema.extend({
  action: z.literal('getbytext'),
  text: z.string(),
  exact: z.boolean().optional(),
  subaction: z.enum(['click', 'hover']),
});

const getByLabelSchema = baseCommandSchema.extend({
  action: z.literal('getbylabel'),
  label: z.string(),
  subaction: z.enum(['click', 'fill', 'check']),
  value: z.string().optional(),
});

const getByPlaceholderSchema = baseCommandSchema.extend({
  action: z.literal('getbyplaceholder'),
  placeholder: z.string(),
  subaction: z.enum(['click', 'fill']),
  value: z.string().optional(),
});

const getByAltTextSchema = baseCommandSchema.extend({
  action: z.literal('getbyalttext'),
  text: z.string(),
  exact: z.boolean().optional(),
  subaction: z.enum(['click', 'hover']),
});

const getByTitleSchema = baseCommandSchema.extend({
  action: z.literal('getbytitle'),
  text: z.string(),
  exact: z.boolean().optional(),
  subaction: z.enum(['click', 'hover']),
});

const getByTestIdSchema = baseCommandSchema.extend({
  action: z.literal('getbytestid'),
  testId: z.string(),
  subaction: z.enum(['click', 'fill', 'check', 'hover']),
  value: z.string().optional(),
});

const nthSchema = baseCommandSchema.extend({
  action: z.literal('nth'),
  selector: z.string(),
  index: z.number(),
  subaction: z.enum(['click', 'fill', 'check', 'hover', 'text']),
  value: z.string().optional(),
});

// Press
const pressSchema = baseCommandSchema.extend({
  action: z.literal('press'),
  key: z.string(),
  selector: z.string().optional(),
});

// Screenshot
const screenshotSchema = baseCommandSchema.extend({
  action: z.literal('screenshot'),
  path: z.string().optional(),
  fullPage: z.boolean().optional(),
  selector: z.string().optional(),
  format: z.enum(['png', 'jpeg']).optional(),
  quality: z.number().optional(),
});

// Snapshot
const snapshotSchema = baseCommandSchema.extend({
  action: z.literal('snapshot'),
  interactive: z.boolean().optional(),
  maxDepth: z.number().optional(),
  compact: z.boolean().optional(),
  selector: z.string().optional(),
});

// Evaluate
const evaluateSchema = baseCommandSchema.extend({
  action: z.literal('evaluate'),
  script: z.string(),
});

// Wait
const waitSchema = baseCommandSchema.extend({
  action: z.literal('wait'),
  selector: z.string().optional(),
  timeout: z.number().optional(),
  state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional(),
});

// Scroll
const scrollSchema = baseCommandSchema.extend({
  action: z.literal('scroll'),
  selector: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  amount: z.number().optional(),
});

// Select
const selectSchema = baseCommandSchema.extend({
  action: z.literal('select'),
  selector: z.string(),
  values: z.union([z.string(), z.array(z.string())]),
});

// Hover
const hoverSchema = baseCommandSchema.extend({
  action: z.literal('hover'),
  selector: z.string(),
});

// Content
const contentSchema = baseCommandSchema.extend({
  action: z.literal('content'),
  selector: z.string().optional(),
});

// Close
const closeSchema = baseCommandSchema.extend({
  action: z.literal('close'),
});

// Tab management
const tabNewSchema = baseCommandSchema.extend({
  action: z.literal('tab_new'),
});

const tabListSchema = baseCommandSchema.extend({
  action: z.literal('tab_list'),
});

const tabSwitchSchema = baseCommandSchema.extend({
  action: z.literal('tab_switch'),
  index: z.number(),
});

const tabCloseSchema = baseCommandSchema.extend({
  action: z.literal('tab_close'),
  index: z.number().optional(),
});

// Window
const windowNewSchema = baseCommandSchema.extend({
  action: z.literal('window_new'),
  viewport: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

// Cookies
const cookiesGetSchema = baseCommandSchema.extend({
  action: z.literal('cookies_get'),
  urls: z.array(z.string()).optional(),
});

const cookiesSetSchema = baseCommandSchema.extend({
  action: z.literal('cookies_set'),
  cookies: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      url: z.string().optional(),
      domain: z.string().optional(),
      path: z.string().optional(),
      expires: z.number().optional(),
      httpOnly: z.boolean().optional(),
      secure: z.boolean().optional(),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
    })
  ),
});

const cookiesClearSchema = baseCommandSchema.extend({
  action: z.literal('cookies_clear'),
});

// Storage
const storageGetSchema = baseCommandSchema.extend({
  action: z.literal('storage_get'),
  type: z.enum(['local', 'session']),
  key: z.string().optional(),
});

const storageSetSchema = baseCommandSchema.extend({
  action: z.literal('storage_set'),
  type: z.enum(['local', 'session']),
  key: z.string(),
  value: z.string(),
});

const storageClearSchema = baseCommandSchema.extend({
  action: z.literal('storage_clear'),
  type: z.enum(['local', 'session']),
});

// Dialog
const dialogSchema = baseCommandSchema.extend({
  action: z.literal('dialog'),
  response: z.enum(['accept', 'dismiss']),
  promptText: z.string().optional(),
});

// Network
const routeSchema = baseCommandSchema.extend({
  action: z.literal('route'),
  url: z.string(),
  response: z
    .object({
      status: z.number().optional(),
      body: z.string().optional(),
      contentType: z.string().optional(),
      headers: z.record(z.string()).optional(),
    })
    .optional(),
  abort: z.boolean().optional(),
});

const unrouteSchema = baseCommandSchema.extend({
  action: z.literal('unroute'),
  url: z.string().optional(),
});

const requestsSchema = baseCommandSchema.extend({
  action: z.literal('requests'),
  filter: z.string().optional(),
  clear: z.boolean().optional(),
});

// Download
const downloadSchema = baseCommandSchema.extend({
  action: z.literal('download'),
  selector: z.string(),
  path: z.string(),
});

// Geolocation
const geolocationSchema = baseCommandSchema.extend({
  action: z.literal('geolocation'),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number().optional(),
});

// Permissions
const permissionsSchema = baseCommandSchema.extend({
  action: z.literal('permissions'),
  permissions: z.array(z.string()),
  grant: z.boolean(),
});

// Viewport
const viewportSchema = baseCommandSchema.extend({
  action: z.literal('viewport'),
  width: z.number(),
  height: z.number(),
});

// Device
const deviceSchema = baseCommandSchema.extend({
  action: z.literal('device'),
  device: z.string(),
});

// Element queries
const getAttributeSchema = baseCommandSchema.extend({
  action: z.literal('getattribute'),
  selector: z.string(),
  attribute: z.string(),
});

const getTextSchema = baseCommandSchema.extend({
  action: z.literal('gettext'),
  selector: z.string(),
});

const isVisibleSchema = baseCommandSchema.extend({
  action: z.literal('isvisible'),
  selector: z.string(),
});

const isEnabledSchema = baseCommandSchema.extend({
  action: z.literal('isenabled'),
  selector: z.string(),
});

const isCheckedSchema = baseCommandSchema.extend({
  action: z.literal('ischecked'),
  selector: z.string(),
});

const countSchema = baseCommandSchema.extend({
  action: z.literal('count'),
  selector: z.string(),
});

const boundingBoxSchema = baseCommandSchema.extend({
  action: z.literal('boundingbox'),
  selector: z.string(),
});

// Console/Errors
const consoleSchema = baseCommandSchema.extend({
  action: z.literal('console'),
  clear: z.boolean().optional(),
});

const errorsSchema = baseCommandSchema.extend({
  action: z.literal('errors'),
  clear: z.boolean().optional(),
});

// Keyboard
const keyboardSchema = baseCommandSchema.extend({
  action: z.literal('keyboard'),
  keys: z.string(),
});

const wheelSchema = baseCommandSchema.extend({
  action: z.literal('wheel'),
  selector: z.string().optional(),
  deltaX: z.number().optional(),
  deltaY: z.number().optional(),
});

const tapSchema = baseCommandSchema.extend({
  action: z.literal('tap'),
  selector: z.string(),
});

const clipboardSchema = baseCommandSchema.extend({
  action: z.literal('clipboard'),
  operation: z.enum(['copy', 'paste', 'read']),
});

const highlightSchema = baseCommandSchema.extend({
  action: z.literal('highlight'),
  selector: z.string(),
});

const clearSchema = baseCommandSchema.extend({
  action: z.literal('clear'),
  selector: z.string(),
});

const selectAllSchema = baseCommandSchema.extend({
  action: z.literal('selectall'),
  selector: z.string(),
});

const innerTextSchema = baseCommandSchema.extend({
  action: z.literal('innertext'),
  selector: z.string(),
});

const innerHtmlSchema = baseCommandSchema.extend({
  action: z.literal('innerhtml'),
  selector: z.string(),
});

const inputValueSchema = baseCommandSchema.extend({
  action: z.literal('inputvalue'),
  selector: z.string(),
});

const setValueSchema = baseCommandSchema.extend({
  action: z.literal('setvalue'),
  selector: z.string(),
  value: z.string(),
});

const dispatchSchema = baseCommandSchema.extend({
  action: z.literal('dispatch'),
  selector: z.string(),
  event: z.string(),
  eventInit: z.record(z.unknown()).optional(),
});

const addScriptSchema = baseCommandSchema.extend({
  action: z.literal('addscript'),
  content: z.string().optional(),
  url: z.string().optional(),
});

const addStyleSchema = baseCommandSchema.extend({
  action: z.literal('addstyle'),
  content: z.string().optional(),
  url: z.string().optional(),
});

const emulateMediaSchema = baseCommandSchema.extend({
  action: z.literal('emulatemedia'),
  media: z.enum(['screen', 'print']).nullable().optional(),
  colorScheme: z.enum(['light', 'dark', 'no-preference']).nullable().optional(),
  reducedMotion: z.enum(['reduce', 'no-preference']).nullable().optional(),
  forcedColors: z.enum(['active', 'none']).nullable().optional(),
});

const offlineSchema = baseCommandSchema.extend({
  action: z.literal('offline'),
  offline: z.boolean(),
});

const headersSchema = baseCommandSchema.extend({
  action: z.literal('headers'),
  headers: z.record(z.string()),
});

// Wait commands
const waitForUrlSchema = baseCommandSchema.extend({
  action: z.literal('waitforurl'),
  url: z.string(),
  timeout: z.number().optional(),
});

const waitForLoadStateSchema = baseCommandSchema.extend({
  action: z.literal('waitforloadstate'),
  state: z.enum(['load', 'domcontentloaded', 'networkidle']),
  timeout: z.number().optional(),
});

const setContentSchema = baseCommandSchema.extend({
  action: z.literal('setcontent'),
  html: z.string(),
});

// Mouse
const mouseMoveSchema = baseCommandSchema.extend({
  action: z.literal('mousemove'),
  x: z.number(),
  y: z.number(),
});

const mouseDownSchema = baseCommandSchema.extend({
  action: z.literal('mousedown'),
  button: z.enum(['left', 'right', 'middle']).optional(),
});

const mouseUpSchema = baseCommandSchema.extend({
  action: z.literal('mouseup'),
  button: z.enum(['left', 'right', 'middle']).optional(),
});

const waitForFunctionSchema = baseCommandSchema.extend({
  action: z.literal('waitforfunction'),
  expression: z.string(),
  timeout: z.number().optional(),
});

const scrollIntoViewSchema = baseCommandSchema.extend({
  action: z.literal('scrollintoview'),
  selector: z.string(),
});

const keyDownSchema = baseCommandSchema.extend({
  action: z.literal('keydown'),
  key: z.string(),
});

const keyUpSchema = baseCommandSchema.extend({
  action: z.literal('keyup'),
  key: z.string(),
});

const insertTextSchema = baseCommandSchema.extend({
  action: z.literal('inserttext'),
  text: z.string(),
});

const multiSelectSchema = baseCommandSchema.extend({
  action: z.literal('multiselect'),
  selector: z.string(),
  values: z.array(z.string()),
});

// Screencast
const screencastStartSchema = baseCommandSchema.extend({
  action: z.literal('screencast_start'),
  format: z.enum(['jpeg', 'png']).optional(),
  quality: z.number().optional(),
  maxWidth: z.number().optional(),
  maxHeight: z.number().optional(),
  everyNthFrame: z.number().optional(),
});

const screencastStopSchema = baseCommandSchema.extend({
  action: z.literal('screencast_stop'),
});

// Input injection
const inputMouseSchema = baseCommandSchema.extend({
  action: z.literal('input_mouse'),
  type: z.enum(['mousePressed', 'mouseReleased', 'mouseMoved', 'mouseWheel']),
  x: z.number(),
  y: z.number(),
  button: z.enum(['left', 'right', 'middle', 'none']).optional(),
  clickCount: z.number().optional(),
  deltaX: z.number().optional(),
  deltaY: z.number().optional(),
  modifiers: z.number().optional(),
});

const inputKeyboardSchema = baseCommandSchema.extend({
  action: z.literal('input_keyboard'),
  type: z.enum(['keyDown', 'keyUp', 'char']),
  key: z.string().optional(),
  code: z.string().optional(),
  text: z.string().optional(),
  modifiers: z.number().optional(),
});

const inputTouchSchema = baseCommandSchema.extend({
  action: z.literal('input_touch'),
  type: z.enum(['touchStart', 'touchEnd', 'touchMove', 'touchCancel']),
  touchPoints: z.array(
    z.object({
      x: z.number(),
      y: z.number(),
      id: z.number().optional(),
    })
  ),
  modifiers: z.number().optional(),
});

// Launch
const launchSchema = baseCommandSchema.extend({
  action: z.literal('launch'),
  headless: z.boolean().optional(),
  viewport: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  headers: z.record(z.string()).optional(),
});

// Simple action schemas
const simpleActions = [
  'back',
  'forward',
  'reload',
  'url',
  'title',
  'pause',
  'bringtofront',
] as const;

const simpleActionSchemas = simpleActions.map((action) =>
  baseCommandSchema.extend({ action: z.literal(action) })
);

// Command schema union
const commandSchema = z.discriminatedUnion('action', [
  launchSchema,
  navigateSchema,
  clickSchema,
  typeSchema,
  fillSchema,
  checkSchema,
  uncheckSchema,
  uploadSchema,
  dblclickSchema,
  focusSchema,
  dragSchema,
  frameSchema,
  mainframeSchema,
  getByRoleSchema,
  getByTextSchema,
  getByLabelSchema,
  getByPlaceholderSchema,
  getByAltTextSchema,
  getByTitleSchema,
  getByTestIdSchema,
  nthSchema,
  pressSchema,
  screenshotSchema,
  snapshotSchema,
  evaluateSchema,
  waitSchema,
  scrollSchema,
  selectSchema,
  hoverSchema,
  contentSchema,
  closeSchema,
  tabNewSchema,
  tabListSchema,
  tabSwitchSchema,
  tabCloseSchema,
  windowNewSchema,
  cookiesGetSchema,
  cookiesSetSchema,
  cookiesClearSchema,
  storageGetSchema,
  storageSetSchema,
  storageClearSchema,
  dialogSchema,
  routeSchema,
  unrouteSchema,
  requestsSchema,
  downloadSchema,
  geolocationSchema,
  permissionsSchema,
  viewportSchema,
  deviceSchema,
  getAttributeSchema,
  getTextSchema,
  isVisibleSchema,
  isEnabledSchema,
  isCheckedSchema,
  countSchema,
  boundingBoxSchema,
  consoleSchema,
  errorsSchema,
  keyboardSchema,
  wheelSchema,
  tapSchema,
  clipboardSchema,
  highlightSchema,
  clearSchema,
  selectAllSchema,
  innerTextSchema,
  innerHtmlSchema,
  inputValueSchema,
  setValueSchema,
  dispatchSchema,
  addScriptSchema,
  addStyleSchema,
  emulateMediaSchema,
  offlineSchema,
  headersSchema,
  waitForUrlSchema,
  waitForLoadStateSchema,
  setContentSchema,
  mouseMoveSchema,
  mouseDownSchema,
  mouseUpSchema,
  waitForFunctionSchema,
  scrollIntoViewSchema,
  keyDownSchema,
  keyUpSchema,
  insertTextSchema,
  multiSelectSchema,
  screencastStartSchema,
  screencastStopSchema,
  inputMouseSchema,
  inputKeyboardSchema,
  inputTouchSchema,
  ...simpleActionSchemas,
]);

/**
 * Parse and validate a command from JSON string or object
 */
export function parseCommand(input: string | object): Command | { error: string; id?: string } {
  let data: unknown;

  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { error: 'Invalid JSON' };
    }
  } else {
    data = input;
  }

  // Extract ID for error tracking
  const id = typeof data === 'object' && data !== null && 'id' in data ? String((data as { id: unknown }).id) : undefined;

  const result = commandSchema.safeParse(data);
  if (result.success) {
    return result.data as Command;
  }

  return {
    error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
    id,
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(id: string, data: T): SuccessResponse<T> {
  return {
    id,
    success: true,
    data,
  };
}

/**
 * Create an error response
 */
export function errorResponse(id: string, error: string): ErrorResponse {
  return {
    id,
    success: false,
    error,
  };
}

/**
 * Serialize a response to JSON string
 */
export function serializeResponse(response: Response): string {
  return JSON.stringify(response);
}

/**
 * Generate a unique command ID
 */
export function generateCommandId(): string {
  return `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
