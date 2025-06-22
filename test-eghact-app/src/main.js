import { createApp } from 'eghact';
import App from './App.js';

const app = await createApp(App, document.getElementById('root'));
app.mount();

console.log('Welcome to Eghact!');