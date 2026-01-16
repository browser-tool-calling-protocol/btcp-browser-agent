/**
 * @aspect/core - Type definitions
 *
 * Core types for DOM automation commands and responses.
 */

// Command types - what the core package can handle
export type CoreAction =
  // Element interaction
  | 'click'
  | 'dblclick'
  | 'type'
  | 'fill'
  | 'clear'
  | 'check'
  | 'uncheck'
  | 'select'
  | 'focus'
  | 'blur'
  | 'hover'
  | 'scroll'
  | 'scrollIntoView'
  // DOM reading
  | 'snapshot'
  | 'querySelector'
  | 'querySelectorAll'
  | 'getText'
  | 'getAttribute'
  | 'getProperty'
  | 'getBoundingBox'
  | 'isVisible'
  | 'isEnabled'
  | 'isChecked'
  // Keyboard/Mouse
  | 'press'
  | 'keyDown'
  | 'keyUp'
  // Utility
  | 'wait'
  | 'evaluate';

// Base command structure
export interface BaseCommand {
  id: string;
  action: CoreAction;
}

// Element selector - supports CSS, ref, or semantic selectors
export type Selector = string;

// Command definitions
export interface ClickCommand extends BaseCommand {
  action: 'click';
  selector: Selector;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  modifiers?: Modifier[];
}

export interface DblClickCommand extends BaseCommand {
  action: 'dblclick';
  selector: Selector;
}

export interface TypeCommand extends BaseCommand {
  action: 'type';
  selector: Selector;
  text: string;
  delay?: number;
  clear?: boolean;
}

export interface FillCommand extends BaseCommand {
  action: 'fill';
  selector: Selector;
  value: string;
}

export interface ClearCommand extends BaseCommand {
  action: 'clear';
  selector: Selector;
}

export interface CheckCommand extends BaseCommand {
  action: 'check';
  selector: Selector;
}

export interface UncheckCommand extends BaseCommand {
  action: 'uncheck';
  selector: Selector;
}

export interface SelectCommand extends BaseCommand {
  action: 'select';
  selector: Selector;
  values: string | string[];
}

export interface FocusCommand extends BaseCommand {
  action: 'focus';
  selector: Selector;
}

export interface BlurCommand extends BaseCommand {
  action: 'blur';
  selector: Selector;
}

export interface HoverCommand extends BaseCommand {
  action: 'hover';
  selector: Selector;
}

export interface ScrollCommand extends BaseCommand {
  action: 'scroll';
  selector?: Selector;
  x?: number;
  y?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
}

export interface ScrollIntoViewCommand extends BaseCommand {
  action: 'scrollIntoView';
  selector: Selector;
  block?: 'start' | 'center' | 'end' | 'nearest';
}

export interface SnapshotCommand extends BaseCommand {
  action: 'snapshot';
  selector?: Selector;
  maxDepth?: number;
  includeHidden?: boolean;
}

export interface QuerySelectorCommand extends BaseCommand {
  action: 'querySelector';
  selector: Selector;
}

export interface QuerySelectorAllCommand extends BaseCommand {
  action: 'querySelectorAll';
  selector: Selector;
}

export interface GetTextCommand extends BaseCommand {
  action: 'getText';
  selector: Selector;
}

export interface GetAttributeCommand extends BaseCommand {
  action: 'getAttribute';
  selector: Selector;
  attribute: string;
}

export interface GetPropertyCommand extends BaseCommand {
  action: 'getProperty';
  selector: Selector;
  property: string;
}

export interface GetBoundingBoxCommand extends BaseCommand {
  action: 'getBoundingBox';
  selector: Selector;
}

export interface IsVisibleCommand extends BaseCommand {
  action: 'isVisible';
  selector: Selector;
}

export interface IsEnabledCommand extends BaseCommand {
  action: 'isEnabled';
  selector: Selector;
}

export interface IsCheckedCommand extends BaseCommand {
  action: 'isChecked';
  selector: Selector;
}

export interface PressCommand extends BaseCommand {
  action: 'press';
  key: string;
  selector?: Selector;
  modifiers?: Modifier[];
}

export interface KeyDownCommand extends BaseCommand {
  action: 'keyDown';
  key: string;
}

export interface KeyUpCommand extends BaseCommand {
  action: 'keyUp';
  key: string;
}

export interface WaitCommand extends BaseCommand {
  action: 'wait';
  selector?: Selector;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  timeout?: number;
}

export interface EvaluateCommand extends BaseCommand {
  action: 'evaluate';
  script: string;
  args?: unknown[];
}

export type Modifier = 'Alt' | 'Control' | 'Meta' | 'Shift';

// Union of all commands
export type Command =
  | ClickCommand
  | DblClickCommand
  | TypeCommand
  | FillCommand
  | ClearCommand
  | CheckCommand
  | UncheckCommand
  | SelectCommand
  | FocusCommand
  | BlurCommand
  | HoverCommand
  | ScrollCommand
  | ScrollIntoViewCommand
  | SnapshotCommand
  | QuerySelectorCommand
  | QuerySelectorAllCommand
  | GetTextCommand
  | GetAttributeCommand
  | GetPropertyCommand
  | GetBoundingBoxCommand
  | IsVisibleCommand
  | IsEnabledCommand
  | IsCheckedCommand
  | PressCommand
  | KeyDownCommand
  | KeyUpCommand
  | WaitCommand
  | EvaluateCommand;

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

// Snapshot data
export interface SnapshotNode {
  role: string;
  name?: string;
  ref?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  children?: SnapshotNode[];
}

export interface SnapshotData {
  tree: string;
  refs: Record<string, { selector: string; role: string; name?: string }>;
}

// Bounding box
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Element reference map
export interface RefMap {
  get(ref: string): Element | null;
  set(ref: string, element: Element): void;
  clear(): void;
  generateRef(element: Element): string;
}
