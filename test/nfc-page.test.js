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

test('Douyin flow requires a successful copy before direct app opening', async () => {
  const { context, elements } = createPageContext({ clipboardResult: true });
  context.publishDouyin();

  assert.equal(elements.modalOpenBtn.href, 'snssdk1128://');
  assert.equal(elements.modalFallbackBtn.href, context.DOUYIN_HOME);
  assert.equal(elements.modalOpenBtn.getAttribute('aria-disabled'), 'true');

  context.doCopy();
  await flushPromises();

  assert.equal(elements.modalOpenBtn.getAttribute('aria-disabled'), 'false');
  assert.equal(elements.modalStatus.textContent, '文案已复制，现在可以打开 App 发布');
  assert.ok(elements.modalStatus.classList.contains('success'));
});

test('copy failure is reported honestly and leaves manual recovery available', async () => {
  const { context, elements } = createPageContext({
    clipboardResult: false,
    fallbackCopyResult: false
  });
  context.publishXhs();
  context.doCopy();
  await flushPromises();

  assert.equal(elements.modalOpenBtn.getAttribute('aria-disabled'), 'false');
  assert.match(elements.modalStatus.textContent, /自动复制失败/);
  assert.ok(elements.modalStatus.classList.contains('error'));
  assert.equal(elements.modalFallbackBtn.href, context.XHS_POI);
});

test('WeChat blocks custom-scheme navigation and keeps the web fallback visible', async () => {
  const { context, elements } = createPageContext({
    userAgent: 'MicroMessenger',
    fallbackCopyResult: true
  });
  context.publishXhs();
  context.doCopy();
  await flushPromises();

  let prevented = false;
  context.handleAppOpen({ preventDefault() { prevented = true; } });

  assert.equal(prevented, true);
  assert.ok(elements.wechatTip.classList.contains('show'));
  assert.match(elements.modalStatus.textContent, /微信可能拦截/);
  assert.equal(elements.modalFallbackBtn.href, context.XHS_POI);
});

test('a real app background transition cancels the failure detector', async () => {
  const { context, document, listeners } = createPageContext({ clipboardResult: true });
  context.publishDouyin();
  context.doCopy();
  await flushPromises();

  context.handleAppOpen({ preventDefault() {} });
  assert.equal(typeof listeners.get('visibilitychange'), 'function');

  document.hidden = true;
  listeners.get('visibilitychange')();

  assert.equal(context.launchTimer, null);
  assert.equal(context.launchVisibilityHandler, null);
  assert.equal(listeners.has('visibilitychange'), false);
});
