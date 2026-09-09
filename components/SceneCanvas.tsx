"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function SceneCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.set(0, 0, 7.8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const material = new THREE.MeshPhysicalMaterial({
      color: 0x8b5cf6,
      metalness: 0.48,
      roughness: 0.14,
      transmission: 0.28,
      transparent: true,
      opacity: 0.88,
      iridescence: 0.65,
      iridescenceIOR: 1.3,
    });

    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.42, 0.32, 180, 30), material);
    group.add(knot);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.26, wireframe: true });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.015, 8, 160), ringMat);
    const ring2 = ring1.clone();
    ring2.rotation.x = Math.PI / 2.4;
    ring2.rotation.y = Math.PI / 4;
    group.add(ring1, ring2);

    const particleGeo = new THREE.BufferGeometry();
    const particleCount = 700;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 3.4 + Math.random() * 4.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeo,
      new THREE.PointsMaterial({ color: 0xa78bfa, size: 0.025, transparent: true, opacity: 0.68 })
    );
    scene.add(particles);

    scene.add(new THREE.AmbientLight(0x8b5cf6, 1.6));
    const key = new THREE.PointLight(0x38bdf8, 34, 20);
    key.position.set(4, 4, 5);
    scene.add(key);
    const fill = new THREE.PointLight(0xec4899, 28, 18);
    fill.position.set(-4, -2, 3);
    scene.add(fill);

    let mouseX = 0;
    let mouseY = 0;
    const onMove = (e: PointerEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 0.9;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 0.55;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      const t = clock.getElapsedTime();
      knot.rotation.x = t * 0.16 + mouseY * 0.35;
      knot.rotation.y = t * 0.24 + mouseX * 0.45;
      ring1.rotation.z = t * 0.12;
      ring2.rotation.z = -t * 0.16;
      particles.rotation.y = t * 0.015;
      group.position.y = Math.sin(t * 0.8) * 0.16;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      observer.disconnect();
      particleGeo.dispose();
      (particles.material as THREE.Material).dispose();
      knot.geometry.dispose();
      material.dispose();
      ring1.geometry.dispose();
      ringMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={mountRef} className="scene-canvas" aria-hidden="true" />;
}
