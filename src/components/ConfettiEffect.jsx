// src/components/ConfettiEffect.jsx
import React, { useEffect, useState } from 'react';

const ConfettiEffect = () => {
  const [confetti, setConfetti] = useState([]);
  const [isActive, setIsActive] = useState(true);
  
  useEffect(() => {
    // Criar 100 pedaços de confete
    const pieces = [];
    const colors = ['#FFD700', '#FF4500', '#37E359', '#1E90FF', '#FF1493', '#9370DB'];
    
    for (let i = 0; i < 100; i++) {
      pieces.push({
        id: i,
        x: Math.random() * 100, // posição horizontal (%)
        y: -10 - Math.random() * 20, // posição vertical inicial (fora da tela)
        size: 5 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.floor(Math.random() * 3), // 0: circle, 1: square, 2: triangle
        rotation: Math.random() * 360,
        xVelocity: -1 + Math.random() * 2, // movimento horizontal
        yVelocity: 1 + Math.random() * 3, // velocidade de queda
        opacity: 0.6 + Math.random() * 0.4,
        delay: Math.random() * 3 // atraso inicial
      });
    }
    
    setConfetti(pieces);
    
    // Animação de queda
    let animationId;
    let lastTime = 0;
    
    const animate = (time) => {
      if (!lastTime) lastTime = time;
      const delta = (time - lastTime) / 1000; // segundos
      lastTime = time;
      
      setConfetti(prevConfetti => 
        prevConfetti.map(piece => {
          // Verificar se o confete já começou a cair (baseado no delay)
          if (piece.delay > 0) {
            return {
              ...piece,
              delay: piece.delay - delta
            };
          }
          
          // Atualizar posição
          let newY = piece.y + piece.yVelocity * 30 * delta;
          let newX = piece.x + piece.xVelocity * 10 * delta;
          let newRotation = piece.rotation + 50 * delta;
          
          // Resetar o confete quando sair da tela
          if (newY > 100) {
            newY = -10;
            newX = Math.random() * 100;
          }
          
          // Manter o confete na tela horizontalmente
          if (newX < 0) newX = 100;
          if (newX > 100) newX = 0;
          
          return {
            ...piece,
            y: newY,
            x: newX,
            rotation: newRotation
          };
        })
      );
      
      if (isActive) {
        animationId = requestAnimationFrame(animate);
      }
    };
    
    // Iniciar a animação após um pequeno atraso
    const timeout = setTimeout(() => {
      animationId = requestAnimationFrame(animate);
    }, 500);
    
    // Parar a animação após 5 segundos
    const stopTimeout = setTimeout(() => {
      setIsActive(false);
    }, 5000);
    
    // Limpar
    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(timeout);
      clearTimeout(stopTimeout);
    };
  }, []);
  
  if (!isActive) return null;
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-10">
      {confetti.map(piece => {
        // Definir a forma do confete
        let shapeStyle = {};
        if (piece.shape === 0) {
          shapeStyle.borderRadius = '50%'; // círculo
        } else if (piece.shape === 1) {
          shapeStyle.borderRadius = '0'; // quadrado
        } else {
          shapeStyle.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)'; // triângulo
        }
        
        return (
          <div
            key={piece.id}
            style={{
              position: 'absolute',
              left: `${piece.x}%`,
              top: `${piece.y}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              backgroundColor: piece.color,
              opacity: piece.delay <= 0 ? piece.opacity : 0,
              transform: `rotate(${piece.rotation}deg)`,
              transition: 'opacity 0.3s ease',
              ...shapeStyle
            }}
          />
        );
      })}
    </div>
  );
};

export default ConfettiEffect;