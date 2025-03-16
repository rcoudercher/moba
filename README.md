# Neon Dreams - Three.js Cyberpunk City

A 3D cyberpunk city environment built with Three.js and React, featuring a first-person exploration experience with optimized performance.

![Neon Dreams Screenshot](screenshot.png)

## Features

- Immersive cyberpunk city environment with neon aesthetics
- First-person character controller with WASD movement and mouse look
- Optimized 3D rendering for high performance
- Dynamic lighting system with neon and ambient effects
- Animated cars and pedestrians with path-following AI
- Procedurally generated buildings with cyberpunk advertisements
- Day/night cycle with blue sky and atmospheric effects
- Modular code architecture for maintainability

## Technologies Used

- Three.js for 3D rendering
- React for UI components
- TypeScript for type safety
- HTML5 Canvas for texture generation
- CSS animations for UI effects

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/neon-dreams-three-js.git
cd neon-dreams-three-js
```

2. Install dependencies:
```bash
npm install
# or
yarn
```

3. Start the development server:
```bash
npm run dev
# or
yarn dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Controls

- **W/A/S/D**: Move forward/left/backward/right
- **Space**: Jump
- **Shift**: Sprint
- **Mouse**: Look around
- **Esc**: Toggle mouse lock/menu

## Performance Optimization

The scene is optimized for high performance through several techniques:
- Frustum culling for off-screen objects
- Level of detail (LOD) for distant objects
- Batched geometry updates
- Throttled animations
- Optimized shadow maps
- Reduced texture sizes
- Simplified geometries

## Project Structure

```
src/
├── components/
│   ├── scene/
│   │   ├── entities/       # Cars, people, etc.
│   │   ├── environment/    # Sky, streets, buildings
│   │   ├── systems/        # Animation, physics
│   │   └── CyberpunkScene.tsx
│   └── ui/                 # UI components
├── config/                 # Configuration files
├── App.tsx                 # Main application
└── main.tsx               # Entry point
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by cyberpunk aesthetics from Blade Runner, Ghost in the Shell, and Cyberpunk 2077
- Built with Three.js and React
