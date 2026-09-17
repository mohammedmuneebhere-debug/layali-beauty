/**
 * Lock the document scrollport (`html`), not `body`.
 * Body overflow:hidden does nothing once html is the only overflow-y:scroll box.
 */
let lockCount = 0;

export function lockDocumentScroll(): () => void {
  lockCount += 1;
  document.documentElement.classList.add('scroll-locked');
  return () => {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.documentElement.classList.remove('scroll-locked');
    }
  };
}
