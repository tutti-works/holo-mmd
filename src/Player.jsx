import React, { useRef, useState, useEffect, forwardRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';

// キャラクターコンポーネント
const Character = forwardRef(({ animationState }, ref) => {
  const group = useRef();
  const { scene, animations } = useGLTF("/models/player/character.gltf");
  const { actions } = useAnimations(animations, group);
  
  const currentAnimation = useRef("Idle");
  
  // プレイヤーオブジェクトに名前を設定（カメラの衝突判定で除外するため）
  useEffect(() => {
    if (group.current) {
      group.current.name = 'player';
      group.current.traverse((child) => {
        if (child.isMesh) {
          child.name = 'player';
          // 🔥 重要: 自プレイヤーの影を有効化
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, []);
  
  useEffect(() => {
    // 初期アニメーション
    if (actions.Idle) {
      actions.Idle.play();
    }
  }, [actions]);

  useEffect(() => {
    const newAnimation = animationState;
    
    if (newAnimation !== currentAnimation.current) {
      // 現在のアニメーションをフェードアウト
      if (actions[currentAnimation.current]) {
        actions[currentAnimation.current].fadeOut(0.2);
      }
      
      // 新しいアニメーションをフェードイン
      if (actions[newAnimation]) {
        const action = actions[newAnimation];
        action.reset().fadeIn(0.2).play();
        
        // アニメーション速度の調整
        if (newAnimation === "Walk") {
          action.timeScale = 1.5;
        } else if (newAnimation === "Run") {
          action.timeScale = 1.2;
        } else {
          action.timeScale = 1.0;
        }
      }
      
      currentAnimation.current = newAnimation;
    }
  }, [animationState, actions]);
  
  return (
    <group ref={group} name="player">
      <primitive 
        object={scene} 
        castShadow 
        position={[0, -0.9, 0]}
        dispose={null}
      />
    </group>
  );
});

// フォールバックキャラクター
const FallbackCharacter = forwardRef((props, ref) => {
  const group = useRef();
  
  useEffect(() => {
    if (group.current) {
      group.current.name = 'player';
      group.current.traverse((child) => {
        if (child.isMesh) {
          child.name = 'player';
        }
      });
    }
  }, []);
  
  useFrame(() => {
    if (group.current) {
      group.current.position.y = Math.sin(Date.now() * 0.002) * 0.1;
    }
  });
  
  return (
    <group ref={group} name="player">
      <mesh castShadow position={[0, 0, 0]} name="player">
        <capsuleGeometry args={[0.3, 1.4]} />
        <meshStandardMaterial color="hotpink" />
      </mesh>
      <mesh position={[0, 0.5, -0.4]} castShadow name="player">
        <sphereGeometry args={[0.1]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  );
});

// メインプレイヤーコンポーネント
const Player = ({ 
  inputState, 
  cameraRef, 
  onPositionUpdate,
  initialPosition = [0, 1, 0] 
}) => {
  const rigidBodyRef = useRef();
  const playerRef = useRef();
  const [animationState, setAnimationState] = useState("Idle");
  
  // 移動関連の状態
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const frontVector = useRef(new THREE.Vector3());
  const sideVector = useRef(new THREE.Vector3());
  const rotation = useRef(new THREE.Quaternion());
  const targetRotation = useRef(new THREE.Quaternion());
  
  // スムーズな位置更新のための参照
  const lastPosition = useRef(new THREE.Vector3(...initialPosition));
  const smoothPosition = useRef(new THREE.Vector3(...initialPosition));
  const positionBuffer = useRef([]);
  const POSITION_BUFFER_SIZE = 3;
  
  // 設定
  const WALK_SPEED = 3;
  const RUN_SPEED = 6;
  const JUMP_FORCE = 5;
  const ROTATION_SPEED = 0.1;
  const POSITION_SMOOTHING = 0.1;
  
  // 地面接触判定
  const [isGrounded, setIsGrounded] = useState(false);
  const groundCheckTimer = useRef(0);

  // 位置のスムージング関数
  const updateSmoothedPosition = (newPosition) => {
    // バッファに新しい位置を追加
    positionBuffer.current.push(new THREE.Vector3().copy(newPosition));
    if (positionBuffer.current.length > POSITION_BUFFER_SIZE) {
      positionBuffer.current.shift();
    }
    
    // バッファ内の位置の平均を計算
    if (positionBuffer.current.length > 0) {
      const avg = new THREE.Vector3();
      positionBuffer.current.forEach(pos => avg.add(pos));
      avg.divideScalar(positionBuffer.current.length);
      
      // スムーズに補間
      smoothPosition.current.lerp(avg, POSITION_SMOOTHING);
    }
  };

  useFrame((state, delta) => {
    if (!rigidBodyRef.current || !cameraRef.current) return;

    const rigidBody = rigidBodyRef.current;
    const camera = cameraRef.current;
    
    // 現在の速度を取得
    const currentVel = rigidBody.linvel();
    velocity.current.set(currentVel.x, currentVel.y, currentVel.z);
    
    // カメラの向きを基準にした移動方向を計算
    camera.getWorldDirection(frontVector.current);
    frontVector.current.y = 0;
    frontVector.current.normalize();
    
    sideVector.current.crossVectors(camera.up, frontVector.current);
    
    // 入力に基づく移動方向の計算
    direction.current.set(0, 0, 0);
    
    if (inputState.forward) direction.current.add(frontVector.current);
    if (inputState.backward) direction.current.sub(frontVector.current);
    if (inputState.leftward) direction.current.add(sideVector.current);
    if (inputState.rightward) direction.current.sub(sideVector.current);
    
    // 移動方向を正規化
    if (direction.current.length() > 0) {
      direction.current.normalize();
    }
    
    // 移動速度の決定
    const isMoving = direction.current.length() > 0;
    const speed = inputState.run ? RUN_SPEED : WALK_SPEED;
    
    // 水平移動の適用
    if (isMoving) {
      direction.current.multiplyScalar(speed);
      rigidBody.setLinvel({
        x: direction.current.x,
        y: velocity.current.y,
        z: direction.current.z
      }, true);
      
      // キャラクターの回転
      targetRotation.current.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        direction.current.clone().normalize()
      );
      
      if (playerRef.current) {
        rotation.current.slerp(targetRotation.current, ROTATION_SPEED);
        playerRef.current.quaternion.copy(rotation.current);
      }
    } else {
      // 停止時は水平速度を0に
      rigidBody.setLinvel({
        x: 0,
        y: velocity.current.y,
        z: 0
      }, true);
    }
    
    // 地面接触判定（簡易版）
    groundCheckTimer.current += delta;
    if (groundCheckTimer.current > 0.1) { // 100msごとにチェック
      const grounded = Math.abs(velocity.current.y) < 0.1;
      setIsGrounded(grounded);
      groundCheckTimer.current = 0;
    }
    
    // ジャンプ
    if (inputState.jump && isGrounded) {
      rigidBody.setLinvel({
        x: velocity.current.x,
        y: JUMP_FORCE,
        z: velocity.current.z
      }, true);
    }
    
    // アニメーション状態の更新
    let newAnimationState = "Idle";
    
    if (!isGrounded) {
      newAnimationState = "Jump";
    } else if (isMoving) {
      newAnimationState = inputState.run ? "Run" : "Walk";
    }
    
    if (newAnimationState !== animationState) {
      setAnimationState(newAnimationState);
    }
    
    // 位置の更新とスムージング
    const currentPosition = rigidBody.translation();
    const newPosition = new THREE.Vector3(currentPosition.x, currentPosition.y, currentPosition.z);
    
    // 位置のスムージング処理
    updateSmoothedPosition(newPosition);
    
    // カメラ用にスムーズな位置を送信
    if (onPositionUpdate) {
      onPositionUpdate(smoothPosition.current);
    }
    
    lastPosition.current.copy(newPosition);
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={initialPosition}
      enabledRotations={[false, false, false]} // Y軸回転のみ許可
      lockRotations={false}
      mass={1}
      type="dynamic"
      colliders={false}
    >
      <CapsuleCollider args={[0.8, 0.4]} position={[0, 0.3, 0]} />
      
      <group ref={playerRef} name="player">
        <React.Suspense fallback={<FallbackCharacter />}>
          <Character animationState={animationState} />
        </React.Suspense>
      </group>
    </RigidBody>
  );
};

export default Player;