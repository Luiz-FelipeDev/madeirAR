import { AppState } from './store.js';
import { API } from './api.js';

export class UIManager {
    constructor() {
        this.initButtons();
        this.initSlider();
        this.initMenuToggle(); 
        
        AppState.subscribe(() => this.updateUI());
    }

    initMenuToggle() {
        const toggleBtn = document.getElementById('menu-toggle');
        const mainMenu = document.getElementById('main-menu');
        const icon = document.getElementById('toggle-icon');

        if (toggleBtn && mainMenu && icon) {
            toggleBtn.addEventListener('click', () => {
                mainMenu.classList.toggle('collapsed');
                
                if (mainMenu.classList.contains('collapsed')) {
                    icon.innerText = 'expand_less';
                } else {
                    icon.innerText = 'expand_more';
                }
            });
        }
    }

    initButtons() {
        const buttons = document.querySelectorAll('.ui-layer button[data-type]');
        
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const type = target.dataset.type;
                const id = target.dataset.id;
                
                // Remove active class from siblings
                target.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                target.classList.add('active');

                if (type === 'base') {
                    const cost = parseFloat(target.dataset.cost);
                    AppState.setBase(id, cost);
                } 
                else if (type === 'top-category') {
                    // Hide all sub-menus
                    document.querySelectorAll('.sub-options-container').forEach(el => {
                        el.classList.add('hidden');
                        // Remove active states from hidden sub-menus
                        el.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                    });
                    
                    // Show target sub-menu
                    const targetSubId = target.dataset.target;
                    const subMenu = document.getElementById(targetSubId);
                    if (subMenu) {
                        subMenu.classList.remove('hidden');
                    }
                    
                    // Reset selected top in store when changing categories
                    AppState.setTop(null, 0);
                }
                else if (type === 'top') {
                    const cost = parseFloat(target.dataset.cost);
                    AppState.setTop(id, cost);
                } 
                else if (type === 'texture') {
                    const multiplier = parseFloat(target.dataset.multiplier);
                    AppState.setTexture(id, multiplier);
                }
                else if (type === 'decoration') {
                    AppState.setDecoration(id);
                }
            });
        });

        const checkoutBtn = document.getElementById('btn-checkout');
        if(checkoutBtn) {
            checkoutBtn.addEventListener('click', async () => {
                if (!AppState.selectedBase || !AppState.selectedTop) {
                    alert('Please select at least a base and a top.');
                    return;
                }
                
                checkoutBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Sending...';
                checkoutBtn.disabled = true;
                
                try {
                    await API.sendOrder();
                    alert('Order sent successfully via WhatsApp!');
                } catch (err) {
                    alert('Error sending order. Check console.');
                } finally {
                    checkoutBtn.innerHTML = '<span class="material-symbols-outlined">send</span> Solicitar';
                    checkoutBtn.disabled = false;
                }
            });
        }
    }

    initSlider() {
        const gapSlider = document.getElementById('trestle-gap-slider');
        const gapValueDisplay = document.getElementById('gap-value-display');

        if (!gapSlider) return;

        gapSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            gapValueDisplay.innerText = `${val.toFixed(1)}m`;
            AppState.setTrestleGap(val);
        });
    }

    updateUI() {
        // Update price
        const priceElement = document.getElementById('total-price');
        if(priceElement) {
            const total = AppState.getTotalCost();
            priceElement.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
        }

        // Toggle slider visibility
        const gapControlContainer = document.getElementById('gap-control-container');
        if(gapControlContainer) {
            // Show slider for any type of trestle
            if (AppState.selectedBase && AppState.selectedBase.includes('trestle')) {
                gapControlContainer.classList.remove('hidden');
            } else {
                gapControlContainer.classList.add('hidden');
            }
        }
    }
}