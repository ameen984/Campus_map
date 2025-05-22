# Campus_MAP
3D campus map with live GPS tracking, A* pathfinding, and Supabase-powered building info using Three.js
This is a 3D interactive map for navigating through a college campus. It’s built using Three.js and uses Supabase as a backend to fetch building info. The main goal is to help users find paths between buildings, get location info, and explore the campus in a visual way.

🔧 What It Does
Shows a 3D model of the campus

Lets users select buildings and view details

Calculates and displays shortest paths between locations using A* algorithm

Tracks real-time user position using GPS

Works on mobile with gesture support (using Hammer.js)

Supports zoom, pan, and rotate (OrbitControls)

🧠 Tech Stack
Three.js – for rendering the 3D model

Supabase – used like a backend, but mainly to fetch data (no complex server-side logic)

JavaScript – core logic, controls, and interaction

HTML/CSS – basic UI

Blender – for 3D model creation (exported as .glb or .fbx)

💡 How It Works (in simple terms)
Load the 3D model (GLB/FBX) into the browser.

User location (from GPS) is converted to 3D coordinates.

When a building is selected, its data is fetched from Supabase.

The shortest path between current location and selected building is calculated using A*.

Everything (camera, graph, model) is adjusted to stay in sync
