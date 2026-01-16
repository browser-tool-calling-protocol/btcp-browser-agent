/**
 * Command registry - exports all available commands
 */

import type { CommandHandler } from '../types.js';

// Navigation
import { gotoCommand } from './goto.js';
import { backCommand } from './back.js';
import { forwardCommand } from './forward.js';
import { reloadCommand } from './reload.js';
import { urlCommand } from './url.js';
import { titleCommand } from './title.js';

// Snapshot & Screenshot
import { snapshotCommand } from './snapshot.js';
import { screenshotCommand } from './screenshot.js';

// DOM Interaction
import { clickCommand } from './click.js';
import { typeCommand } from './type.js';
import { fillCommand } from './fill.js';
import { clearCommand } from './clear.js';
import { hoverCommand } from './hover.js';
import { scrollCommand } from './scroll.js';
import { pressCommand } from './press.js';
import { focusCommand } from './focus.js';
import { checkCommand } from './check.js';
import { uncheckCommand } from './uncheck.js';
import { selectCommand } from './select.js';

// Tab Management
import { tabsCommand } from './tabs.js';
import { tabCommand } from './tab.js';
import { newtabCommand } from './newtab.js';
import { closetabCommand } from './closetab.js';

// Utility
import { waitCommand } from './wait.js';
import { evalCommand } from './eval.js';
import { textCommand } from './text.js';
import { helpCommand } from './help.js';

/**
 * Command registry - map of command name to handler
 */
export const commands: Record<string, CommandHandler> = {
  // Navigation
  goto: gotoCommand,
  back: backCommand,
  forward: forwardCommand,
  reload: reloadCommand,
  url: urlCommand,
  title: titleCommand,

  // Snapshot & Screenshot
  snapshot: snapshotCommand,
  screenshot: screenshotCommand,

  // DOM Interaction
  click: clickCommand,
  type: typeCommand,
  fill: fillCommand,
  clear: clearCommand,
  hover: hoverCommand,
  scroll: scrollCommand,
  press: pressCommand,
  focus: focusCommand,
  check: checkCommand,
  uncheck: uncheckCommand,
  select: selectCommand,

  // Tab Management
  tabs: tabsCommand,
  tab: tabCommand,
  newtab: newtabCommand,
  closetab: closetabCommand,

  // Utility
  wait: waitCommand,
  eval: evalCommand,
  text: textCommand,
  help: helpCommand,
};

/**
 * Get a command handler by name
 */
export function getCommand(name: string): CommandHandler | undefined {
  return commands[name.toLowerCase()];
}

/**
 * Get all command handlers
 */
export function getAllCommands(): CommandHandler[] {
  return Object.values(commands);
}

// Re-export individual commands for direct imports
export {
  gotoCommand,
  backCommand,
  forwardCommand,
  reloadCommand,
  urlCommand,
  titleCommand,
  snapshotCommand,
  screenshotCommand,
  clickCommand,
  typeCommand,
  fillCommand,
  clearCommand,
  hoverCommand,
  scrollCommand,
  pressCommand,
  focusCommand,
  checkCommand,
  uncheckCommand,
  selectCommand,
  tabsCommand,
  tabCommand,
  newtabCommand,
  closetabCommand,
  waitCommand,
  evalCommand,
  textCommand,
  helpCommand,
};
