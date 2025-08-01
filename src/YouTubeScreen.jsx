import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Html } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

const YouTubeScreen = forwardRef(({ 
  videoId = "KfZR9jVP6tw",
  position = [0, 3, -8],
  scale = [8, 4.5, 0.1],
  onTimeUpdate,
  autoplay = true
}, ref) => {
  const meshRef = useRef();
  const playerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const frameRef = useRef();
  const [isUserMuted, setIsUserMuted] = useState(true);
  
  // YouTube Player APIの初期化
  useEffect(() => {
    // YouTube IFrame APIをロード
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

  // YouTubeプレイヤーの作成
  useEffect(() => {
    if (!isReady) return;

    const player = new window.YT.Player('youtube-player', {
      height: '100%',
      width: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        mute: 1, // 自動再生のためにミュート
        loop: 1,
        playlist: videoId, // ループ再生のため
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
        },
        onStateChange: (event) => {
          // 再生状態の変更を検知
        }
      }
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [isReady, videoId, autoplay]);

  // 再生時間の更新を監視
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
    }, 16); // 約60fpsで更新

    return () => clearInterval(interval);
  }, [onTimeUpdate, isReady]);

  // ミュート解除と再生ボタンのクリックハンドラ
  const handleUnmute = () => {
    if (playerRef.current) {
      playerRef.current.unMute();
      playerRef.current.setVolume(50);
      playerRef.current.playVideo();
      setIsUserMuted(false);
    }
  };

  // 外部からの制御用インターフェース
  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seekTo: (time) => playerRef.current?.seekTo(time, true),
    getCurrentTime: () => playerRef.current?.getCurrentTime() || 0,
    getDuration: () => playerRef.current?.getDuration() || 0
  }));

  const uiScale = 4;

  return (
    <group position={position}>
      {/* スクリーンの物理ボディ */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh ref={meshRef} name="youtube-screen">
          <boxGeometry args={scale} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </RigidBody>
      
      {/* YouTube動画を表示するHTML要素 */}
      <Html
        center
        distanceFactor={1}
        position={[0, 0, scale[2] / 2 + 0.01]}
        transform
        occlude={[meshRef]} // ★★★ 重要な修正: occludeにスクリーンのメッシュを指定
        zIndexRange={[0, 100]} // ★★★ 修正: 順序を反転（低い値が後ろ）
        style={{
          width: `${scale[0] * 100}px`, 
          height: `${scale[1] * 100}px`,
          pointerEvents: 'auto'
        }}
      >
        <div 
          style={{ 
            width: '100%', 
            height: '100%',
            background: 'black',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
            transform: `scale(${uiScale})`,
          }}
        >
          <div 
            id="youtube-player" 
            style={{ 
              width: '100%', 
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0
            }} 
          />
          {/* ミュート解除と再生ボタンのオーバーレイ */}
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
              <span style={{marginLeft: '10px'}}>スタート</span>
            </div>
          )}
        </div>
      </Html>
      
      {/* スクリーンの枠 */}
      <mesh position={[0, 0, -0.1]} name="screen-frame">
        <boxGeometry args={[scale[0] + 0.2, scale[1] + 0.2, 0.2]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* スクリーンからの光 */}
      <rectAreaLight
        width={scale[0]}
        height={scale[1]}
        intensity={0.5}
        color="#4488ff"
        position={[0, 0, 0.1]}
      />
    </group>
  );
});

export default YouTubeScreen;