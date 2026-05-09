import { AppState } from './store.js';

export const API = {
    // Replace with your actual n8n webhook URL
    webhookUrl: 'https://seu-dominio.n8n.cloud/webhook/madeireira-orcamento',

    async sendOrder() {
        const payload = AppState.generatePayload();

        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Failed to send data to webhook');
            }
            
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
};