import { mount } from 'svelte';
import '../../ui/base.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') as HTMLElement });
