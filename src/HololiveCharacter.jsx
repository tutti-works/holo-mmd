import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const HololiveCharacter = forwardRef((props, ref) => {
  const { syncTime, animationIndex = 0, ...restProps } = props;
  const group = useRef();
  const { scene, animations } = useGLTF("/models/hololive/マリンMMD.gltf");
  const { actions, names, mixer } = useAnimations(animations, group);
  
  const currentActionRef = useRef(null);
  const lastValidTime = useRef(0);
  const isPausedRef = useRef(false);

  // デバッグ: 利用可能なアニメーションを確認
  useEffect(() => {
    console.log("利用可能なアニメーション:", names);
    console.log("アニメーション数:", animations.length);
  }, [names, animations]);

  // アニメーションの初期化
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;

    // 指定されたインデックスのアニメーションを選択
    const animationName = names[animationIndex] || names[0];
    
    if (animationName && actions[animationName]) {
      console.log("選択されたアニメーション:", animationName);
      
      // 既存のアニメーションを停止
      if (currentActionRef.current) {
        currentActionRef.current.stop();
      }
      
      const action = actions[animationName];
      action.reset();
      action.play();
      action.setLoop(THREE.LoopRepeat);
      action.timeScale = 1.0;
      action.paused = true; // 初期状態は一時停止
      currentActionRef.current = action;
    }
  }, [actions, names, animationIndex]);

  // フレームごとの更新
  useFrame(() => {
    if (!mixer || !currentActionRef.current || syncTime === undefined || syncTime === null) return;

    const action = currentActionRef.current;
    const clip = action.getClip();
    const duration = clip.duration;

    // 動画が再生中かどうかを判定（時間が進んでいるか）
    if (syncTime > lastValidTime.current + 0.001) {
      // 再生中
      isPausedRef.current = false;
      action.paused = false;
      
      // アニメーション時間を設定
      const animTime = syncTime % duration;
      action.time = animTime;
      
      // ミキサーを更新（0秒で更新することで、現在の時間を維持）
      mixer.update(0);
      
      lastValidTime.current = syncTime;
    } else if (syncTime < lastValidTime.current - 0.001) {
      // シークされた（巻き戻し）
      isPausedRef.current = false;
      action.paused = false;
      
      const animTime = syncTime % duration;
      action.time = animTime;
      mixer.update(0);
      
      lastValidTime.current = syncTime;
    } else {
      // 一時停止中（時間が変わっていない）
      if (!isPausedRef.current) {
        isPausedRef.current = true;
        action.paused = true;
        // 一時停止時は現在の時間を維持
      }
    }
  });

  // 通常のアニメーション更新（syncTimeが指定されていない場合のみ）
  useFrame((state, delta) => {
    if (!mixer || syncTime !== undefined) return;
    
    // syncTimeが指定されていない場合のみミキサーを更新
    mixer.update(delta);
  });

  // 外部からアニメーションを制御するためのメソッドを公開
  useImperativeHandle(ref, () => ({
    play: () => {
      if (currentActionRef.current) {
        currentActionRef.current.paused = false;
        isPausedRef.current = false;
      }
    },
    pause: () => {
      if (currentActionRef.current) {
        currentActionRef.current.paused = true;
        isPausedRef.current = true;
      }
    },
    reset: () => {
      if (currentActionRef.current) {
        currentActionRef.current.time = 0;
        lastValidTime.current = 0;
      }
    },
    getAnimationNames: () => names,
    switchAnimation: (index) => {
      const animationName = names[index];
      if (actions[animationName] && currentActionRef.current) {
        currentActionRef.current.stop();
        const newAction = actions[animationName];
        newAction.reset();
        newAction.play();
        newAction.paused = true;
        currentActionRef.current = newAction;
      }
    },
    setTimeScale: (scale) => {
      if (currentActionRef.current) {
        currentActionRef.current.timeScale = scale;
      }
    }
  }));

  // モデル内の全メッシュに影の設定を適用
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(material => {
          if (material) {
            // 透明が有効なマテリアルに対して設定を適用
            if (material.transparent) {
              material.alphaTest = 0.5;
              material.depthWrite = true;
            }
            // レンダリング順序を設定
            material.depthTest = true;
          }
        });
      }
    });
  }, [scene]);

  return (
    <group ref={group} {...restProps} dispose={null}>
      <primitive object={scene} />
    </group>
  );
});

// パフォーマンス向上のため、モデルを事前に読み込んでおく
useGLTF.preload("/models/hololive/マリンMMD.gltf");

export default HololiveCharacter;