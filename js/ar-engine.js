import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { AppState } from './store.js';

export class AREngine {
    constructor() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        
        this.reticle = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        
        this.activeGroup = new THREE.Group();
        this.scene.add(this.activeGroup);

        this.textureLoader = new THREE.TextureLoader();
        
        // Dictionaries to hold our loaded (or mocked) assets
        this.loadedModels = {};
        this.loadedTextures = {};
        this.isPlaced = false;

        this.init();
        this.loadMockAssets(); // Changed to use Mocks

        AppState.subscribe(() => this.updateAssembly());
    }

    init() {
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Add lighting so we can see the mock geometries clearly
        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        this.scene.add(light);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(2, 5, 2);
        this.scene.add(dirLight);

        document.body.appendChild(ARButton.createButton(this.renderer, { 
            requiredFeatures: ['hit-test', 'dom-overlay'],
            domOverlay: { root: document.body }
        }));

        this.setupReticle();
        
        const controller = this.renderer.xr.getController(0);
        controller.addEventListener('select', () => this.placeFurniture());
        this.scene.add(controller);

        window.addEventListener('resize', () => this.onWindowResize());
        
        this.renderer.setAnimationLoop((timestamp, frame) => this.render(timestamp, frame));
    }

    setupReticle() {
        this.reticle = new THREE.Mesh(
            new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })
        );
        this.reticle.matrixAutoUpdate = false;
        this.reticle.visible = false;
        this.scene.add(this.reticle);
    }

    // --- MOCK ASSET GENERATOR ---
    loadMockAssets() {
        // Base material for mocks
        const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });

        // 1. Trestle Mock (Cavalete: 80cm height, 60cm depth, 5cm width)
        const trestleGeom = new THREE.BoxGeometry(0.05, 0.8, 0.6);
        trestleGeom.translate(0, 0.4, 0); // Move pivot to bottom center
        this.loadedModels['trestle'] = new THREE.Mesh(trestleGeom, baseMaterial);

        // 2. Rustic Wood Mock (Tronco: 75cm height, 40cm diameter cylinder)
        const trunkGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.75, 16);
        trunkGeom.translate(0, 0.375, 0); // Move pivot to bottom center
        this.loadedModels['rustic_wood'] = new THREE.Mesh(trunkGeom, baseMaterial);

        // 3. Wall Bracket Mock (Mão Francesa: 40cm height, 40cm depth, 5cm width)
        const wallGeom = new THREE.BoxGeometry(0.05, 0.4, 0.4);
        wallGeom.translate(0, 0.2, 0.2); // Pivot at the back edge, bottom
        this.loadedModels['wall_bracket'] = new THREE.Mesh(wallGeom, baseMaterial);

        // 4. Rectangular Top Mock (Tampo Retangular: 2m width, 5cm height, 90cm depth)
        const rectGeom = new THREE.BoxGeometry(2.0, 0.05, 0.9);
        rectGeom.translate(0, 0.025, 0); // Pivot at bottom center
        this.loadedModels['rectangular'] = new THREE.Mesh(rectGeom, new THREE.MeshStandardMaterial({ color: 0xeeeeee }));

        // 5. Round Top Mock (Tampo Redondo: 1.2m diameter, 5cm height)
        const roundGeom = new THREE.CylinderGeometry(0.6, 0.6, 0.05, 32);
        roundGeom.translate(0, 0.025, 0); // Pivot at bottom center
        this.loadedModels['round'] = new THREE.Mesh(roundGeom, new THREE.MeshStandardMaterial({ color: 0xeeeeee }));

        // 6. Mock Textures (Create basic colored textures programmatically)
        this.loadedTextures['pinus'] = this.createColorTexture('#f8e5c0');
        this.loadedTextures['oak'] = this.createColorTexture('#8b5a2b');
        this.loadedTextures['mdf'] = this.createColorTexture('#ffffff');

        // Trigger assembly once mocks are created
        this.updateAssembly();
    }

    createColorTexture(colorHex) {
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 2;
        const context = canvas.getContext('2d');
        context.fillStyle = colorHex;
        context.fillRect(0, 0, 2, 2);
        return new THREE.CanvasTexture(canvas);
    }
    // ----------------------------

    updateAssembly() {
        this.activeGroup.clear();

        const baseId = AppState.selectedBase;
        const topId = AppState.selectedTop;
        const textureId = AppState.selectedTexture;

        let baseHeight = 0; 

        // 1. Build Base
        if (baseId && this.loadedModels[baseId]) {
            if (baseId === 'trestle') {
                const trestleLeft = this.loadedModels[baseId].clone();
                const trestleRight = this.loadedModels[baseId].clone();
                
                const halfGap = AppState.trestleGap / 2;
                trestleLeft.position.set(-halfGap, 0, 0);
                trestleRight.position.set(halfGap, 0, 0);
                
                this.activeGroup.add(trestleLeft);
                this.activeGroup.add(trestleRight);

                baseHeight = 0.8; // Hardcoded mock height for trestle
            } else if (baseId === 'rustic_wood') {
                const baseModel = this.loadedModels[baseId].clone();
                this.activeGroup.add(baseModel);
                baseHeight = 0.75; // Hardcoded mock height for trunk
            } else if (baseId === 'wall_bracket') {
                const baseModel = this.loadedModels[baseId].clone();
                this.activeGroup.add(baseModel);
                baseHeight = 0.4;
            }
        }

        // 2. Build Top
        if (topId && this.loadedModels[topId]) {
            const topModel = this.loadedModels[topId].clone();
            
            // Elevate the top to rest on the base
            topModel.position.set(0, baseHeight, 0);

            // Apply mock texture if selected
            if (textureId && this.loadedTextures[textureId]) {
                const selectedTex = this.loadedTextures[textureId];
                topModel.material = topModel.material.clone();
                topModel.material.map = selectedTex;
                topModel.material.color.setHex(0xffffff); // Clear base color so texture shows
                topModel.material.needsUpdate = true;
            }

            this.activeGroup.add(topModel);
        }

        if (!this.isPlaced) {
            this.activeGroup.position.set(0, 0, 0);
        }
    }

    placeFurniture() {
        if (this.reticle.visible && AppState.selectedBase && !this.isPlaced) {
            this.activeGroup.position.setFromMatrixPosition(this.reticle.matrix);
            this.activeGroup.quaternion.setFromRotationMatrix(this.reticle.matrix);
            
            this.isPlaced = true;
            this.reticle.visible = false;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render(timestamp, frame) {
        if (frame) {
            const referenceSpace = this.renderer.xr.getReferenceSpace();
            const session = this.renderer.xr.getSession();

            if (!this.hitTestSourceRequested) {
                session.requestReferenceSpace('viewer').then((refSpace) => {
                    session.requestHitTestSource({ space: refSpace }).then((source) => {
                        this.hitTestSource = source;
                    });
                });
                session.addEventListener('end', () => {
                    this.hitTestSourceRequested = false;
                    this.hitTestSource = null;
                    this.isPlaced = false; 
                });
                this.hitTestSourceRequested = true;
            }

            if (this.hitTestSource && !this.isPlaced) {
                const hitTestResults = frame.getHitTestResults(this.hitTestSource);
                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    this.reticle.visible = true;
                    this.reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                    
                    this.activeGroup.position.setFromMatrixPosition(this.reticle.matrix);
                    this.activeGroup.quaternion.setFromRotationMatrix(this.reticle.matrix);
                } else {
                    this.reticle.visible = false;
                    this.activeGroup.position.set(0, -1000, 0); 
                }
            }
        }
        this.renderer.render(this.scene, this.camera);
    }
}