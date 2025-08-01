import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

const YouTubeScreenPortal = forwardRef(({ 
  videoId = "KfZR9jVP6tw",
  position = [0, 3, -8],
  scale = [8, 4.5, 0.1],
  onTimeUpdate,
  autoplay = false
}, ref) => {
  const meshRef = useRef();
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isUserMuted, setIsUserMuted] = useState(true);
  const [screenPosition, setScreenPosition] = useState({ x: 0, y: 0 });
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  const [isVisible, setIsVisible] = useState(true);
  const { camera, gl, scene } = useThree();
  const portalContainerRef = useRef();
  
  // YouTube Player APIの初期化
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        setIsReady(true);
      };
    } else {
      setIsReady(true);
    }
  }, []);

  // Portal用のコンテナを作成（Canvas外に作成）
  useEffect(() => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.overflow = 'hidden';
    container.style.zIndex = '1'; // Canvasより上に配置
    portalContainerRef.current = container;
    
    // WebGLキャンバスの親要素に追加
    const parent = gl.domElement.parentElement;
    parent.style.position = 'relative'; // 親要素をrelativeに
    parent.appendChild(container);
    
    return () => {
      if (parent.contains(container)) {
        parent.removeChild(container);
      }
    };
  }, [gl]);

  // YouTubeプレイヤーの作成
  useEffect(() => {
    if (!isReady || !portalContainerRef.current) return;

    // プレイヤー用のdivをportalContainer内に作成
    const playerWrapper = document.createElement('div');
    playerWrapper.style.position = 'absolute';
    playerWrapper.style.width = '100%';
    playerWrapper.style.height = '100%';
    portalContainerRef.current.appendChild(playerWrapper);

    const playerDiv = document.createElement('div');
    playerDiv.id = 'youtube-player-portal-' + Math.random().toString(36).substr(2, 9);
    playerWrapper.appendChild(playerDiv);

    const player = new window.YT.Player(playerDiv.id, {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        mute: 1,
        loop: 1,
        playlist: videoId,
        controls: 1,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event) => {
          playerRef.current = event.target;
          if (autoplay) {
            event.target.playVideo();
          }
        }
      }
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
      if (portalContainerRef.current && portalContainerRef.current.contains(playerWrapper)) {
        portalContainerRef.current.removeChild(playerWrapper);
      }
    };
  }, [isReady, videoId, autoplay]);

  // スクリーンの位置とサイズを計算
  useFrame(() => {
    if (!meshRef.current || !portalContainerRef.current) return;
    
    // メッシュのワールド座標を取得
    const worldPosition = new THREE.Vector3();
    meshRef.current.getWorldPosition(worldPosition);
    
    // カメラから見たスクリーンの位置を計算
    const screenPos = worldPosition.clone().project(camera);
    
    // スクリーンの可視性チェック
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const toScreen = worldPosition.clone().sub(camera.position);
    const dot = cameraDirection.dot(toScreen.normalize());
    const inFrustum = dot > 0 && screenPos.z > -1 && screenPos.z < 1;
    
    if (!inFrustum) {
      setIsVisible(false);
      return;
    }
    
    // レイキャストでオクルージョンチェック
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(screenPos.x, screenPos.y), camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    let occluded = false;
    if (intersects.length > 0) {
      const screenDistance = worldPosition.distanceTo(camera.position);
      for (let i = 0; i < intersects.length; i++) {
        const hit = intersects[i];
        // スクリーン自体やその子要素は除外
        if (hit.object === meshRef.current || hit.object.parent === meshRef.current.parent) {
          continue;
        }
        if (hit.distance < screenDistance - 0.1) {
          occluded = true;
          break;
        }
      }
    }
    
    setIsVisible(!occluded);
    
    // スクリーンの四隅を計算
    const halfWidth = scale[0] / 2;
    const halfHeight = scale[1] / 2;
    const corners = [
      new THREE.Vector3(-halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight, 0),
      new THREE.Vector3(-halfWidth, halfHeight, 0)
    ];
    
    // ワールド座標系での四隅の位置を計算
    const worldCorners = corners.map(corner => {
      const worldCorner = corner.clone();
      worldCorner.applyMatrix4(meshRef.current.matrixWorld);
      return worldCorner.project(camera);
    });
    
    // スクリーン座標での境界を計算
    const xs = worldCorners.map(c => c.x);
    const ys = worldCorners.map(c => c.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    // ピクセル座標に変換
    const canvasWidth = gl.domElement.clientWidth;
    const canvasHeight = gl.domElement.clientHeight;
    
    const pixelLeft = ((minX + 1) / 2) * canvasWidth;
    const pixelTop = ((1 - maxY) / 2) * canvasHeight;
    const pixelWidth = ((maxX - minX) / 2) * canvasWidth;
    const pixelHeight = ((maxY - minY) / 2) * canvasHeight;
    
    setScreenPosition({ x: pixelLeft, y: pixelTop });
    setScreenSize({ width: pixelWidth, height: pixelHeight });
  });

  // 再生時間の更新
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        setCurrentTime(time);
        if (onTimeUpdate) {
          onTimeUpdate(time);
        }
      }
    }, 16);

    return () => clearInterval(interval);
  }, [onTimeUpdate, isReady]);

  const handleUnmute = () => {
    if (playerRef.current) {
      playerRef.current.unMute();
      playerRef.current.setVolume(50);
      playerRef.current.playVideo();
      setIsUserMuted(false);
    }
  };

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seekTo: (time) => playerRef.current?.seekTo(time, true),
    getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
    getDuration: () => playerRef.current?.getDuration() || 0
  }));

  // Portal要素（Canvas外でレンダリング）
  const portalContent = portalContainerRef.current && createPortal(
    <div
      style={{
        position: 'absolute',
        left: `${screenPosition.x}px`,
        top: `${screenPosition.y}px`,
        width: `${screenSize.width}px`,
        height: `${screenSize.height}px`,
        display: isVisible ? 'block' : 'none',
        pointerEvents: 'auto',
        overflow: 'hidden'
      }}
    >
      {isUserMuted && (
        <div 
          onClick={handleUnmute}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <span>スタート</span>
        </div>
      )}
    </div>,
    portalContainerRef.current
  );

  return (
    <>
      {/* R3F Canvas内の要素 */}
      <group position={position}>
        <RigidBody type="fixed" colliders="cuboid">
          <mesh ref={meshRef} name="youtube-screen">
            <boxGeometry args={scale} />
            <meshStandardMaterial color="#111111" />
          </mesh>
        </RigidBody>
        
        <mesh position={[0, 0, -0.1]} name="screen-frame">
          <boxGeometry args={[scale[0] + 0.2, scale[1] + 0.2, 0.2]} />
          <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
        </mesh>
        
        <rectAreaLight
          width={scale[0]}
          height={scale[1]}
          intensity={0.5}
          color="#4488ff"
          position={[0, 0, 0.1]}
        />
      </group>
      
      {/* Portal要素はCanvas外でレンダリング */}
      {portalContent}
    </>
  );
});

export default YouTubeScreenPortal;