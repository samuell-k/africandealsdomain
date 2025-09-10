
// Safe Script Loader
class ScriptLoader {
  static loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback || (() => {});
    script.onerror = (error) => {
      console.warn('Failed to load script:', src, error);
      if (callback) callback(error);
    };
    document.head.appendChild(script);
  }
  
  static loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onerror = (error) => {
      console.warn('Failed to load CSS:', href, error);
    };
    document.head.appendChild(link);
  }
  
  static safeExecute(fn) {
    try {
      if (typeof fn === 'function') {
        fn();
      }
    } catch (error) {
      console.warn('Error executing function:', error);
    }
  }
}

// Safe initialization
document.addEventListener('DOMContentLoaded', () => {
  ScriptLoader.safeExecute(() => {
    console.log('Admin page loaded successfully');
  });
});
