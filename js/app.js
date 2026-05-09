import { UIManager } from './ui.js';
import { AREngine } from './ar-engine.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI logic
    const ui = new UIManager();
    
    // Initialize AR and 3D logic
    const engine = new AREngine();
});