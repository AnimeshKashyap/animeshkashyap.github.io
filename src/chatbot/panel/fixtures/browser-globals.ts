import { vi } from 'vitest';

export type BrowserGlobalsHandle = {
  sessionData: Map<string, string>;
  setReducedMotion: (value: boolean) => void;
  getFocusedElement: () => MockElement | null;
  reset: () => void;
};

type Listener = (event: {
  key?: string;
  preventDefault: () => void;
  target: MockElement;
}) => void;

class MockClassList {
  private readonly classes = new Set<string>();

  add(...tokens: string[]): void {
    for (const token of tokens) {
      this.classes.add(token);
    }
  }

  remove(...tokens: string[]): void {
    for (const token of tokens) {
      this.classes.delete(token);
    }
  }

  toggle(token: string, force?: boolean): void {
    if (force === true) {
      this.classes.add(token);
      return;
    }
    if (force === false) {
      this.classes.delete(token);
      return;
    }
    if (this.classes.has(token)) {
      this.classes.delete(token);
    } else {
      this.classes.add(token);
    }
  }

  contains(token: string): boolean {
    return this.classes.has(token);
  }

  clear(): void {
    this.classes.clear();
  }

  toString(): string {
    return [...this.classes].join(' ');
  }
}

function setFocusedElement(element: MockElement): void {
  focusedElement = element;
}

export class MockElement {
  readonly tagName: string;
  id = '';
  private _className = '';
  readonly classList = new MockClassList();

  get className(): string {
    return this._className;
  }

  set className(value: string) {
    this._className = value;
    this.classList.clear();
    if (value.length > 0) {
      this.classList.add(...value.split(/\s+/).filter(Boolean));
    }
  }
  private ownText = '';
  innerHTML = '';
  hidden = false;
  disabled = false;
  value = '';
  type = '';
  name = '';
  parentNode: MockElement | MockShadowRoot | null = null;
  readonly childNodes: MockElement[] = [];
  private readonly listeners = new Map<string, Listener[]>();
  readonly attributes = new Map<string, string>();
  readonly style = {
    _values: {} as Record<string, string>,
    set animationDelay(value: string) {
      this._values['animation-delay'] = value;
    },
    removeProperty(name: string): void {
      delete this._values[name];
    },
  };
  shadowRoot: MockShadowRoot | null = null;
  scrollTop = 0;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get children(): MockElement[] {
    return this.childNodes;
  }

  get childElementCount(): number {
    return this.childNodes.length;
  }

  get textContent(): string {
    if (this.childNodes.length === 0) {
      return this.ownText;
    }
    return this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value: string) {
    this.ownText = value;
    for (const child of [...this.childNodes]) {
      this.removeChild(child);
    }
  }

  get scrollHeight(): number {
    return Math.max(1, this.childNodes.length * 40);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === 'class') {
      this.className = value;
    }
    if (name === 'id') {
      this.id = value;
    }
    if (name === 'hidden') {
      this.hidden = true;
    }
  }

  getAttribute(name: string): string | null {
    if (name === 'hidden' && this.hidden && !this.attributes.has('hidden')) {
      return '';
    }
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === 'hidden') {
      this.hidden = false;
    }
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name) || (name === 'hidden' && this.hidden);
  }

  appendChild(child: MockElement): MockElement {
    if (child.parentNode !== null) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: MockElement): void {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      child.parentNode = null;
    }
  }

  replaceChildren(...children: MockElement[]): void {
    for (const child of [...this.childNodes]) {
      this.removeChild(child);
    }
    for (const child of children) {
      this.appendChild(child);
    }
  }

  append(...nodes: MockElement[]): void {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  dispatchEvent(type: string, init: { key?: string } = {}): void {
    const event = {
      ...init,
      preventDefault: vi.fn(),
      target: this,
    };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  focus(): void {
    setFocusedElement(this);
  }

  click(): void {
    this.dispatchEvent('click');
  }

  attachShadow(): MockShadowRoot {
    const root = new MockShadowRoot(this);
    this.shadowRoot = root;
    return root;
  }

  querySelector(selector: string): MockElement | null {
    return querySelectorInTree(this, selector);
  }

  querySelectorAll(selector: string): MockElement[] {
    return querySelectorAllInTree(this, selector);
  }
}

export class MockShadowRoot {
  readonly childNodes: MockElement[] = [];
  readonly host: MockElement;

  constructor(host: MockElement) {
    this.host = host;
  }

  appendChild(child: MockElement): MockElement {
    if (child.parentNode !== null) {
      child.parentNode.removeChild(child);
    }
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: MockElement): void {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
      child.parentNode = null;
    }
  }

  querySelector(selector: string): MockElement | null {
    for (const child of this.childNodes) {
      const match = querySelectorInTree(child, selector);
      if (match !== null) {
        return match;
      }
    }
    return null;
  }
}

let focusedElement: MockElement | null = null;
let reducedMotion = false;
const elementById = new Map<string, MockElement>();

function splitSelector(selector: string): { tag?: string; classes: string[]; id?: string } {
  const idIndex = selector.indexOf('#');
  const classIndex = selector.indexOf('.');
  let tag: string | undefined;
  let id: string | undefined;
  const classes: string[] = [];

  if (idIndex === -1 && classIndex === -1) {
    tag = selector || undefined;
    return { tag, classes };
  }

  const firstSpecial = Math.min(
    idIndex === -1 ? selector.length : idIndex,
    classIndex === -1 ? selector.length : classIndex,
  );
  if (firstSpecial > 0) {
    tag = selector.slice(0, firstSpecial);
  }

  const rest = selector.slice(firstSpecial);
  for (const part of rest.split(/(?=[.#])/)) {
    if (part.startsWith('#')) {
      id = part.slice(1);
    } else if (part.startsWith('.')) {
      classes.push(part.slice(1));
    }
  }

  return { tag, classes, id };
}

function elementMatches(el: MockElement, selector: string): boolean {
  const { tag, classes, id } = splitSelector(selector);
  if (id !== undefined && el.id !== id) {
    return false;
  }
  if (tag !== undefined && el.tagName.toLowerCase() !== tag.toLowerCase()) {
    return false;
  }
  for (const className of classes) {
    if (!el.classList.contains(className)) {
      return false;
    }
  }
  return true;
}

function parseSelectorList(selector: string): string[] {
  const parts = selector.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts : [selector];
}

function hasAncestorMatch(node: MockElement, ancestorSelector: string): boolean {
  let current: MockElement | MockShadowRoot | null = node.parentNode;
  while (current !== null) {
    if (current instanceof MockElement) {
      if (elementMatches(current, ancestorSelector)) {
        return true;
      }
      current = current.parentNode;
      continue;
    }
    current = current.host.parentNode;
  }
  return false;
}

function elementMatchesSelector(node: MockElement, selector: string): boolean {
  const parts = parseSelectorList(selector);
  if (parts.length === 1) {
    return elementMatches(node, parts[0]!);
  }
  const targetSelector = parts[parts.length - 1]!;
  if (!elementMatches(node, targetSelector)) {
    return false;
  }
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    if (!hasAncestorMatch(node, parts[index]!)) {
      return false;
    }
  }
  return true;
}

function querySelectorInTree(root: MockElement, selector: string): MockElement | null {
  if (elementMatchesSelector(root, selector)) {
    return root;
  }
  for (const child of root.childNodes) {
    const match = querySelectorInTree(child, selector);
    if (match !== null) {
      return match;
    }
    if (child.shadowRoot !== null) {
      const shadowMatch = child.shadowRoot.querySelector(selector);
      if (shadowMatch !== null) {
        return shadowMatch;
      }
    }
  }
  return null;
}

function querySelectorAllInTree(root: MockElement, selector: string): MockElement[] {
  const matches: MockElement[] = [];
  const visit = (node: MockElement): void => {
    if (elementMatchesSelector(node, selector)) {
      matches.push(node);
    }
    for (const child of node.childNodes) {
      visit(child);
    }
    if (node.shadowRoot !== null) {
      for (const child of node.shadowRoot.childNodes) {
        visit(child);
      }
    }
  };
  visit(root);
  return matches;
}

function createElement(tagName: string): MockElement {
  const element = new MockElement(tagName);
  if (tagName === 'button') {
    element.type = 'button';
  }
  return element;
}

export function installBrowserGlobals(): BrowserGlobalsHandle {
  const sessionData = new Map<string, string>();
  focusedElement = null;
  reducedMotion = false;
  elementById.clear();

  const documentMock = {
    body: createElement('body'),
    createElement,
    getElementById(id: string): MockElement | null {
      return elementById.get(id) ?? null;
    },
  };

  const sessionStorageMock = {
    getItem(key: string): string | null {
      return sessionData.has(key) ? sessionData.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      sessionData.set(key, value);
    },
    removeItem(key: string): void {
      sessionData.delete(key);
    },
    clear(): void {
      sessionData.clear();
    },
  };

  const windowMock = {
    document: documentMock,
    matchMedia(query: string) {
      return {
        matches: query.includes('prefers-reduced-motion') && reducedMotion,
        media: query,
      };
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    location: { href: '', hash: '' },
  };


  vi.stubGlobal('document', documentMock);
  vi.stubGlobal('window', windowMock);
  vi.stubGlobal('sessionStorage', sessionStorageMock);
  vi.stubGlobal('HTMLElement', MockElement);

  return {
    sessionData,
    setReducedMotion(value: boolean) {
      reducedMotion = value;
    },
    getFocusedElement: () => focusedElement,
    reset() {
      sessionData.clear();
      focusedElement = null;
      reducedMotion = false;
      elementById.clear();
      documentMock.body = createElement('body');
    },
  };
}

export function registerElementById(element: MockElement): void {
  if (element.id.length > 0) {
    elementById.set(element.id, element);
  }
}

export function asHtmlElement(element: MockElement): HTMLElement {
  return element as unknown as HTMLElement;
}

export function asHtmlButton(element: MockElement): HTMLButtonElement {
  return element as unknown as HTMLButtonElement;
}

export function asHtmlForm(element: MockElement): HTMLFormElement {
  return element as unknown as HTMLFormElement;
}

export function asHtmlInput(element: MockElement): HTMLInputElement {
  return element as unknown as HTMLInputElement;
}