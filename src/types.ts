/**
 * Browser Tool Calling Protocol - Type Definitions
 *
 * Types for browser-native agent automation commands and responses.
 * Adapted from agent-browser for in-browser execution.
 */

// Base command interface
export interface BaseCommand {
  id: string;
  action: string;
  /** When true, returns help/documentation for this action instead of executing */
  help?: boolean;
}

// Navigation commands
export interface NavigateCommand extends BaseCommand {
  action: 'navigate';
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  headers?: Record<string, string>;
}

export interface NavigateData {
  url: string;
  title: string;
}

// Click command
export interface ClickCommand extends BaseCommand {
  action: 'click';
  selector: string;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
}

// Type command (keystroke by keystroke)
export interface TypeCommand extends BaseCommand {
  action: 'type';
  selector: string;
  text: string;
  delay?: number;
  clear?: boolean;
}

// Fill command (instant value set)
export interface FillCommand extends BaseCommand {
  action: 'fill';
  selector: string;
  value: string;
}

// Check/Uncheck commands
export interface CheckCommand extends BaseCommand {
  action: 'check';
  selector: string;
}

export interface UncheckCommand extends BaseCommand {
  action: 'uncheck';
  selector: string;
}

// Upload command
export interface UploadCommand extends BaseCommand {
  action: 'upload';
  selector: string;
  files: string | string[];
}

// Double click
export interface DoubleClickCommand extends BaseCommand {
  action: 'dblclick';
  selector: string;
}

// Focus
export interface FocusCommand extends BaseCommand {
  action: 'focus';
  selector: string;
}

// Drag and drop
export interface DragCommand extends BaseCommand {
  action: 'drag';
  source: string;
  target: string;
}

// Frame switching
export interface FrameCommand extends BaseCommand {
  action: 'frame';
  selector?: string;
  name?: string;
  url?: string;
}

// Semantic locators
export interface GetByRoleCommand extends BaseCommand {
  action: 'getbyrole';
  role: string;
  name?: string;
  subaction: 'click' | 'fill' | 'check' | 'hover';
  value?: string;
}

export interface GetByTextCommand extends BaseCommand {
  action: 'getbytext';
  text: string;
  exact?: boolean;
  subaction: 'click' | 'hover';
}

export interface GetByLabelCommand extends BaseCommand {
  action: 'getbylabel';
  label: string;
  subaction: 'click' | 'fill' | 'check';
  value?: string;
}

export interface GetByPlaceholderCommand extends BaseCommand {
  action: 'getbyplaceholder';
  placeholder: string;
  subaction: 'click' | 'fill';
  value?: string;
}

export interface GetByAltTextCommand extends BaseCommand {
  action: 'getbyalttext';
  text: string;
  exact?: boolean;
  subaction: 'click' | 'hover';
}

export interface GetByTitleCommand extends BaseCommand {
  action: 'getbytitle';
  text: string;
  exact?: boolean;
  subaction: 'click' | 'hover';
}

export interface GetByTestIdCommand extends BaseCommand {
  action: 'getbytestid';
  testId: string;
  subaction: 'click' | 'fill' | 'check' | 'hover';
  value?: string;
}

export interface NthCommand extends BaseCommand {
  action: 'nth';
  selector: string;
  index: number;
  subaction: 'click' | 'fill' | 'check' | 'hover' | 'text';
  value?: string;
}

// Press key
export interface PressCommand extends BaseCommand {
  action: 'press';
  key: string;
  selector?: string;
}

// Screenshot
export interface ScreenshotCommand extends BaseCommand {
  action: 'screenshot';
  path?: string;
  fullPage?: boolean;
  selector?: string;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ScreenshotData {
  base64?: string;
  path?: string;
}

// Snapshot (accessibility tree)
export interface SnapshotCommand extends BaseCommand {
  action: 'snapshot';
  interactive?: boolean;
  maxDepth?: number;
  compact?: boolean;
  selector?: string;
}

export interface SnapshotData {
  snapshot: string;
  refs?: Record<string, { role: string; name?: string }>;
}

// Evaluate JavaScript
export interface EvaluateCommand extends BaseCommand {
  action: 'evaluate';
  script: string;
}

export interface EvaluateData {
  result: unknown;
}

// Wait
export interface WaitCommand extends BaseCommand {
  action: 'wait';
  selector?: string;
  timeout?: number;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
}

// Scroll
export interface ScrollCommand extends BaseCommand {
  action: 'scroll';
  selector?: string;
  x?: number;
  y?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

// Select dropdown
export interface SelectCommand extends BaseCommand {
  action: 'select';
  selector: string;
  values: string | string[];
}

// Hover
export interface HoverCommand extends BaseCommand {
  action: 'hover';
  selector: string;
}

// Content
export interface ContentCommand extends BaseCommand {
  action: 'content';
  selector?: string;
}

export interface ContentData {
  html: string;
}

// Tab management
export interface TabSwitchCommand extends BaseCommand {
  action: 'tab_switch';
  index: number;
}

export interface TabCloseCommand extends BaseCommand {
  action: 'tab_close';
  index?: number;
}

export interface TabListData {
  tabs: Array<{ index: number; url: string; title: string; active: boolean }>;
  active: number;
}

export interface TabNewData {
  index: number;
  total: number;
}

export interface TabSwitchData {
  index: number;
  url: string;
  title: string;
}

export interface TabCloseData {
  closed: number;
  remaining: number;
}

// Window
export interface WindowNewCommand extends BaseCommand {
  action: 'window_new';
  viewport?: { width: number; height: number };
}

// Cookies
export interface CookiesSetCommand extends BaseCommand {
  action: 'cookies_set';
  cookies: Array<{
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }>;
}

// Storage
export interface StorageGetCommand extends BaseCommand {
  action: 'storage_get';
  type: 'local' | 'session';
  key?: string;
}

export interface StorageSetCommand extends BaseCommand {
  action: 'storage_set';
  type: 'local' | 'session';
  key: string;
  value: string;
}

export interface StorageClearCommand extends BaseCommand {
  action: 'storage_clear';
  type: 'local' | 'session';
}

// Dialog handling
export interface DialogCommand extends BaseCommand {
  action: 'dialog';
  response: 'accept' | 'dismiss';
  promptText?: string;
}

// PDF generation (limited in browser)
export interface PdfCommand extends BaseCommand {
  action: 'pdf';
  path: string;
  format?: string;
}

// Network
export interface RouteCommand extends BaseCommand {
  action: 'route';
  url: string;
  response?: {
    status?: number;
    body?: string;
    contentType?: string;
    headers?: Record<string, string>;
  };
  abort?: boolean;
}

export interface RequestsCommand extends BaseCommand {
  action: 'requests';
  filter?: string;
  clear?: boolean;
}

export interface DownloadCommand extends BaseCommand {
  action: 'download';
  selector: string;
  path: string;
}

// Device emulation
export interface GeolocationCommand extends BaseCommand {
  action: 'geolocation';
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface PermissionsCommand extends BaseCommand {
  action: 'permissions';
  permissions: string[];
  grant: boolean;
}

export interface ViewportCommand extends BaseCommand {
  action: 'viewport';
  width: number;
  height: number;
}

export interface DeviceCommand extends BaseCommand {
  action: 'device';
  device: string;
}

// Element queries
export interface GetAttributeCommand extends BaseCommand {
  action: 'getattribute';
  selector: string;
  attribute: string;
}

export interface GetTextCommand extends BaseCommand {
  action: 'gettext';
  selector: string;
}

export interface IsVisibleCommand extends BaseCommand {
  action: 'isvisible';
  selector: string;
}

export interface IsEnabledCommand extends BaseCommand {
  action: 'isenabled';
  selector: string;
}

export interface IsCheckedCommand extends BaseCommand {
  action: 'ischecked';
  selector: string;
}

export interface CountCommand extends BaseCommand {
  action: 'count';
  selector: string;
}

export interface BoundingBoxCommand extends BaseCommand {
  action: 'boundingbox';
  selector: string;
}

// Tracing
export interface TraceStartCommand extends BaseCommand {
  action: 'trace_start';
  screenshots?: boolean;
  snapshots?: boolean;
}

export interface TraceStopCommand extends BaseCommand {
  action: 'trace_stop';
  path: string;
}

export interface HarStopCommand extends BaseCommand {
  action: 'har_stop';
  path: string;
}

export interface StorageStateSaveCommand extends BaseCommand {
  action: 'state_save';
  path: string;
}

// Console/Errors
export interface ConsoleCommand extends BaseCommand {
  action: 'console';
  clear?: boolean;
}

export interface ErrorsCommand extends BaseCommand {
  action: 'errors';
  clear?: boolean;
}

// Keyboard
export interface KeyboardCommand extends BaseCommand {
  action: 'keyboard';
  keys: string;
}

export interface WheelCommand extends BaseCommand {
  action: 'wheel';
  selector?: string;
  deltaX?: number;
  deltaY?: number;
}

export interface TapCommand extends BaseCommand {
  action: 'tap';
  selector: string;
}

export interface ClipboardCommand extends BaseCommand {
  action: 'clipboard';
  operation: 'copy' | 'paste' | 'read';
}

export interface HighlightCommand extends BaseCommand {
  action: 'highlight';
  selector: string;
}

export interface ClearCommand extends BaseCommand {
  action: 'clear';
  selector: string;
}

export interface SelectAllCommand extends BaseCommand {
  action: 'selectall';
  selector: string;
}

export interface InnerTextCommand extends BaseCommand {
  action: 'innertext';
  selector: string;
}

export interface InnerHtmlCommand extends BaseCommand {
  action: 'innerhtml';
  selector: string;
}

export interface InputValueCommand extends BaseCommand {
  action: 'inputvalue';
  selector: string;
}

export interface SetValueCommand extends BaseCommand {
  action: 'setvalue';
  selector: string;
  value: string;
}

export interface DispatchEventCommand extends BaseCommand {
  action: 'dispatch';
  selector: string;
  event: string;
  eventInit?: Record<string, unknown>;
}

export interface AddScriptCommand extends BaseCommand {
  action: 'addscript';
  content?: string;
  url?: string;
}

export interface AddStyleCommand extends BaseCommand {
  action: 'addstyle';
  content?: string;
  url?: string;
}

export interface EmulateMediaCommand extends BaseCommand {
  action: 'emulatemedia';
  media?: 'screen' | 'print' | null;
  colorScheme?: 'light' | 'dark' | 'no-preference' | null;
  reducedMotion?: 'reduce' | 'no-preference' | null;
  forcedColors?: 'active' | 'none' | null;
}

export interface OfflineCommand extends BaseCommand {
  action: 'offline';
  offline: boolean;
}

export interface HeadersCommand extends BaseCommand {
  action: 'headers';
  headers: Record<string, string>;
}

// Wait commands
export interface WaitForUrlCommand extends BaseCommand {
  action: 'waitforurl';
  url: string;
  timeout?: number;
}

export interface WaitForLoadStateCommand extends BaseCommand {
  action: 'waitforloadstate';
  state: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

export interface SetContentCommand extends BaseCommand {
  action: 'setcontent';
  html: string;
}

export interface TimezoneCommand extends BaseCommand {
  action: 'timezone';
  timezone: string;
}

export interface LocaleCommand extends BaseCommand {
  action: 'locale';
  locale: string;
}

export interface HttpCredentialsCommand extends BaseCommand {
  action: 'credentials';
  username: string;
  password: string;
}

// Mouse commands
export interface MouseMoveCommand extends BaseCommand {
  action: 'mousemove';
  x: number;
  y: number;
}

export interface MouseDownCommand extends BaseCommand {
  action: 'mousedown';
  button?: 'left' | 'right' | 'middle';
}

export interface MouseUpCommand extends BaseCommand {
  action: 'mouseup';
  button?: 'left' | 'right' | 'middle';
}

export interface WaitForFunctionCommand extends BaseCommand {
  action: 'waitforfunction';
  expression: string;
  timeout?: number;
}

export interface ScrollIntoViewCommand extends BaseCommand {
  action: 'scrollintoview';
  selector: string;
}

export interface AddInitScriptCommand extends BaseCommand {
  action: 'addinitscript';
  script: string;
}

export interface KeyDownCommand extends BaseCommand {
  action: 'keydown';
  key: string;
}

export interface KeyUpCommand extends BaseCommand {
  action: 'keyup';
  key: string;
}

export interface InsertTextCommand extends BaseCommand {
  action: 'inserttext';
  text: string;
}

export interface MultiSelectCommand extends BaseCommand {
  action: 'multiselect';
  selector: string;
  values: string[];
}

export interface WaitForDownloadCommand extends BaseCommand {
  action: 'waitfordownload';
  timeout?: number;
  path?: string;
}

export interface ResponseBodyCommand extends BaseCommand {
  action: 'responsebody';
  url: string;
  timeout?: number;
}

// Screencast (for streaming)
export interface ScreencastStartCommand extends BaseCommand {
  action: 'screencast_start';
  format?: 'jpeg' | 'png';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  everyNthFrame?: number;
}

export interface ScreencastStopCommand extends BaseCommand {
  action: 'screencast_stop';
}

export interface ScreencastStartData {
  started: boolean;
  format: string;
  quality: number;
}

export interface ScreencastStopData {
  stopped: boolean;
}

// Input injection
export interface InputMouseCommand extends BaseCommand {
  action: 'input_mouse';
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved' | 'mouseWheel';
  x: number;
  y: number;
  button?: 'left' | 'right' | 'middle' | 'none';
  clickCount?: number;
  deltaX?: number;
  deltaY?: number;
  modifiers?: number;
}

export interface InputKeyboardCommand extends BaseCommand {
  action: 'input_keyboard';
  type: 'keyDown' | 'keyUp' | 'char';
  key?: string;
  code?: string;
  text?: string;
  modifiers?: number;
}

export interface InputTouchCommand extends BaseCommand {
  action: 'input_touch';
  type: 'touchStart' | 'touchEnd' | 'touchMove' | 'touchCancel';
  touchPoints: Array<{ x: number; y: number; id?: number }>;
  modifiers?: number;
}

export interface InputEventData {
  injected: boolean;
}

// Launch command (browser-specific options)
export interface LaunchCommand extends BaseCommand {
  action: 'launch';
  headless?: boolean;
  viewport?: { width: number; height: number };
  headers?: Record<string, string>;
  // Browser context specific
  targetWindow?: Window;
  targetDocument?: Document;
}

// Union of all commands
export type Command =
  | LaunchCommand
  | NavigateCommand
  | ClickCommand
  | TypeCommand
  | FillCommand
  | CheckCommand
  | UncheckCommand
  | UploadCommand
  | DoubleClickCommand
  | FocusCommand
  | DragCommand
  | FrameCommand
  | (BaseCommand & { action: 'mainframe' })
  | GetByRoleCommand
  | GetByTextCommand
  | GetByLabelCommand
  | GetByPlaceholderCommand
  | GetByAltTextCommand
  | GetByTitleCommand
  | GetByTestIdCommand
  | NthCommand
  | PressCommand
  | ScreenshotCommand
  | SnapshotCommand
  | EvaluateCommand
  | WaitCommand
  | ScrollCommand
  | SelectCommand
  | HoverCommand
  | ContentCommand
  | (BaseCommand & { action: 'close' })
  | (BaseCommand & { action: 'tab_new' })
  | (BaseCommand & { action: 'tab_list' })
  | TabSwitchCommand
  | TabCloseCommand
  | WindowNewCommand
  | (BaseCommand & { action: 'cookies_get'; urls?: string[] })
  | CookiesSetCommand
  | (BaseCommand & { action: 'cookies_clear' })
  | StorageGetCommand
  | StorageSetCommand
  | StorageClearCommand
  | DialogCommand
  | PdfCommand
  | RouteCommand
  | (BaseCommand & { action: 'unroute'; url?: string })
  | RequestsCommand
  | DownloadCommand
  | GeolocationCommand
  | PermissionsCommand
  | ViewportCommand
  | (BaseCommand & { action: 'useragent'; userAgent: string })
  | DeviceCommand
  | (BaseCommand & { action: 'back' })
  | (BaseCommand & { action: 'forward' })
  | (BaseCommand & { action: 'reload' })
  | (BaseCommand & { action: 'url' })
  | (BaseCommand & { action: 'title' })
  | GetAttributeCommand
  | GetTextCommand
  | IsVisibleCommand
  | IsEnabledCommand
  | IsCheckedCommand
  | CountCommand
  | BoundingBoxCommand
  | (BaseCommand & { action: 'video_start'; path: string })
  | (BaseCommand & { action: 'video_stop' })
  | TraceStartCommand
  | TraceStopCommand
  | (BaseCommand & { action: 'har_start' })
  | HarStopCommand
  | StorageStateSaveCommand
  | (BaseCommand & { action: 'state_load'; path: string })
  | ConsoleCommand
  | ErrorsCommand
  | KeyboardCommand
  | WheelCommand
  | TapCommand
  | ClipboardCommand
  | HighlightCommand
  | ClearCommand
  | SelectAllCommand
  | InnerTextCommand
  | InnerHtmlCommand
  | InputValueCommand
  | SetValueCommand
  | DispatchEventCommand
  | (BaseCommand & { action: 'evalhandle'; script: string })
  | (BaseCommand & { action: 'expose'; name: string })
  | AddScriptCommand
  | AddStyleCommand
  | EmulateMediaCommand
  | OfflineCommand
  | HeadersCommand
  | (BaseCommand & { action: 'pause' })
  | WaitForUrlCommand
  | WaitForLoadStateCommand
  | SetContentCommand
  | TimezoneCommand
  | LocaleCommand
  | HttpCredentialsCommand
  | MouseMoveCommand
  | MouseDownCommand
  | MouseUpCommand
  | (BaseCommand & { action: 'bringtofront' })
  | WaitForFunctionCommand
  | ScrollIntoViewCommand
  | AddInitScriptCommand
  | KeyDownCommand
  | KeyUpCommand
  | InsertTextCommand
  | MultiSelectCommand
  | WaitForDownloadCommand
  | ResponseBodyCommand
  | ScreencastStartCommand
  | ScreencastStopCommand
  | InputMouseCommand
  | InputKeyboardCommand
  | InputTouchCommand;

// Response types
export interface SuccessResponse<T = unknown> {
  id: string;
  success: true;
  data: T;
}

export interface ErrorResponse {
  id: string;
  success: false;
  error: string;
}

export type Response<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Element reference data
export interface ElementRef {
  role: string;
  name?: string;
  selector: string;
  nth?: number;
}

// Tracked request for network monitoring
export interface TrackedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: number;
  resourceType: string;
}

// Console message
export interface ConsoleMessage {
  type: string;
  text: string;
  timestamp: number;
}

// Page error
export interface PageError {
  message: string;
  timestamp: number;
}

// Device descriptor
export interface DeviceDescriptor {
  name: string;
  viewport: { width: number; height: number };
  userAgent: string;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
}
