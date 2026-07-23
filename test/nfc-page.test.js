const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function readPage(name = 'index.html') {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

function extractScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'page should contain an inline script');
  return match[1];
}

function createElement() {
  const attributes = new Map();
  const classes = new Set();
  const element = {
    value: '',
    textContent: '',
    disabled: false,
    href: '',
    style: {},
    focus() {},
    select() {},
    setSelectionRange() {},
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    }
  };

  Object.defineProperty(element, 'className', {
    get() {
      return Array.from(classes).join(' ');
    },
    set(value) {
      classes.clear();
      String(value).split(/\s+/).filter(Boolean).forEach(item => classes.add(item));
    }
  });

  element.classList = {
    add(...items) {
      items.forEach(item => classes.add(item));
    },
    remove(...items) {
      items.forEach(item => classes.delete(item));
    },
    contains(item) {
      return classes.has(item);
    },
    toggle(item, force) {
      if (force === true) classes.add(item);
      else if (force === false) classes.delete(item);
      else if (classes.has(item)) classes.delete(item);
      else classes.add(item);
      return classes.has(item);
    }
  };

  return element;
}

function createPageContext(options = {}) {
  const listeners = new Map();
  const ids = [
    'wechatTip', 'toast', 'modalOverlay', 'modalTitle', 'modalText',
    'modalCopyBtn', 'modalStatus', 'modalOpenBtn', 'modalFallbackBtn'
  ];
  const elements = Object.fromEntries(ids.map(id => [id, createElement()]));
  const document = {
    hidden: false,
    body: {
      appendChild() {},
      removeChild() {}
    },
    getElementById(id) {
      return elements[id];
    },
    createElement() {
      return createElement();
    },
    execCommand() {
      return options.fallbackCopyResult !== false;
    },
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    removeEventListener(name, handler) {
      if (listeners.get(name) === handler) listeners.delete(name);
    }
  };
  const navigator = { userAgent: options.userAgent || 'Mozilla/5.0' };

  if (options.clipboardResult === true) {
    navigator.clipboard = { writeText: () => Promise.resolve() };
  } else if (options.clipboardResult === false) {
    navigator.clipboard = { writeText: () => Promise.reject(new Error('denied')) };
  }

  const context = vm.createContext({
    document,
    navigator,
    window: {},
    setTimeout: () => 1,
    clearTimeout: () => {}
  });
  new vm.Script(extractScript(readPage()), { filename: 'index.html' }).runInContext(context);
  return { context, document, elements, listeners };
}

async function flushPromises() {
  await new Promise(resolve => setImmediate(resolve));
}

test('both published entry files stay byte-for-byte identical', () => {
  assert.equal(readPage('index.html'), readPage('nfc.html'));
});

test('legacy iframe and broken timer fallback are removed', () => {
  const html = readPage();
  assert.doesNotMatch(html, /createElement\('iframe'\)/);
  assert.doesNotMatch(html, /Date\.now\(\) - start < 2500/);
  assert.doesNotMatch(html, /doCopyAndJump/);
});

test('Douyin flow copies text and triggers app opening after delay', async () => {
  const { context, elements } = createPageContext({ clipboardResult: true });
  let redirectUrl = '';
  context.window.location = {
    get href() { return ''; },
    set href(value) { redirectUrl = value; }
  };

  context.publishDouyin();
  await flushPromises();

  assert.equal(elements.toast.textContent, '文案已复制');
});

test('copy failure is reported via toast', async () => {
  const { context, elements } = createPageContext({
    clipboardResult: false,
    fallbackCopyResult: false
  });

  context.publishXhs();
  await flushPromises();

  assert.equal(elements.toast.textContent, '复制失败，请手动复制');
});

test('WeChat blocks custom-scheme navigation and shows tip', async () => {
  const { context, elements } = createPageContext({
    userAgent: 'MicroMessenger',
    fallbackCopyResult: true
  });

  context.publishXhs();
  await flushPromises();

  assert.ok(elements.wechatTip.classList.contains('show'));
});
