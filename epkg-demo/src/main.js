import { createApp } from '@eghact/runtime';
import App from './App.egh';

async function main() {
  const app = await createApp(App, document.getElementById('root'));
  app.mount();
  
  console.log('🚀 Eghact app started!');
}

main().catch(console.error);