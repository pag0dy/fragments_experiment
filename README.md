# IFC Model Viewer

A web-based IFC model viewer built with [That Open Company](https://thatopen.com/) libraries.

## Features

- **IFC Loading**: Load local `.ifc` files directly in the browser.
- **3D Navigation**: Zoom, pan, and rotate around your models.
- **Auto-Focus**: Automatically centers and zooms on the loaded model.
- **Performance**: Optimized for handling BIM models using fragment technology.
- **Debugging**: On-screen logger to track loading status and errors.

## Technologies Used

- **[@thatopen/components](https://www.npmjs.com/package/@thatopen/components)**: Core library for BIM applications.
- **[@thatopen/fragments](https://www.npmjs.com/package/@thatopen/fragments)**: Efficient geometry handling.
- **[web-ifc](https://github.com/thatopen/web-ifc)**: IFC parsing and processing (WASM).
- **[Three.js](https://threejs.org/)**: 3D rendering engine.
- **[Vite](https://vitejs.dev/)**: Build tool and development server.
- **TypeScript**: Type-safe development.

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run development server**:
    ```bash
    npm run dev
    ```

3.  **Build for production**:
    ```bash
    npm run build
    ```

4.  **Preview production build**:
    ```bash
    npm run preview
    ```

## Usage

1.  Click the "Load IFC" button.
2.  Select an `.ifc` file from your computer.
3.  The model will load and appear in the scene.
4.  Use your mouse to navigate:
    - **Left Click + Drag**: Rotate
    - **Right Click + Drag**: Pan
    - **Scroll**: Zoom
