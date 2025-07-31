import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const CameraController = ({ 
  targetPosition, 
  isMobile = false,
  onCameraRef 
}) => {
  const { camera, gl, scene } = useThree();
  
  // カメラ制御用の参照
  const cameraRigRef = useRef();
  const targetRef = useRef(new THREE.Vector3());
  const smoothTargetRef = useRef(new THREE.Vector3());
  const spherical = useRef(new THREE.Spherical(5, Math.PI / 3, 0));
  const rotateStart = useRef(new THREE.Vector2());
  const rotateEnd = useRef(new THREE.Vector2());
  const rotateDelta = useRef(new THREE.Vector2());
  
  // スムージング用の参照
  const smoothCameraPosition = useRef(new THREE.Vector3());
  const smoothLookAt = useRef(new THREE.Vector3());
  
  // レイキャスト用
  const raycaster = useRef(new THREE.Raycaster());
  const collisionObjects = useRef([]);
  
  // タッチ関連
  const touches = useRef({});
  const lastTouchDistance = useRef(0);
  
  // 設定
  const MIN_DISTANCE = 2;
  const MAX_DISTANCE = 10;
  const MIN_POLAR_ANGLE = 0.1;
  const MAX_POLAR_ANGLE = Math.PI - 0.1;
  const ROTATE_SPEED = 3.0;
  const ZOOM_SPEED = 0.5;
  const CAMERA_SMOOTHING = 0.2; // より滑らかに
  const TARGET_SMOOTHING = 1; // ターゲット追従も滑らかに
  const COLLISION_OFFSET = 0.3; // 衝突時の最小距離
  
  // カメラ参照をコールバック
  useEffect(() => {
    if (onCameraRef) {
      onCameraRef(camera);
    }
  }, [camera, onCameraRef]);

  // 衝突オブジェクトの更新
  useEffect(() => {
    const updateCollisionObjects = () => {
      const objects = [];
      scene.traverse((child) => {
        if (child.isMesh && child.name !== 'player' && child.parent?.name !== 'player') {
          objects.push(child);
        }
      });
      collisionObjects.current = objects;
    };

    updateCollisionObjects();
    // シーンが変更された時も更新
    const interval = setInterval(updateCollisionObjects, 1000);
    return () => clearInterval(interval);
  }, [scene]);

  // マウス/タッチイベントハンドラー
  useEffect(() => {
    const handleMouseDown = (event) => {
      if (isMobile) return;
      
      rotateStart.current.set(event.clientX, event.clientY);
      
      const onMouseMove = (event) => {
        rotateEnd.current.set(event.clientX, event.clientY);
        rotateDelta.current.subVectors(rotateEnd.current, rotateStart.current);
        rotateDelta.current.multiplyScalar(ROTATE_SPEED / gl.domElement.clientHeight);
        
        spherical.current.theta -= rotateDelta.current.x;
        spherical.current.phi -= rotateDelta.current.y;
        
        // 角度制限
        spherical.current.phi = Math.max(MIN_POLAR_ANGLE, Math.min(MAX_POLAR_ANGLE, spherical.current.phi));
        
        rotateStart.current.copy(rotateEnd.current);
      };
      
      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const handleWheel = (event) => {
      if (isMobile) return;
      
      event.preventDefault();
      
      if (event.deltaY < 0) {
        spherical.current.radius = Math.max(MIN_DISTANCE, spherical.current.radius - ZOOM_SPEED);
      } else {
        spherical.current.radius = Math.min(MAX_DISTANCE, spherical.current.radius + ZOOM_SPEED);
      }
    };

    const handleTouchStart = (event) => {
      if (!isMobile) return;
      
      event.preventDefault();
      
      const touchCount = event.touches.length;
      
      if (touchCount === 1) {
        // 単指タッチ - カメラ回転
        const touch = event.touches[0];
        rotateStart.current.set(touch.clientX, touch.clientY);
        touches.current.rotating = true;
      } else if (touchCount === 2) {
        // 二指タッチ - ズーム
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        lastTouchDistance.current = distance;
        touches.current.zooming = true;
        touches.current.rotating = false;
      }
    };

    const handleTouchMove = (event) => {
      if (!isMobile) return;
      
      event.preventDefault();
      
      const touchCount = event.touches.length;
      
      if (touchCount === 1 && touches.current.rotating) {
        // カメラ回転
        const touch = event.touches[0];
        rotateEnd.current.set(touch.clientX, touch.clientY);
        rotateDelta.current.subVectors(rotateEnd.current, rotateStart.current);
        rotateDelta.current.multiplyScalar(ROTATE_SPEED / gl.domElement.clientHeight);
        
        spherical.current.theta -= rotateDelta.current.x * 2; // モバイルでは少し感度を上げる
        spherical.current.phi -= rotateDelta.current.y * 2;
        
        // 角度制限
        spherical.current.phi = Math.max(MIN_POLAR_ANGLE, Math.min(MAX_POLAR_ANGLE, spherical.current.phi));
        
        rotateStart.current.copy(rotateEnd.current);
      } else if (touchCount === 2 && touches.current.zooming) {
        // ズーム
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );
        
        const delta = distance - lastTouchDistance.current;
        spherical.current.radius = Math.max(
          MIN_DISTANCE,
          Math.min(MAX_DISTANCE, spherical.current.radius - delta * 0.01)
        );
        
        lastTouchDistance.current = distance;
      }
    };

    const handleTouchEnd = (event) => {
      if (!isMobile) return;
      
      event.preventDefault();
      touches.current.rotating = false;
      touches.current.zooming = false;
    };

    const canvas = gl.domElement;
    
    if (isMobile) {
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
      canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    } else {
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (isMobile) {
        canvas.removeEventListener('touchstart', handleTouchStart);
        canvas.removeEventListener('touchmove', handleTouchMove);
        canvas.removeEventListener('touchend', handleTouchEnd);
      } else {
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('wheel', handleWheel);
      }
    };
  }, [gl, isMobile]);

  // カメラの衝突判定
  const checkCameraCollision = (desiredPosition, targetPosition) => {
    const direction = new THREE.Vector3().subVectors(desiredPosition, targetPosition);
    const distance = direction.length();
    
    if (distance === 0) return desiredPosition;
    
    raycaster.current.set(targetPosition, direction.normalize());
    raycaster.current.far = distance;
    
    const intersections = raycaster.current.intersectObjects(collisionObjects.current, true);
    
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const collisionDistance = intersection.distance - COLLISION_OFFSET;
      const safeDistance = Math.max(MIN_DISTANCE * 0.5, collisionDistance);
      
      return targetPosition.clone().add(direction.multiplyScalar(safeDistance));
    }
    
    return desiredPosition;
  };

  useFrame((state, delta) => {
    if (!targetPosition) return;

    // ターゲット位置を滑らかに更新（キャラクターの急激な動きを吸収）
    const newTargetPosition = new THREE.Vector3(
      targetPosition.x,
      targetPosition.y + 0.7,
      targetPosition.z
    );
    
    smoothTargetRef.current.lerp(newTargetPosition, TARGET_SMOOTHING);

    // 球面座標から理想的なカメラ位置を計算
    const idealCameraPosition = new THREE.Vector3();
    idealCameraPosition.setFromSpherical(spherical.current);
    idealCameraPosition.add(smoothTargetRef.current);

    // 衝突判定を行って実際のカメラ位置を決定
    const safeCameraPosition = checkCameraCollision(idealCameraPosition, smoothTargetRef.current);

    // カメラ位置を滑らかに更新
    smoothCameraPosition.current.lerp(safeCameraPosition, CAMERA_SMOOTHING);
    camera.position.copy(smoothCameraPosition.current);

    // 注視点も滑らかに更新
    smoothLookAt.current.lerp(smoothTargetRef.current, CAMERA_SMOOTHING);
    camera.lookAt(smoothLookAt.current);

    // カメラマトリックスを手動更新（より安定した動作のため）
    camera.updateMatrixWorld(true);
  });

  return (
    <group ref={cameraRigRef}>
      {/* カメラ用の3Dオブジェクトは不要、useFrameでカメラを直接制御 */}
    </group>
  );
};

export default CameraController;