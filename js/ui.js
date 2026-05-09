import { AppState } from './store.js';
import { API } from './api.js';

export class UIManager {
    constructor() {
        this.initButtons();
        this.initSlider();
        
        AppState.subscribe(() => this.updateUI());
    }

    initButtons() {
        const options = document.querySelectorAll('.options-row button');
        
        options.forEach(btn => {
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
                } else if (type === 'top') {
                    const cost = parseFloat(target.dataset.cost);
                    AppState.setTop(id, cost);
                } else if (type === 'texture') {
                    const multiplier = parseFloat(target.dataset.multiplier);
                    AppState.setTexture(id, multiplier);
                }
            });
        });

        const checkoutBtn = document.getElementById('btn-checkout');
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
        const total = AppState.getTotalCost();
        priceElement.innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;

        // Toggle slider visibility
        const gapControlContainer = document.getElementById('gap-control-container');
        if (AppState.selectedBase === 'trestle') {
            gapControlContainer.classList.remove('hidden');
        } else {
            gapControlContainer.classList.add('hidden');
        }
    }
}