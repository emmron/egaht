import App from './App.egh';

/**
 * Initialize the Eghact application
 * 
 * This is the entry point for your Eghact app.
 * The App component will be mounted to the #app element.
 */

const app = new App({
  target: document.getElementById('app'),
  props: {
    // You can pass initial props here
  }
});

// Hot Module Replacement (HMR) support
if (import.meta.hot) {
  import.meta.hot.accept('./App.egh', () => {
    // Re-create the app when App.egh changes
    app.$destroy();
    const NewApp = import('./App.egh');
    new NewApp.default({
      target: document.getElementById('app')
    });
  });
}

export default app;