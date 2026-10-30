// Some dependencies expect Node's `global`. Loaded as a file rather than an
// inline script so the CSP does not need 'unsafe-inline' for scripts.
if (typeof global === 'undefined') {
  var global = window;
}
