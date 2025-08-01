import React, { useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';

const HololiveCharacter = (props) => {
  const group = useRef();
  // 手順1で配置したGLBファイルへのパスを指定
  const { scene, animations } = useGLTF("/models/hololive/マリンMMD.gltf");
  const { actions, names } = useAnimations(animations, group);

  // コンポーネントが読み込まれたらアニメーションを再生
  useEffect(() => {
    // GLBに含まれるアニメーションの名前を確認したい場合
    // console.log("利用可能なアニメーション:", names); 

    // ここで再生したいアニメーションの名前を指定します。
    // GLBに"Idle"という名前のアニメーションが含まれていると仮定しています。
    const animationName = names[0] || "Idle"; // 最初のアニメーション、または"Idle"を再生

    if (actions[animationName]) {
      actions[animationName].play();
    }
  }, [actions, names]);

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
              // alphaTestを設定すると、ピクセルが完全な不透明か完全な透明かを判断する
              // これにより、半透明の描画順問題が解決することが多い
              material.alphaTest = 1;

              // 透明なオブジェクトでも深度バッファに書き込むことで、
              // モデル自身の他のパーツとの前後関係が正しくなる
              material.depthWrite = true;
            }
          }
        });
      }
    });
  }, [scene]);

  return (
    <group ref={group} {...props} dispose={null}>
      <primitive object={scene} />
    </group>
  );
};

// パフォーマンス向上のため、モデルを事前に読み込んでおく
useGLTF.preload("/models/hololive/マリンMMD.gltf");

export default HololiveCharacter;