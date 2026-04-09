import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');

global.window = dom.window;
global.document = dom.window.document;
global.navigator = { userAgent: 'node.js' };

import '@testing-library/jest-dom';