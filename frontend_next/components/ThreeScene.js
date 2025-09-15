
import React, { useEffect } from "react";
import * as THREE from "three";

export default function ThreeScene({ emotion }){
  useEffect(()=>{
    const mount = document.getElementById("three-root");
    if(!mount) return;
    const width = mount.clientWidth || 800;
    const height = 400;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
    renderer.setSize(width, height);
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    camera.position.z = 5;
    const light = new THREE.DirectionalLight(0xffffff,1);
    light.position.set(5,5,5);
    scene.add(light);

    const group = new THREE.Group();
    scene.add(group);

    function spawnHearts(){
      group.clear();
      for(let i=0;i<20;i++){
        const geo = new THREE.SphereGeometry(0.15,12,12);
        const mat = new THREE.MeshStandardMaterial({ color:0xff3366 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((Math.random()-0.5)*4, (Math.random()-0.5)*3, (Math.random()-0.5)*2);
        group.add(mesh);
      }
    }

    function spawnRain(){
      group.clear();
      for(let i=0;i<60;i++){
        const geo = new THREE.BoxGeometry(0.05,0.4,0.05);
        const mat = new THREE.MeshStandardMaterial({ color:0x3399ff });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((Math.random()-0.5)*6, Math.random()*4, (Math.random()-0.5)*2);
        group.add(mesh);
      }
    }

    function spawnSparks(){
      group.clear();
      for(let i=0;i<30;i++){
        const geo = new THREE.SphereGeometry(0.08,8,8);
        const mat = new THREE.MeshStandardMaterial({ color:0xffff66, emissive:0xffee00 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set((Math.random()-0.5)*5, (Math.random()-0.5)*3, (Math.random()-0.5)*2);
        group.add(mesh);
      }
    }

    // choose effect
    if(emotion==="joy") spawnHearts();
    else if(emotion==="sorrow") spawnRain();
    else if(emotion==="surprise") spawnSparks();
    else {
      group.clear();
      const geo = new THREE.TorusKnotGeometry(1,0.3,100,16);
      const mat = new THREE.MeshStandardMaterial({ color:0x8888ff });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
    }

    function animate(){
      requestAnimationFrame(animate);
      group.rotation.y += 0.005;
      renderer.render(scene,camera);
    }
    animate();

    return ()=>{
      mount.innerHTML="";
      scene.clear();
    };
  }, [emotion]);

  return null;
}
