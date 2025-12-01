import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as WEBIFC from "web-ifc";
import * as OBF from "@thatopen/components-front";

// Sidecar WebIFC for property retrieval
const sidecarWebIfc = new WEBIFC.IfcAPI();
sidecarWebIfc.SetWasmPath("https://unpkg.com/web-ifc@0.0.72/", true);

let sidecarModelID = 0;

// On-screen logger
const logContainer = document.getElementById("logs")!;
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    originalLog(...args);
    const formattedArgs = args.map(a => {
        if (typeof a === 'object') {
            try {
                return JSON.stringify(a);
            } catch (e) {
                return "[Complex Object]";
            }
        }
        return a;
    });
    logContainer.textContent += formattedArgs.join(' ') + '\n';
    logContainer.scrollTop = logContainer.scrollHeight;
};

console.error = (...args) => {
    originalError(...args);
    const formattedArgs = args.map(a => {
        if (a instanceof Error) {
            return a.message + (a.stack ? `\n${a.stack} ` : '');
        }
        if (typeof a === 'object') {
            try {
                return JSON.stringify(a);
            } catch (e) {
                return "[Complex Object]";
            }
        }
        return a;
    });
    logContainer.textContent += "ERROR: " + formattedArgs.join(' ') + '\n';
    logContainer.scrollTop = logContainer.scrollHeight;
};

const container = document.getElementById("container")!;

const components = new OBC.Components();

const worlds = components.get(OBC.Worlds);

const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

components.init();

world.scene.setup();

// Add grid
const grids = components.get(OBC.Grids);
grids.create(world);

world.scene.three.background = null;

const fragments = components.get(OBC.FragmentsManager);
const ifcLoader = components.get(OBC.IfcLoader);
const highlighter = components.get(OBF.Highlighter);

highlighter.setup({ world });
highlighter.zoomToSelection = true;

await ifcLoader.setup({
    wasm: {
        path: "https://unpkg.com/web-ifc@0.0.72/",
        absolute: true,
    },
    autoSetWasm: false,
});

fragments.init("/fragments-worker.mjs");

// Set up fragments manager events
fragments.list.onItemSet.add(({ value: model }) => {
    console.log("FragmentsManager: Model added to list");
    if (world.camera.three instanceof THREE.PerspectiveCamera) {
        model.useCamera(world.camera.three);
    }
    world.scene.three.add(model.object);
    fragments.core.update(true);
});

// Update fragments when camera moves
if (world.camera.controls) {
    world.camera.controls.addEventListener("rest", () => {
        fragments.core.update(true);
    });

    world.camera.controls.addEventListener("control", () => {
        // highlighter.update(); // Removed as it doesn't exist on type
    });
}

const propertiesPanel = document.getElementById("properties-panel")!;
const propertiesContent = document.getElementById("properties-content")!;

highlighter.events.select.onHighlight.add(async (fragmentIdMap) => {
    console.log("Selected fragment ID map:", fragmentIdMap);

    propertiesContent.innerHTML = "";
    propertiesPanel.style.display = "none";

    for (const fragmentId in fragmentIdMap) {
        const expressIds = fragmentIdMap[fragmentId];
        const model = fragments.list.get(fragmentId);
        if (!model) continue;

        for (const expressId of expressIds) {
            propertiesPanel.style.display = "block";

            const title = document.createElement("h4");
            title.textContent = `ID: ${expressId}`;
            propertiesContent.appendChild(title);

            try {
                // Debugging: Inspect model structure
                console.log("Model keys:", Object.keys(model));
                if ((model as any).properties) {
                    console.log("Model has properties object");
                }
                if (typeof (model as any).getLocalProperties === 'function') {
                    console.log("Model has getLocalProperties method");
                }

                let props: any = null;

                // Method 1: Try sidecar WebIFC (Most reliable)
                try {
                    console.log(`Trying sidecar WebIFC.GetLine for model ${sidecarModelID}, expressID ${expressId}...`);
                    props = sidecarWebIfc.GetLine(sidecarModelID, expressId);
                } catch (e) {
                    console.error("Sidecar WebIFC failed:", e);
                }

                // Method 2: Try getItemAttributes (fallback)
                if (!props && typeof (model as any).getItemAttributes === 'function') {
                    console.log("Trying model.getItemAttributes...");
                    props = await (model as any).getItemAttributes(expressId);
                }

                // Method 3: Try model.properties (direct access or via method)
                if (!props && (model as any).properties) {
                    console.log("Inspecting model.properties:", (model as any).properties);
                    if (typeof (model as any).properties.getItemProperties === 'function') {
                        console.log("Trying model.properties.getItemProperties...");
                        props = await (model as any).properties.getItemProperties(expressId);
                    } else if ((model as any).properties[expressId]) {
                        console.log("Trying model.properties[expressId]...");
                        props = (model as any).properties[expressId];
                    }
                }

                // Method 4: Try getLocalProperties (standard for Fragments, but might be minimal)
                if (!props && typeof (model as any).getLocalProperties === 'function') {
                    console.log("Trying model.getLocalProperties...");
                    props = await (model as any).getLocalProperties(expressId);
                }

                // Method 5: Fallback to webIfc
                if (!props) {
                    const webIfc = (ifcLoader as any).webIfc;
                    if (webIfc && webIfc.wasmModule) {
                        console.log("Trying webIfc.GetLine...");
                        const modelId = (model as any).modelID !== undefined ? (model as any).modelID : 0;
                        props = webIfc.GetLine(modelId, expressId);
                    }
                }

                console.log("Retrieved properties:", props);

                if (props) {
                    const list = document.createElement("ul");
                    list.style.paddingLeft = "20px";

                    for (const key in props) {
                        const val = props[key];
                        if (val === null || val === undefined) continue;

                        let displayVal = val;
                        if (typeof val === 'object' && val.value !== undefined) {
                            displayVal = val.value;
                        } else if (typeof val === 'object') {
                            // Skip complex objects for now to avoid clutter
                            continue;
                        }

                        const item = document.createElement("li");
                        item.textContent = `${key}: ${displayVal}`;
                        list.appendChild(item);
                    }
                    propertiesContent.appendChild(list);
                } else {
                    const p = document.createElement("p");
                    p.textContent = "No properties found for this element.";
                    propertiesContent.appendChild(p);
                }
            } catch (e) {
                console.error("Error getting properties:", e);
            }
        }
    }
});

highlighter.events.select.onClear.add(() => {
    propertiesPanel.style.display = "none";
    propertiesContent.innerHTML = "";
});

const loadBtn = document.getElementById("load-btn")!;
const fileInput = document.getElementById("file-input") as HTMLInputElement;

loadBtn.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    console.log("File selected:", file.name);

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    console.log("Loading model...");
    try {
        // Initialize sidecar WebIFC
        await sidecarWebIfc.Init();
        sidecarModelID = sidecarWebIfc.OpenModel(data);
        console.log("Sidecar WebIFC model opened with ID:", sidecarModelID);

        const model = await ifcLoader.load(data, true, file.name);
        console.log("Model loaded successfully");

        // Manual update to ensure everything is ready
        fragments.core.update(true);

        // Get bounding box from the model directly (it's usually pre-calculated)
        // The type definition might be missing it, so we cast to any
        let bbox = (model as any).boundingBox as THREE.Box3;

        // If not available, try to calculate it from the object
        if (!bbox || bbox.isEmpty()) {
            console.log("Model boundingBox empty or missing, calculating from object...");
            model.object.updateMatrixWorld(true);
            bbox = new THREE.Box3().setFromObject(model.object);
        }

        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        console.log("Bounding box calculated:", { center, size, maxDim });

        if (maxDim === 0) {
            console.error("Error: Bounding box is still empty. Please check if the IFC file contains 3D geometry.");
            return;
        }

        // Simple fit to view logic
        if (world.camera.three instanceof THREE.PerspectiveCamera) {
            const fov = world.camera.three.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / 2 * Math.tan(fov * 2));
            cameraZ *= 1.5; // Zoom out a bit

            console.log("Setting camera position:", { x: center.x, y: center.y + maxDim, z: center.z + cameraZ });
            world.camera.three.position.set(center.x, center.y + maxDim, center.z + cameraZ);
            world.camera.three.lookAt(center);

            // Update controls target if available
            if (world.camera.controls) {
                world.camera.controls.setLookAt(
                    world.camera.three.position.x,
                    world.camera.three.position.y,
                    world.camera.three.position.z,
                    center.x,
                    center.y,
                    center.z,
                    true
                );
            }
        }
    } catch (error) {
        console.error("Error loading model:", error);
    }
});
