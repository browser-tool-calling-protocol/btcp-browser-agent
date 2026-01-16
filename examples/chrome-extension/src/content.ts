/**
 * Content Script - registers DOM agent and message listener
 */
import { createContentAgent } from 'btcp-browser-agent/extension';

const agent = createContentAgent();
chrome.runtime.onMessage.addListener(agent.handleMessage);
