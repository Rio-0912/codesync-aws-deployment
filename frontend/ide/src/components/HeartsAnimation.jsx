import React from 'react';
import { motion } from 'framer-motion';

const HeartsAnimation = () => {
  // Generate random particles
  const particles = Array.from({ length: 20 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100, // percentage
    y: Math.random() * 100,
    size: Math.random() * 20 + 10,
    delay: Math.random() * 0.5,
    emoji: ['💖', '✨', '🚀', '🔥'][Math.floor(Math.random() * 4)]
  }));

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: '100%', x: `${p.x}vw`, scale: 0.5 }}
          animate={{ 
            opacity: [0, 1, 0], 
            y: [`${Math.random() * 100}vh`, `${Math.random() * 50}vh`, '-10vh'],
            x: [`${p.x}vw`, `${p.x + (Math.random() * 20 - 10)}vw`],
            scale: [0.5, 1.5, 1]
          }}
          transition={{ duration: 1.5 + Math.random(), delay: p.delay, ease: "easeOut" }}
          className="absolute text-2xl"
          style={{ fontSize: p.size }}
        >
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
};

export default HeartsAnimation;
