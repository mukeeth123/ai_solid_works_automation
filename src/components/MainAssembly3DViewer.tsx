// ============================================================
// VOLM Engineering Intelligence — Main Assembly 3D CAD Viewport
// Coordinates all 10 equipment assemblies in authentic 3D space
// With interactive component picking, exploded view, and CAD shaders
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  RotateCcw, Eye, Compass, Box, Layers, Maximize2, Sliders, CheckCircle,
  AlertTriangle, Info, ZoomIn, ZoomOut, Move3d
} from 'lucide-react';
import type { MainAssemblyItem } from '../types/engineering';
import { cn } from './shared';

interface MainAssembly3DViewerProps {
  items: MainAssemblyItem[];
  selectedItemId?: string;
  onSelectItem: (id: string) => void;
  isPumpModified?: boolean;  // DN125 vs DN100
  isSkidModified?: boolean;  // 1450 vs 1200 mm
}

export function MainAssembly3DViewer({
  items,
  selectedItemId,
  onSelectItem,
  isPumpModified = true,
  isSkidModified = true,
}: MainAssembly3DViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const componentMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const [displayStyle, setDisplayStyle] = useState<'shadedEdges' | 'shaded' | 'wireframe'>('shadedEdges');
  const [cameraView, setCameraView] = useState<'iso' | 'front' | 'top' | 'right'>('iso');
  const [explodeFactor, setExplodeFactor] = useState<number>(0); // 0 to 1
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [showAxes, setShowAxes] = useState(true);

  // 1 mm in model space = 0.005 Three.js units (scaled for comfortable viewport)
  const S = 0.005;

  // Setup Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 700;
    const height = container.clientHeight || 520;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(7.5, 5.0, 8.5);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and shadow maps
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxDistance = 25;
    controls.minDistance = 2.0;
    controls.target.set(0, 1.2, 0);
    controlsRef.current = controls;

    // 5. Lighting (Authentic CAD Studio Lighting: Key, Fill, Rim, Ambient)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
    keyLight.position.set(10, 15, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xddeeff, 0.6);
    fillLight.position.set(-12, 8, -10);
    scene.add(fillLight);

    const bottomReflect = new THREE.DirectionalLight(0x778899, 0.35);
    bottomReflect.position.set(0, -10, 0);
    scene.add(bottomReflect);

    // 6. Ground Workstation Shadow Plane & Grid
    const grid = new THREE.GridHelper(16, 32, 0x3d4a58, 0x242d38);
    grid.position.y = -0.01;
    scene.add(grid);

    const shadowPlaneGeo = new THREE.PlaneGeometry(16, 16);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.28 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.012;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Coordinate Triad
    const axesHelper = new THREE.AxesHelper(1.8);
    axesHelper.position.set(-3.5, 0.01, -2.5);
    scene.add(axesHelper);

    // 7. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Build / Rebuild Assembly Meshes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clean previous components
    componentMeshesRef.current.forEach(group => {
      scene.remove(group);
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    });
    componentMeshesRef.current.clear();

    const isWireframe = displayStyle === 'wireframe';

    // Materials
    const steelChannelMat = new THREE.MeshStandardMaterial({
      color: 0x3A4450,
      metalness: 0.82,
      roughness: 0.28,
      wireframe: isWireframe,
    });

    const pumpCasingMat = new THREE.MeshStandardMaterial({
      color: isPumpModified ? 0x2A72A4 : 0x566573, // Distinct blue if modified to DN125, grey if standard
      metalness: 0.65,
      roughness: 0.35,
      wireframe: isWireframe,
    });

    const motorMat = new THREE.MeshStandardMaterial({
      color: 0x1E4620, // ABB Forest Green
      metalness: 0.55,
      roughness: 0.45,
      wireframe: isWireframe,
    });

    const couplingMat = new THREE.MeshStandardMaterial({
      color: 0xD35400, // Safety Orange
      metalness: 0.45,
      roughness: 0.35,
      wireframe: isWireframe,
    });

    const valveMat = new THREE.MeshStandardMaterial({
      color: 0x2C3E50,
      metalness: 0.75,
      roughness: 0.3,
      wireframe: isWireframe,
    });

    const spoolPipingMat = new THREE.MeshStandardMaterial({
      color: 0xA6B4C2, // 316L Stainless Steel sheen
      metalness: 0.88,
      roughness: 0.18,
      wireframe: isWireframe,
    });

    const reservoirMat = new THREE.MeshStandardMaterial({
      color: 0x7F8C8D,
      metalness: 0.85,
      roughness: 0.22,
      wireframe: isWireframe,
    });

    const enclosureMat = new THREE.MeshStandardMaterial({
      color: 0x8FA4B5,
      metalness: 0.9,
      roughness: 0.15,
      wireframe: isWireframe,
    });

    // Helper: Add black edge lines for authentic CAD workstation Shaded with Edges
    const addEdges = (mesh: THREE.Mesh, group: THREE.Group) => {
      if (displayStyle === 'shadedEdges') {
        const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 28);
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x11161B, linewidth: 1 });
        const line = new THREE.LineSegments(edgeGeo, edgeMat);
        mesh.add(line);
      }
    };

    // -------------------------------------------------------------
    // BUILD EACH OF THE 10 EQUIPMENT ASSEMBLIES
    // -------------------------------------------------------------

    items.forEach(item => {
      const group = new THREE.Group();
      group.name = item.id;
      group.userData = { itemId: item.id, partNumber: item.partNumber };

      // Base translation in meters
      const baseX = item.position.x * S;
      const baseY = item.position.y * S;
      const baseZ = item.position.z * S;

      // Apply exploded view offset based on assembly axis
      let explodeX = 0;
      let explodeY = 0;
      let explodeZ = 0;

      if (explodeFactor > 0) {
        if (item.partNumber.includes('VLV-SUC') || item.partNumber.includes('SPL-SUC')) {
          explodeX = explodeFactor * 2.2;
        } else if (item.partNumber.includes('MOT')) {
          explodeX = -explodeFactor * 2.0;
        } else if (item.partNumber.includes('CPL')) {
          explodeY = explodeFactor * 1.0;
        } else if (item.partNumber.includes('VLV-DIS') || item.partNumber.includes('SPL-DIS')) {
          explodeY = explodeFactor * 2.2;
        } else if (item.partNumber.includes('BFR-53A')) {
          explodeZ = explodeFactor * 1.8;
        } else if (item.partNumber.includes('ENC-IP66')) {
          explodeZ = explodeFactor * 1.8;
        }
      }

      group.position.set(baseX + explodeX, baseY + explodeY, baseZ + explodeZ);

      // 1. Skid Base Frame
      if (item.assemblyRefId === 'asm-004') {
        const frameLength = isSkidModified ? 1450 * S : 1200 * S;
        const frameWidth = 680 * S;
        const beamH = 160 * S;
        const beamW = 65 * S;

        // Longitudinal Channels
        const c1 = new THREE.Mesh(new THREE.BoxGeometry(frameLength, beamH, beamW), steelChannelMat);
        c1.position.set(0, beamH / 2, -frameWidth / 2 + beamW / 2);
        c1.castShadow = true;
        c1.receiveShadow = true;
        addEdges(c1, group);
        group.add(c1);

        const c2 = new THREE.Mesh(new THREE.BoxGeometry(frameLength, beamH, beamW), steelChannelMat);
        c2.position.set(0, beamH / 2, frameWidth / 2 - beamW / 2);
        c2.castShadow = true;
        c2.receiveShadow = true;
        addEdges(c2, group);
        group.add(c2);

        // Cross members
        const crossCount = isSkidModified ? 6 : 4;
        const step = frameLength / (crossCount - 1);
        for (let i = 0; i < crossCount; i++) {
          const cross = new THREE.Mesh(new THREE.BoxGeometry(beamW, beamH * 0.9, frameWidth - beamW * 2), steelChannelMat);
          cross.position.set(-frameLength / 2 + i * step, beamH / 2, 0);
          cross.castShadow = true;
          addEdges(cross, group);
          group.add(cross);
        }

        // Pump & Motor mounting pads
        const pumpPad = new THREE.Mesh(new THREE.BoxGeometry(320 * S, 20 * S, 400 * S), steelChannelMat);
        pumpPad.position.set(380 * S, beamH + 10 * S, 0);
        addEdges(pumpPad, group);
        group.add(pumpPad);

        const motorPad = new THREE.Mesh(new THREE.BoxGeometry(450 * S, 20 * S, 400 * S), steelChannelMat);
        motorPad.position.set(-380 * S, beamH + 10 * S, 0);
        addEdges(motorPad, group);
        group.add(motorPad);
      }

      // 2. Pump Unit
      else if (item.assemblyRefId === 'asm-001') {
        const inletRadius = isPumpModified ? (125 / 2) * S : (100 / 2) * S;
        const flangeRadius = isPumpModified ? (250 / 2) * S : (220 / 2) * S;

        // Volute spiral housing
        const volute = new THREE.Mesh(new THREE.CylinderGeometry(200 * S, 240 * S, 180 * S, 32), pumpCasingMat);
        volute.rotation.z = Math.PI / 2;
        volute.position.set(0, 160 * S, 0);
        volute.castShadow = true;
        addEdges(volute, group);
        group.add(volute);

        // Suction nozzle (facing positive X towards suction valve)
        const suctionNozzle = new THREE.Mesh(new THREE.CylinderGeometry(inletRadius, inletRadius, 140 * S, 24), pumpCasingMat);
        suctionNozzle.rotation.z = Math.PI / 2;
        suctionNozzle.position.set(160 * S, 160 * S, 0);
        suctionNozzle.castShadow = true;
        addEdges(suctionNozzle, group);
        group.add(suctionNozzle);

        // Suction Flange
        const suctionFlange = new THREE.Mesh(new THREE.CylinderGeometry(flangeRadius, flangeRadius, 22 * S, 24), pumpCasingMat);
        suctionFlange.rotation.z = Math.PI / 2;
        suctionFlange.position.set(230 * S, 160 * S, 0);
        suctionFlange.castShadow = true;
        addEdges(suctionFlange, group);
        group.add(suctionFlange);

        // Discharge nozzle (facing upwards positive Y)
        const dischargeNozzle = new THREE.Mesh(new THREE.CylinderGeometry(50 * S, 50 * S, 140 * S, 24), pumpCasingMat);
        dischargeNozzle.position.set(0, 310 * S, 0);
        dischargeNozzle.castShadow = true;
        addEdges(dischargeNozzle, group);
        group.add(dischargeNozzle);

        // Discharge Flange
        const dischargeFlange = new THREE.Mesh(new THREE.CylinderGeometry(110 * S, 110 * S, 20 * S, 24), pumpCasingMat);
        dischargeFlange.position.set(0, 380 * S, 0);
        dischargeFlange.castShadow = true;
        addEdges(dischargeFlange, group);
        group.add(dischargeFlange);

        // Bearing Bracket & shaft extension towards motor
        const bearingBracket = new THREE.Mesh(new THREE.BoxGeometry(220 * S, 140 * S, 160 * S), steelChannelMat);
        bearingBracket.position.set(-180 * S, 120 * S, 0);
        bearingBracket.castShadow = true;
        addEdges(bearingBracket, group);
        group.add(bearingBracket);

        const pumpShaft = new THREE.Mesh(new THREE.CylinderGeometry(14 * S, 14 * S, 180 * S, 16), steelChannelMat);
        pumpShaft.rotation.z = Math.PI / 2;
        pumpShaft.position.set(-290 * S, 160 * S, 0);
        group.add(pumpShaft);
      }

      // 3. Electric Drive Motor
      else if (item.assemblyRefId === 'asm-002') {
        // Motor stator body
        const stator = new THREE.Mesh(new THREE.CylinderGeometry(180 * S, 180 * S, 440 * S, 32), motorMat);
        stator.rotation.z = Math.PI / 2;
        stator.position.set(0, 160 * S, 0);
        stator.castShadow = true;
        addEdges(stator, group);
        group.add(stator);

        // Motor Terminal Box on top
        const termBox = new THREE.Mesh(new THREE.BoxGeometry(160 * S, 90 * S, 160 * S), motorMat);
        termBox.position.set(60 * S, 360 * S, 0);
        addEdges(termBox, group);
        group.add(termBox);

        // Motor mounting foot feet
        const motorFeet = new THREE.Mesh(new THREE.BoxGeometry(380 * S, 40 * S, 340 * S), steelChannelMat);
        motorFeet.position.set(0, 20 * S, 0);
        addEdges(motorFeet, group);
        group.add(motorFeet);

        // Motor drive shaft towards coupling
        const motorShaft = new THREE.Mesh(new THREE.CylinderGeometry(21 * S, 21 * S, 160 * S, 16), steelChannelMat);
        motorShaft.rotation.z = Math.PI / 2;
        motorShaft.position.set(260 * S, 160 * S, 0);
        group.add(motorShaft);
      }

      // 4. Flexible Grid Coupling
      else if (item.assemblyRefId === 'asm-003') {
        const couplingHub = new THREE.Mesh(new THREE.CylinderGeometry(85 * S, 85 * S, 140 * S, 24), couplingMat);
        couplingHub.rotation.z = Math.PI / 2;
        couplingHub.position.set(0, 160 * S, 0);
        couplingHub.castShadow = true;
        addEdges(couplingHub, group);
        group.add(couplingHub);

        // Safety Guard Bracket
        const guard = new THREE.Mesh(new THREE.CylinderGeometry(110 * S, 110 * S, 170 * S, 24, 1, true, 0, Math.PI), steelChannelMat);
        guard.rotation.z = Math.PI / 2;
        guard.position.set(0, 160 * S, 0);
        addEdges(guard, group);
        group.add(guard);
      }

      // 5. Suction Isolation Butterfly Valve
      else if (item.assemblyRefId === 'asm-005') {
        // Wafer valve body
        const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(125 * S, 125 * S, 60 * S, 24), valveMat);
        valveBody.rotation.z = Math.PI / 2;
        valveBody.position.set(0, 160 * S, 0);
        valveBody.castShadow = true;
        addEdges(valveBody, group);
        group.add(valveBody);

        // Top Actuator / Gearbox neck
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(20 * S, 20 * S, 120 * S, 16), valveMat);
        neck.position.set(0, 270 * S, 0);
        addEdges(neck, group);
        group.add(neck);

        // Handwheel
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(60 * S, 10 * S, 12, 24), couplingMat);
        wheel.position.set(0, 330 * S, 0);
        wheel.rotation.x = Math.PI / 2;
        addEdges(wheel, group);
        group.add(wheel);
      }

      // 6. Discharge Check & Regulating Valve
      else if (item.assemblyRefId === 'asm-006') {
        // Dual plate check valve body
        const valveBody = new THREE.Mesh(new THREE.CylinderGeometry(105 * S, 105 * S, 75 * S, 24), valveMat);
        valveBody.position.set(0, 50 * S, 0);
        valveBody.castShadow = true;
        addEdges(valveBody, group);
        group.add(valveBody);

        // Flow indicator arrow boss
        const arrowBoss = new THREE.Mesh(new THREE.ConeGeometry(25 * S, 50 * S, 16), couplingMat);
        arrowBoss.position.set(110 * S, 50 * S, 0);
        group.add(arrowBoss);
      }

      // 7. Suction Reducer Spool Pipe
      else if (item.assemblyRefId === 'asm-007') {
        // Eccentric spool cylinder
        const spool = new THREE.Mesh(new THREE.CylinderGeometry(62.5 * S, 62.5 * S, 320 * S, 24), spoolPipingMat);
        spool.rotation.z = Math.PI / 2;
        spool.position.set(0, 160 * S, 0);
        spool.castShadow = true;
        addEdges(spool, group);
        group.add(spool);

        // Customer connection flange
        const custFlange = new THREE.Mesh(new THREE.CylinderGeometry(125 * S, 125 * S, 22 * S, 24), spoolPipingMat);
        custFlange.rotation.z = Math.PI / 2;
        custFlange.position.set(160 * S, 160 * S, 0);
        addEdges(custFlange, group);
        group.add(custFlange);
      }

      // 8. Discharge Manifold Spool
      else if (item.assemblyRefId === 'asm-008') {
        // Vertical riser manifold
        const riser = new THREE.Mesh(new THREE.CylinderGeometry(50 * S, 50 * S, 360 * S, 24), spoolPipingMat);
        riser.position.set(0, 60 * S, 0);
        riser.castShadow = true;
        addEdges(riser, group);
        group.add(riser);

        // Pressure transmitter gauge port boss
        const boss = new THREE.Mesh(new THREE.CylinderGeometry(14 * S, 14 * S, 40 * S, 16), spoolPipingMat);
        boss.rotation.z = Math.PI / 2;
        boss.position.set(55 * S, 100 * S, 0);
        addEdges(boss, group);
        group.add(boss);
      }

      // 9. Plan 53A Seal Barrier Fluid Reservoir Stand
      else if (item.assemblyRefId === 'asm-009') {
        // Upright mounting stand post
        const post = new THREE.Mesh(new THREE.BoxGeometry(40 * S, 360 * S, 40 * S), steelChannelMat);
        post.position.set(0, 180 * S, 0);
        addEdges(post, group);
        group.add(post);

        // 12L Pressure Vessel
        const vessel = new THREE.Mesh(new THREE.CylinderGeometry(85 * S, 85 * S, 280 * S, 24), reservoirMat);
        vessel.position.set(0, 380 * S, 0);
        vessel.castShadow = true;
        addEdges(vessel, group);
        group.add(vessel);

        // Level sight glass
        const sightGlass = new THREE.Mesh(new THREE.BoxGeometry(20 * S, 140 * S, 25 * S), couplingMat);
        sightGlass.position.set(90 * S, 380 * S, 0);
        group.add(sightGlass);
      }

      // 10. Sensor Terminal Enclosure
      else if (item.assemblyRefId === 'asm-010') {
        // Support bracket
        const brk = new THREE.Mesh(new THREE.BoxGeometry(30 * S, 220 * S, 30 * S), steelChannelMat);
        brk.position.set(0, 110 * S, 0);
        addEdges(brk, group);
        group.add(brk);

        // IP66 Stainless Box
        const box = new THREE.Mesh(new THREE.BoxGeometry(150 * S, 200 * S, 100 * S), enclosureMat);
        box.position.set(0, 260 * S, 0);
        box.castShadow = true;
        addEdges(box, group);
        group.add(box);

        // Cable glands
        for (let g = -1; g <= 1; g++) {
          const gland = new THREE.Mesh(new THREE.CylinderGeometry(8 * S, 8 * S, 20 * S, 12), steelChannelMat);
          gland.position.set(g * 35 * S, 150 * S, 0);
          group.add(gland);
        }
      }

      scene.add(group);
      componentMeshesRef.current.set(item.id, group);
    });
  }, [items, displayStyle, explodeFactor, isPumpModified, isSkidModified]);

  // Handle Selection & Hover Highlights
  useEffect(() => {
    componentMeshesRef.current.forEach((group, id) => {
      const isSelected = id === selectedItemId;
      const isHovered = id === hoveredItemId;

      group.traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          if (isSelected) {
            obj.material.emissive.setHex(0x315D78); // SolidWorks selection blue highlight
            obj.material.emissiveIntensity = 0.55;
          } else if (isHovered) {
            obj.material.emissive.setHex(0x4A6572);
            obj.material.emissiveIntensity = 0.28;
          } else {
            obj.material.emissive.setHex(0x000000);
            obj.material.emissiveIntensity = 0.0;
          }
        }
      });
    });
  }, [selectedItemId, hoveredItemId]);

  // Raycasting Click / Selection Handler
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const meshes: THREE.Mesh[] = [];
    componentMeshesRef.current.forEach(group => {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) meshes.push(obj);
      });
    });

    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      let curr: THREE.Object3D | null = intersects[0].object;
      while (curr && curr.parent && curr.parent !== sceneRef.current) {
        if (curr.userData && curr.userData.itemId) {
          onSelectItem(curr.userData.itemId);
          return;
        }
        curr = curr.parent;
      }
      if (curr && curr.userData && curr.userData.itemId) {
        onSelectItem(curr.userData.itemId);
      }
    }
  };

  // Hover detection
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = mountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const meshes: THREE.Mesh[] = [];
    componentMeshesRef.current.forEach(group => {
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) meshes.push(obj);
      });
    });

    const intersects = raycasterRef.current.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      let curr: THREE.Object3D | null = intersects[0].object;
      while (curr && curr.parent && curr.parent !== sceneRef.current) {
        if (curr.userData && curr.userData.itemId) {
          setHoveredItemId(curr.userData.itemId);
          return;
        }
        curr = curr.parent;
      }
      if (curr && curr.userData && curr.userData.itemId) {
        setHoveredItemId(curr.userData.itemId);
      }
    } else {
      setHoveredItemId(null);
    }
  };

  // Preset Views (SolidWorks standard views)
  const setPresetView = (view: 'iso' | 'front' | 'top' | 'right') => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    setCameraView(view);
    if (view === 'iso') {
      camera.position.set(7.5, 5.0, 8.5);
      controls.target.set(0, 1.2, 0);
    } else if (view === 'front') {
      camera.position.set(0, 1.5, 11);
      controls.target.set(0, 1.2, 0);
    } else if (view === 'top') {
      camera.position.set(0, 11, 0.01);
      controls.target.set(0, 0, 0);
    } else if (view === 'right') {
      camera.position.set(11, 1.5, 0);
      controls.target.set(0, 1.2, 0);
    }
    controls.update();
  };

  const selectedItem = items.find(i => i.id === selectedItemId);
  const hoveredItem = items.find(i => i.id === hoveredItemId);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1C2128] overflow-hidden select-none border border-[#2D3A47] rounded">
      {/* Top Viewport Toolbar */}
      <div className="h-10 px-3 bg-[#242C35] border-b border-[#2D3A47] flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-1 bg-[#1A2027] border border-[#3A4756] rounded text-[11px] text-[#C9D1D9]">
            <Compass size={13} className="text-[#58A6FF]" />
            <span>Orientation:</span>
            <button
              onClick={() => setPresetView('iso')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', cameraView === 'iso' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Isometric
            </button>
            <button
              onClick={() => setPresetView('front')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', cameraView === 'front' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Front
            </button>
            <button
              onClick={() => setPresetView('top')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', cameraView === 'top' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Top
            </button>
            <button
              onClick={() => setPresetView('right')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', cameraView === 'right' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Right
            </button>
          </div>

          <div className="h-4 w-px bg-[#3A4756] mx-1" />

          {/* Render Mode */}
          <div className="flex items-center gap-1 px-2 py-1 bg-[#1A2027] border border-[#3A4756] rounded text-[11px] text-[#C9D1D9]">
            <Layers size={13} className="text-[#58A6FF]" />
            <button
              onClick={() => setDisplayStyle('shadedEdges')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', displayStyle === 'shadedEdges' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Shaded with Edges
            </button>
            <button
              onClick={() => setDisplayStyle('wireframe')}
              className={cn('px-1.5 py-0.5 rounded text-[10.5px] font-medium transition-colors', displayStyle === 'wireframe' ? 'bg-[#315D78] text-white' : 'hover:bg-[#2D3A47] text-[#8B949E]')}
            >
              Wireframe
            </button>
          </div>
        </div>

        {/* Explode View Slider */}
        <div className="flex items-center gap-2 px-2.5 py-1 bg-[#1A2027] border border-[#3A4756] rounded">
          <Sliders size={12} className="text-[#58A6FF]" />
          <span className="text-[10.5px] text-[#9AAAB5] font-medium">Exploded View:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={explodeFactor}
            onChange={e => setExplodeFactor(parseFloat(e.target.value))}
            className="w-24 h-1.5 bg-[#2E3B48] rounded accent-[#58A6FF] cursor-pointer"
          />
          <span className="text-[10px] font-mono text-[#58A6FF] w-7 text-right">
            {Math.round(explodeFactor * 100)}%
          </span>
          {explodeFactor > 0 && (
            <button
              onClick={() => setExplodeFactor(0)}
              className="text-[10px] text-[#8B949E] hover:text-white px-1 py-0.5 rounded bg-[#2D3A47]"
              title="Collapse to Zero"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 3D WebGL Canvas Container */}
      <div
        ref={mountRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="flex-1 w-full h-full cursor-grab active:cursor-grabbing relative"
      />

      {/* Floating HUD Information Overlays */}
      {/* Top Left: Active Main Assembly Metadata */}
      <div className="absolute top-12 left-3 bg-[#161B22]/90 backdrop-blur border border-[#30363D] px-3 py-2 rounded shadow-lg pointer-events-none z-10">
        <div className="flex items-center gap-2">
          <Box size={14} className="text-[#58A6FF]" />
          <span className="text-[12px] font-bold text-white tracking-wide">MAIN_PROCESS_SKID_ASSY.SLDASM</span>
          <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-[#238636]/20 text-[#3FB950] border border-[#238636]/40">
            10 Assemblies Resolved
          </span>
        </div>
        <div className="text-[10.5px] text-[#8B949E] mt-0.5 flex items-center gap-3">
          <span>8 Standard Reuse</span>
          <span>•</span>
          <span className="text-[#E3B341]">2 Modified (Rebuilt)</span>
          <span>•</span>
          <span>568.1 kg</span>
          <span>•</span>
          <span>1720 × 780 × 1180 mm</span>
        </div>
      </div>

      {/* Bottom Left: Selected Component Quick Inspect Pill */}
      {selectedItem && (
        <div className="absolute bottom-3 left-3 max-w-md bg-[#161B22]/95 backdrop-blur border border-[#388BFD]/40 px-3 py-2 rounded shadow-xl z-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={cn(
                'w-2 h-2 rounded-full',
                selectedItem.category === 'modified' ? 'bg-[#E3B341]' : 'bg-[#3FB950]'
              )} />
              <span className="text-[12px] font-bold text-white font-mono">{selectedItem.partNumber}</span>
              <span className="text-[10px] text-[#8B949E]">Rev {selectedItem.revision}</span>
            </div>
            <span className={cn(
              'px-1.5 py-0.2 rounded text-[9.5px] font-semibold uppercase tracking-wider',
              selectedItem.category === 'modified'
                ? 'bg-[#E3B341]/20 text-[#E3B341] border border-[#E3B341]/40'
                : 'bg-[#238636]/20 text-[#3FB950] border border-[#238636]/40'
            )}>
              {selectedItem.category === 'modified' ? 'Modified Candidate' : 'Standard Reuse'}
            </span>
          </div>
          <div className="text-[11px] text-[#C9D1D9] mt-1 font-medium">{selectedItem.description}</div>
          <div className="text-[10px] text-[#8B949E] mt-1 flex items-center gap-3 font-mono">
            <span>Mass: {selectedItem.massKg} kg</span>
            <span>Mates: {selectedItem.mateIds.length} satisfied</span>
            <span>Status: {selectedItem.modificationStatus}</span>
          </div>
        </div>
      )}

      {/* Floating Hover Tooltip if different from selected */}
      {hoveredItem && hoveredItem.id !== selectedItemId && (
        <div className="absolute top-12 right-3 bg-[#161B22]/90 backdrop-blur border border-[#30363D] px-2.5 py-1.5 rounded shadow pointer-events-none z-10">
          <div className="text-[11px] font-mono font-bold text-white">{hoveredItem.partNumber}</div>
          <div className="text-[10px] text-[#8B949E]">{hoveredItem.description}</div>
        </div>
      )}

      {/* Bottom Right: Viewport Navigation Tips */}
      <div className="absolute bottom-3 right-3 bg-[#161B22]/80 backdrop-blur border border-[#30363D] px-2.5 py-1.5 rounded text-[10px] text-[#8B949E] pointer-events-none z-10 flex items-center gap-2">
        <span>Left Click: Orbit</span>
        <span>•</span>
        <span>Right Click: Pan</span>
        <span>•</span>
        <span>Scroll: Zoom</span>
        <span>•</span>
        <span>Click component to inspect</span>
      </div>
    </div>
  );
}
