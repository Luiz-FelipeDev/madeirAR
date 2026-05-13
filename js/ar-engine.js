import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
        
        // Group for the main customizable furniture
        this.activeGroup = new THREE.Group();
        this.activeGroup.visible = false;
        this.scene.add(this.activeGroup);

        // Group for placed decorations
        this.decorationsGroup = new THREE.Group();
        this.scene.add(this.decorationsGroup);

        // Raycaster for virtual object intersection
        this.raycaster = new THREE.Raycaster();
        this.screenCenter = new THREE.Vector2(0, 0);

        this.loader = new GLTFLoader();
        this.textureLoader = new THREE.TextureLoader();
        
        this.loadedModels = {};
        this.loadedTextures = {};
        this.isPlaced = false;
        this.placementMode = 'furniture'; // 'furniture' or 'decoration'

        this.init();
        this.loadAssets();

        AppState.subscribe(() => this.onStateUpdate());
    }

    onStateUpdate() {
        if (AppState.selectedDecoration) {
            this.placementMode = 'decoration';
        } else {
            this.placementMode = 'furniture';
            this.updateAssembly();
        }
    }

    init() {
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.xr.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 2);
        light.position.set(0.5, 1, 0.25);
        this.scene.add(light);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(2, 5, 2);
        this.scene.add(dirLight);

        document.body.appendChild(ARButton.createButton(this.renderer, { 
            requiredFeatures: ['hit-test', 'dom-overlay'],
            domOverlay: { root: document.getElementById('ar-overlay') }
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

    loadAssets() {
        const modelsToLoad = [
            // Bases
            { id: 'trestle_adjustable', url: 'assets/bases/trestle_adjustable.glb' },
            { id: 'ester_table_leg.glb', url: 'assets/bases/ester_table_leg.glb' },
            
            // Rectangular Tops
            { id: 'rectangular_standard', url: 'assets/tops/rectangular_standard.glb' },
            { id: 'rectangular_rounded', url: 'assets/tops/rectangular_rounded.glb' },
            { id: 'rectangular_organic', url: 'assets/tops/rectangular_organic.glb' },
            
            // Round Tops
            { id: 'round_standard', url: 'assets/tops/round_standard.glb' },
            { id: 'round_bevel', url: 'assets/tops/round_bevel.glb' },

            // Decorations
            { id: '2_ducks_wood', url: 'assets/decorations/2_ducks_wood.glb' },
            { id: 'santa_painted_wooden_statue', url: 'assets/decorations/santa_painted_wooden_statue.glb' },
            { id: 'christmas_decoration_small_table_tree', url: 'assets/decorations/christmas_decoration_small_table_tree.glb' }
        ];

        modelsToLoad.forEach(item => {
            this.loader.load(
                item.url, 
                (gltf) => {
                    this.loadedModels[item.id] = gltf.scene;
                    if (this.placementMode === 'furniture') this.updateAssembly(); 
                }, 
                undefined, 
                (err) => console.warn(`Failed to load ${item.id}`, err)
            );
        });

        const texturesToLoad = [
            { id: 'pinus', url: 'assets/textures/pinus.jpg' },
            { id: 'oak', url: 'assets/textures/oak.jpg' },
            { id: 'mdf', url: 'assets/textures/mdf.jpg' },
            { id: 'mahogany', url: 'assets/textures/mahogany.jpg' },
            { id: 'walnut', url: 'assets/textures/walnut.jpg' }
        ];

        texturesToLoad.forEach(item => {
            this.textureLoader.load(item.url, (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.colorSpace = THREE.SRGBColorSpace;
                this.loadedTextures[item.id] = tex;
                this.updateAssembly();
            });
        });
    }

    updateAssembly() {
        if (this.placementMode !== 'furniture') return;

        this.activeGroup.clear();

        const baseId = AppState.selectedBase;
        const topId = AppState.selectedTop;
        const textureId = AppState.selectedTexture;

        let baseHeight = 0; 

        // 1. Build Base

        /*
        * There are two types of bases:
        * 1. Single base (Rustic wood, triple leg, quad leg)
        * 2. Mirrored trestle (Cavalete Ajustável)
        */

        if (baseId && this.loadedModels[baseId]) {
            // Mirror trestle
            if (baseId.includes('trestle')) {
                const trestleLeft = this.loadedModels[baseId].clone();
                const trestleRight = this.loadedModels[baseId].clone();

                trestleLeft.rotation.y = Math.PI / 2;
                trestleRight.rotation.y = Math.PI / 2;
                
                const halfGap = AppState.trestleGap / 2;
                
                // Position and mirror the pair
                trestleLeft.position.set(-halfGap, 0, 0);
                trestleRight.position.set(halfGap, 0, 0);
                
                // Mirror the right trestle on X axis to make it a perfect reflected pair
                trestleRight.scale.x = -1;
                
                this.activeGroup.add(trestleLeft);
                this.activeGroup.add(trestleRight);

                baseHeight = this.calculateModelHeight(trestleLeft);
            } else {
                // Single base logic (Rustic wood, triple leg, quad leg)
                const baseModel = this.loadedModels[baseId].clone();
                this.activeGroup.add(baseModel);
                baseHeight = this.calculateModelHeight(baseModel);
            }
        }   

        // 2. Build Top
        if (topId && this.loadedModels[topId]) {
            const topModel = this.loadedModels[topId].clone();
            
            topModel.position.set(0, baseHeight, 0);
            
            // Temporary fix for giant tops - Remove when 3D models are fixed
            // topModel.scale.set(0.01, 0.01, 0.01);

            if (textureId && this.loadedTextures[textureId]) {
                const selectedTex = this.loadedTextures[textureId];
                topModel.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material = child.material.clone();
                        child.material.map = selectedTex;
                        child.material.needsUpdate = true;
                    }
                });
            }

            this.activeGroup.add(topModel);
        }

        if (!this.isPlaced) {
            this.activeGroup.position.set(0, 0, 0);
        }
    }

    calculateModelHeight(model) {
        const box = new THREE.Box3().setFromObject(model);
        return box.max.y - box.min.y;
    }

    placeFurniture() {
        if (!this.reticle.visible) return;

        if (this.placementMode === 'furniture' && AppState.selectedBase && !this.isPlaced) {
            // Place main furniture
            this.activeGroup.position.setFromMatrixPosition(this.reticle.matrix);
            this.activeGroup.quaternion.setFromRotationMatrix(this.reticle.matrix);
            this.isPlaced = true;
            this.reticle.visible = false;
        } 
        else if (this.placementMode === 'decoration' && AppState.selectedDecoration) {
            // Place a decoration instance
            this.placeDecoration();
        }
    }

    placeDecoration() {
        const decId = AppState.selectedDecoration;
        if (this.loadedModels[decId]) {
            const decModel = this.loadedModels[decId].clone();
            
            // Attach to the exact transform of the reticle at this moment
            decModel.position.setFromMatrixPosition(this.reticle.matrix);
            decModel.quaternion.setFromRotationMatrix(this.reticle.matrix);
            
            this.decorationsGroup.add(decModel);
            
            // Reset state so user has to click the button again to place another
            AppState.setDecoration(null);
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
                    this.activeGroup.visible = false;
                    this.decorationsGroup.clear(); // Clear decos on exit
                });
                this.hitTestSourceRequested = true;
            }

            let virtualHitValid = false;

            // Check Virtual Raycast first (only if furniture is placed and we are placing a decoration)
            if (this.isPlaced && this.placementMode === 'decoration') {
                this.raycaster.setFromCamera(this.screenCenter, this.camera);
                
                // Intersect with placed furniture AND already placed decorations
                const objectsToTest = [...this.activeGroup.children, ...this.decorationsGroup.children];
                const intersects = this.raycaster.intersectObjects(objectsToTest, true);

                if (intersects.length > 0) {
                    const hit = intersects[0];
                    
                    // Create a matrix from the virtual hit normal and position
                    const position = hit.point;
                    const normal = hit.face.normal.clone();
                    
                    // Transform normal to world space
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                    normal.applyMatrix3(normalMatrix).normalize();

                    // Align reticle to the normal (makes it lay flat on walls/tables)
                    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
                    
                    this.reticle.position.copy(position);
                    this.reticle.quaternion.copy(quaternion);
                    this.reticle.updateMatrix();
                    
                    this.reticle.visible = true;
                    virtualHitValid = true;
                }
            }

            // Check Physical WebXR Hit Test (if virtual raycast missed)
            if (this.hitTestSource && !virtualHitValid) {
                const hitTestResults = frame.getHitTestResults(this.hitTestSource);
                
                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(referenceSpace);
                    
                    this.reticle.matrix.fromArray(pose.transform.matrix);
                    this.reticle.position.setFromMatrixPosition(this.reticle.matrix);
                    this.reticle.quaternion.setFromRotationMatrix(this.reticle.matrix);
                    
                    // Show reticle logic
                    if (this.placementMode === 'furniture' && AppState.selectedBase && !this.isPlaced) {
                        this.reticle.visible = true;
                        this.activeGroup.visible = true;
                        this.activeGroup.position.copy(this.reticle.position);
                        this.activeGroup.quaternion.copy(this.reticle.quaternion);
                    } 
                    else if (this.placementMode === 'decoration') {
                        this.reticle.visible = true;
                    } 
                    else {
                        this.reticle.visible = false;
                    }
                } else {
                    this.reticle.visible = false;
                }
            }
        }
        this.renderer.render(this.scene, this.camera);
    }
}