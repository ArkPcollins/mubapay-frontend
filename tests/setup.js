import '@testing-library/jest-dom/vitest';

// jsdom does not implement <dialog>; provide the minimal behaviour our Dialog uses.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); };
}
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
}
if (!window.scrollTo) window.scrollTo = () => {};
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function scrollIntoView() {};
