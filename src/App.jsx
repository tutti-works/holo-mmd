import React, { Suspense, useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Sky, Environment } from "@react-three/drei";
import { Physics, RigidBody } from "@react-three/rapier";
import Player from './Player';
import CameraController from './CameraController';
import { useKeyboardInput, useMobileInput, VirtualJoystick } from './InputManager';
import * as THREE from 'three';

// デバイス判定フック
const useDeviceDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword)) || 
                            ('ontouchstart' in window) || 
                            (window.innerWidth <= 768);
      setIsMobile(isMobileDevice);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return isMobile;
};

// 部屋のコンポーネント（衝突判定用の名前を追加）
const Room = () => {
  return (
    <group>
      {/* 床 */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -1, 0]} name="floor">
          <boxGeometry args={[20, 0.1, 20]} />
          <meshStandardMaterial color="#8B4513" />
        </mesh>
      </RigidBody>
      
      {/* 壁 */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 2, -10]} name="wall">
          <boxGeometry args={[20, 4, 0.1]} />
          <meshStandardMaterial color="#D2B48C" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 2, 10]} name="wall">
          <boxGeometry args={[20, 4, 0.1]} />
          <meshStandardMaterial color="#D2B48C" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[-10, 2, 0]} name="wall">
          <boxGeometry args={[0.1, 4, 20]} />
          <meshStandardMaterial color="#D2B48C" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[10, 2, 0]} name="wall">
          <boxGeometry args={[0.1, 4, 20]} />
          <meshStandardMaterial color="#D2B48C" />
        </mesh>
      </RigidBody>
      
      {/* 障害物 */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[3, 0, 3]} castShadow name="obstacle">
          <boxGeometry args={[1, 2, 1]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[-3, 0, -3]} castShadow name="obstacle">
          <boxGeometry args={[1, 2, 1]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
      </RigidBody>
      
      {/* カメラ衝突テスト用の追加障害物 */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[0, 1, 2]} castShadow name="obstacle">
          <boxGeometry args={[2, 3, 0.5]} />
          <meshStandardMaterial color="#A0522D" />
        </mesh>
      </RigidBody>
      
      <RigidBody type="fixed" colliders="cuboid">
        <mesh position={[-5, 0, 0]} castShadow name="pillar">
          <cylinderGeometry args={[0.5, 0.5, 4]} />
          <meshStandardMaterial color="#8B7355" />
        </mesh>
      </RigidBody>
    </group>
  );
};

// デバッグ情報コンポーネント
const DebugInfo = ({ inputState, playerPosition, isMobile }) => {
  if (!isMobile) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      left: '50px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      fontSize: '11px',
      borderRadius: '5px',
      zIndex: 500,
      fontFamily: 'monospace',
      lineHeight: '1.2'
    }}>
      <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>Debug Info:</div>
      <div>Forward: {inputState.forward ? '✓' : '✗'}</div>
      <div>Backward: {inputState.backward ? '✓' : '✗'}</div>
      <div>Left: {inputState.leftward ? '✓' : '✗'}</div>
      <div>Right: {inputState.rightward ? '✓' : '✗'}</div>
      <div>Run: {inputState.run ? '✓' : '✗'}</div>
      <div>Jump: {inputState.jump ? '✓' : '✗'}</div>
      {playerPosition && (
        <div style={{ marginTop: '8px' }}>
          <div>Position:</div>
          <div>X: {playerPosition.x?.toFixed(2)}</div>
          <div>Y: {playerPosition.y?.toFixed(2)}</div>
          <div>Z: {playerPosition.z?.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
};

// メインアプリケーション
export default function App() {
  const isMobile = useDeviceDetection();
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const [playerPosition, setPlayerPosition] = useState(null);
  const cameraRef = useRef();

  // 入力管理
  const keyboardInput = useKeyboardInput();
  const { inputState: mobileInputState, handleMove, handleJump } = useMobileInput(isMobile);
  
  // 最終的な入力状態
  const finalInputState = isMobile ? mobileInputState : keyboardInput;
  
  // 画面回転の監視
  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    
    const handleOrientationChange = () => {
      setTimeout(() => {
        setIsLandscape(window.innerWidth > window.innerHeight);
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // モバイルでのフルスクリーン設定
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      let viewport = document.querySelector('meta[name="viewport"]');
      if (!viewport) {
        viewport = document.createElement('meta');
        viewport.name = 'viewport';
        document.head.appendChild(viewport);
      }
      viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.height = '';
      };
    }
  }, [isMobile]);

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden',
      background: '#87CEEB',
      position: 'fixed',
      top: 0,
      left: 0,
      margin: 0,
      padding: 0,
      touchAction: 'none'
    }}>
      {/* 横画面推奨メッセージ */}
      {isMobile && !isLandscape && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          fontSize: '18px',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📱</div>
          <div>このゲームは横画面でプレイしてください</div>
          <div style={{ fontSize: '16px', marginTop: '10px', opacity: 0.8 }}>
            デバイスを横向きにしてください
          </div>
        </div>
      )}
      
      <Canvas 
        shadows={{
          enabled: true,
          type: THREE.PCFSoftShadowMap,
        }}
        camera={{ position: [0, 5, 5], fov: 60 }}
        style={{ width: '100%', height: '100%' }}
        frameloop="always"
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
        onCreated={({ gl, scene }) => {
          // シャドウマップの設定
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          
          // より高品質な設定
          gl.shadowMap.autoUpdate = true;
          gl.physicallyCorrectLights = true;
        }}
      >
        {/* <Sky sunPosition={[100, 20, 100]} /> */}
        <ambientLight intensity={0.3} />
        <directionalLight 
          castShadow 
          intensity={0.8} 
          position={[20, 20, 0]}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.1}
          shadow-camera-far={100}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
          shadow-bias={-0.0005}
          shadow-normalBias={0.02}
          shadow-radius={10}
        />
        <Environment preset="sunset" />
        
        <Physics 
          gravity={[0, -9.81, 0]} 
          debug={true}
          timeStep={1/60}
          paused={false}
        >
          <Suspense fallback={null}>
            <Player
              inputState={finalInputState || {}}
              cameraRef={cameraRef}
              onPositionUpdate={setPlayerPosition}
              initialPosition={[0, 1, 0]}
            />
          </Suspense>
          
          <Room />
          
          <CameraController
            targetPosition={playerPosition}
            isMobile={isMobile}
            onCameraRef={(camera) => {
              cameraRef.current = camera;
            }}
          />
        </Physics>
      </Canvas>
      
      {/* バーチャルジョイスティック */}
      <VirtualJoystick 
        onMove={handleMove}
        onJump={handleJump}
        isMobile={isMobile}
      />
      
      {/* デバッグ情報 */}
      <DebugInfo 
        inputState={finalInputState || {}}
        playerPosition={playerPosition}
        isMobile={isMobile}
      />
    </div>
  );
}