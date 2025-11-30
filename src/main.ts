import * as THREE from "three";
import * as OBC from "@thatopen/components";

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
}

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
