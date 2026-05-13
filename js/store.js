export const AppState = {
    selectedBase: null,
    selectedTop: null,
    selectedTexture: null,
    selectedDecoration: null,
    trestleGap: 1.5,
    costs: {
        base: 0,
        top: 0,
        textureMultiplier: 1
    },
    
    setBase(baseId, cost) {
        this.selectedBase = baseId;
        this.costs.base = cost;
        this.notifyUpdate();
    },

    setTop(topId, cost) {
        this.selectedTop = topId;
        this.costs.top = cost;
        this.notifyUpdate();
    },

    setTexture(textureId, multiplier) {
        this.selectedTexture = textureId;
        this.costs.textureMultiplier = multiplier;
        this.notifyUpdate();
    },

    setTrestleGap(gap) {
        this.trestleGap = gap;
        this.notifyUpdate();
    },

    getTotalCost() {
        const total = (this.costs.base + this.costs.top) * this.costs.textureMultiplier;
        return total;
    },

    generatePayload() {
        return {
            customer_intent: "AR_FURNITURE_CUSTOMIZATION",
            configuration: {
                base: this.selectedBase,
                top: this.selectedTop,
                texture: this.selectedTexture,
                trestle_gap_meters: this.trestleGap
            },
            total_estimated_cost: this.getTotalCost(),
            timestamp: new Date().toISOString()
        };
    },

    listeners: [],
    
    subscribe(listener) {
        this.listeners.push(listener);
    },
    
    notifyUpdate() {
        this.listeners.forEach(listener => listener(this));
    },

    setDecoration(id) {
        this.selectedDecoration = id;
        this.notifyUpdate();
    },
};